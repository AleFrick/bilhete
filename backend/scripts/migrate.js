import { createHash } from 'crypto';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import mysql from 'mysql2/promise';
import { env } from '../src/config/env.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const migrationsDir = path.join(__dirname, '..', 'database', 'migrations');

function sha256(content) {
  return createHash('sha256').update(content).digest('hex');
}

function escapeIdentifier(identifier) {
  return `\`${String(identifier).replace(/`/g, '``')}\``;
}

async function ensureMigrationsTable(connection) {
  await connection.query(`
    create table if not exists schema_migrations (
      id bigint primary key auto_increment,
      name varchar(255) not null unique,
      checksum char(64) not null,
      executed_at timestamp not null default current_timestamp
    )
  `);
}

async function resolveMigrationsTableColumns(connection) {
  const getColumns = async () => {
    const [rows] = await connection.query('show columns from schema_migrations');
    return rows.map((row) => ({
      name: String(row.Field),
      normalizedName: String(row.Field).toLowerCase(),
      dataType: String(row.Type || '').toLowerCase(),
    }));
  };

  let columns = await getColumns();

  const names = new Set(columns.map((column) => column.normalizedName));

  const preferredNameColumns = ['name', 'migration_name', 'migration', 'filename', 'file', 'version'];
  let nameColumn = null;
  const preferredHit = preferredNameColumns.find((columnName) => names.has(columnName));
  if (preferredHit) {
    nameColumn = columns.find((column) => column.normalizedName === preferredHit)?.name || null;
  }

  if (!nameColumn) {
    const fallback = columns.find((column) => {
      const isTextLike = ['varchar', 'char', 'text', 'tinytext', 'mediumtext', 'longtext'].includes(
        column.dataType,
      );
      return isTextLike && !['checksum', 'executed_at'].includes(column.normalizedName);
    });
    if (fallback) {
      nameColumn = fallback.name;
    }
  }

  if (!nameColumn) {
    try {
      await connection.query('alter table schema_migrations add column name varchar(255) null');
    } catch (error) {
      const message = String(error?.message || '').toLowerCase();
      const duplicateNameColumn =
        message.includes("duplicate column name 'name'") || message.includes('duplicate column name `name`');
      if (!duplicateNameColumn) {
        throw error;
      }
    }

    columns = await getColumns();
    const retryNames = new Set(columns.map((column) => column.normalizedName));
    if (!retryNames.has('name')) {
      throw new Error('Tabela schema_migrations sem coluna de identificacao de migration.');
    }
    nameColumn = columns.find((column) => column.normalizedName === 'name')?.name || 'name';
  }

  const hasChecksum = names.has('checksum') || columns.some((column) => column.normalizedName === 'checksum');
  if (!hasChecksum) {
    try {
      await connection.query('alter table schema_migrations add column checksum char(64) null');
    } catch (error) {
      const message = String(error?.message || '').toLowerCase();
      const duplicateChecksumColumn =
        message.includes("duplicate column name 'checksum'") ||
        message.includes('duplicate column name `checksum`');
      if (!duplicateChecksumColumn) {
        throw error;
      }
    }
    columns = await getColumns();
  }

  const finalHasChecksum = columns.some((column) => column.normalizedName === 'checksum');

  return {
    nameColumn,
    hasChecksum: finalHasChecksum,
  };
}

async function getMigrationFiles() {
  const entries = await fs.readdir(migrationsDir, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile() && entry.name.endsWith('.sql'))
    .map((entry) => entry.name)
    .sort((a, b) => a.localeCompare(b));
}

async function getAppliedMigrations(connection, tableColumns) {
  const nameColumnSql = escapeIdentifier(tableColumns.nameColumn);
  const checksumSelect = tableColumns.hasChecksum ? ', checksum as migration_checksum' : '';
  const [rows] = await connection.query(
    `select ${nameColumnSql} as migration_name${checksumSelect} from schema_migrations order by ${nameColumnSql} asc`,
  );
  return new Map(
    rows
      .filter((row) => row.migration_name != null)
      .map((row) => [row.migration_name, tableColumns.hasChecksum ? row.migration_checksum : null]),
  );
}

async function run() {
  const command = process.argv[2] || 'up';
  const targetMigration = process.argv[3] || null;
  const strictChecksumValidation =
    process.env.MIGRATION_STRICT_CHECKSUM === 'true' ||
    (process.env.MIGRATION_STRICT_CHECKSUM !== 'false' && process.env.NODE_ENV === 'production');

  const connection = await mysql.createConnection({
    host: env.mysqlHost,
    port: env.mysqlPort,
    user: env.mysqlUser,
    password: env.mysqlPassword,
    database: env.mysqlDatabase,
    multipleStatements: true,
  });

  try {
    await ensureMigrationsTable(connection);
    const tableColumns = await resolveMigrationsTableColumns(connection);

    const files = await getMigrationFiles();
    const applied = await getAppliedMigrations(connection, tableColumns);

    for (const fileName of files) {
      if (applied.has(fileName)) {
        const content = await fs.readFile(path.join(migrationsDir, fileName), 'utf8');
        const currentChecksum = sha256(content);
        const appliedChecksum = applied.get(fileName);
        if (tableColumns.hasChecksum && appliedChecksum && appliedChecksum !== currentChecksum) {
          const message = `Migration alterada apos execucao: ${fileName}`;
          if (strictChecksumValidation) {
            throw new Error(message);
          }
          console.warn(`[warn] ${message}. Ignorando em ambiente nao-producao.`);
        }
      }
    }

    if (command === 'status') {
      const pending = files.filter((fileName) => !applied.has(fileName));
      console.log(`Banco: ${env.mysqlDatabase}`);
      console.log(`Aplicadas: ${applied.size}`);
      console.log(`Pendentes: ${pending.length}`);
      if (pending.length) {
        console.log('Lista de pendentes:');
        for (const fileName of pending) {
          console.log(`- ${fileName}`);
        }
      }
      return;
    }

    if (command !== 'up') {
      throw new Error('Comando invalido. Use: up ou status');
    }

    const pending = files.filter((fileName) => !applied.has(fileName));
    const toApply = targetMigration
      ? pending.filter((fileName) => fileName.localeCompare(targetMigration) <= 0)
      : pending;

    if (!toApply.length) {
      console.log('Nenhuma migration pendente.');
      return;
    }

    for (const fileName of toApply) {
      const fullPath = path.join(migrationsDir, fileName);
      const sql = await fs.readFile(fullPath, 'utf8');
      const checksum = sha256(sql);

      console.log(`Aplicando ${fileName}...`);
      await connection.query(sql);
      const nameColumnSql = escapeIdentifier(tableColumns.nameColumn);
      if (tableColumns.hasChecksum) {
        await connection.query(
          `insert into schema_migrations (${nameColumnSql}, checksum) values (?, ?)`,
          [fileName, checksum],
        );
      } else {
        await connection.query(`insert into schema_migrations (${nameColumnSql}) values (?)`, [
          fileName,
        ]);
      }
      console.log(`OK ${fileName}`);
    }

    console.log('Migrations aplicadas com sucesso.');
  } finally {
    await connection.end();
  }
}

run().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
