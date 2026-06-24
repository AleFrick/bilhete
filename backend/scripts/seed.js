import { createHash } from 'crypto';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import mysql from 'mysql2/promise';

import { env } from '../src/config/env.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const seedsDir = path.join(__dirname, '..', 'database', 'seeds');

function sha256(content) {
  return createHash('sha256').update(content).digest('hex');
}

async function ensureSeedsTable(connection) {
  await connection.query(`
    create table if not exists data_seeds (
      id bigint primary key auto_increment,
      name varchar(255) not null unique,
      checksum char(64) not null,
      executed_at timestamp not null default current_timestamp
    )
  `);
}

async function getSeedFiles() {
  const entries = await fs.readdir(seedsDir, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile() && entry.name.endsWith('.sql'))
    .map((entry) => entry.name)
    .sort((a, b) => a.localeCompare(b));
}

async function getAppliedSeeds(connection) {
  const [rows] = await connection.query(
    `select name, checksum
     from data_seeds
     order by name asc`
  );

  return new Map(rows.map((row) => [row.name, row.checksum]));
}

async function run() {
  const command = process.argv[2] || 'up';
  const strictChecksumValidation =
    process.env.SEED_STRICT_CHECKSUM === 'true' ||
    (process.env.SEED_STRICT_CHECKSUM !== 'false' && process.env.NODE_ENV === 'production');

  const connection = await mysql.createConnection({
    host: env.mysqlHost,
    port: env.mysqlPort,
    user: env.mysqlUser,
    password: env.mysqlPassword,
    database: env.mysqlDatabase,
    multipleStatements: true,
  });

  try {
    await ensureSeedsTable(connection);

    const files = await getSeedFiles();
    const applied = await getAppliedSeeds(connection);

    for (const fileName of files) {
      if (!applied.has(fileName)) {
        continue;
      }

      const content = await fs.readFile(path.join(seedsDir, fileName), 'utf8');
      const currentChecksum = sha256(content);
      const appliedChecksum = applied.get(fileName);
      if (appliedChecksum && appliedChecksum !== currentChecksum) {
        const message = `Seed alterado apos execucao: ${fileName}`;
        if (strictChecksumValidation) {
          throw new Error(message);
        }
        console.warn(`[warn] ${message}. Ignorando em ambiente nao-producao.`);
      }
    }

    if (command === 'status') {
      const pending = files.filter((fileName) => !applied.has(fileName));
      console.log(`Banco: ${env.mysqlDatabase}`);
      console.log(`Seeds aplicados: ${applied.size}`);
      console.log(`Seeds pendentes: ${pending.length}`);
      if (pending.length) {
        console.log('Lista de seeds pendentes:');
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
    if (!pending.length) {
      console.log('Nenhum seed pendente.');
      return;
    }

    for (const fileName of pending) {
      const fullPath = path.join(seedsDir, fileName);
      const sql = await fs.readFile(fullPath, 'utf8');
      const checksum = sha256(sql);

      console.log(`Aplicando seed ${fileName}...`);
      await connection.query(sql);
      await connection.query(
        `insert into data_seeds (name, checksum) values (?, ?)`,
        [fileName, checksum]
      );
      console.log(`OK ${fileName}`);
    }

    console.log('Seeds aplicados com sucesso.');
  } finally {
    await connection.end();
  }
}

run().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
