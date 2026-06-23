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

async function getMigrationFiles() {
  const entries = await fs.readdir(migrationsDir, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile() && entry.name.endsWith('.sql'))
    .map((entry) => entry.name)
    .sort((a, b) => a.localeCompare(b));
}

async function getAppliedMigrations(connection) {
  const [rows] = await connection.query('select name, checksum from schema_migrations order by name asc');
  return new Map(rows.map((row) => [row.name, row.checksum]));
}

async function run() {
  const command = process.argv[2] || 'up';
  const targetMigration = process.argv[3] || null;

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

    const files = await getMigrationFiles();
    const applied = await getAppliedMigrations(connection);

    for (const fileName of files) {
      if (applied.has(fileName)) {
        const content = await fs.readFile(path.join(migrationsDir, fileName), 'utf8');
        const currentChecksum = sha256(content);
        if (applied.get(fileName) !== currentChecksum) {
          throw new Error(`Migration alterada apos execucao: ${fileName}`);
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
      await connection.query('insert into schema_migrations (name, checksum) values (?, ?)', [
        fileName,
        checksum,
      ]);
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
