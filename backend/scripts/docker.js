import { spawnSync } from 'child_process';
import { readFileSync } from 'fs';

const imageName = 'bilhete-backend:latest';
const containerName = 'bilhete-backend';

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    stdio: 'inherit',
    shell: process.platform === 'win32',
    ...options,
  });

  if (result.status !== 0) {
    process.exit(result.status || 1);
  }
}

const action = process.argv[2];

function resolveRuntimeConfig(selectedEnvFile) {
  const envFile = selectedEnvFile || '.env.production';
  const nodeEnv = envFile.toLowerCase().includes('production') ? 'production' : 'development';
  return { envFile, nodeEnv };
}

function readEnvValue(filePath, key) {
  try {
    const content = readFileSync(filePath, 'utf8');
    for (const line of content.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) {
        continue;
      }

      const separatorIndex = trimmed.indexOf('=');
      if (separatorIndex <= 0) {
        continue;
      }

      const currentKey = trimmed.slice(0, separatorIndex).trim();
      if (currentKey !== key) {
        continue;
      }

      return trimmed.slice(separatorIndex + 1).trim().replace(/^['"]|['"]$/g, '');
    }
  } catch (error) {
    console.warn(`[docker] Nao foi possivel ler ${filePath}: ${error.message}`);
  }

  return null;
}

function resolveDockerDbHost(dbHostFromFile) {
  const normalized = String(dbHostFromFile || '').trim().toLowerCase();
  if (!normalized) {
    return null;
  }

  if (normalized === 'localhost' || normalized === '127.0.0.1' || normalized === '::1') {
    return 'host.docker.internal';
  }

  return null;
}

if (action === 'build') {
  run('docker', ['build', '-t', imageName, '.']);
  process.exit(0);
}

if (action === 'run') {
  const { envFile, nodeEnv } = resolveRuntimeConfig(process.argv[3]);
  const dbHostFromEnvFile = readEnvValue(envFile, 'DB_HOST');
  const dockerDbHostOverride = resolveDockerDbHost(dbHostFromEnvFile);

  console.log(`[docker] Running with envFile=${envFile} NODE_ENV=${nodeEnv}`);
  if (dockerDbHostOverride) {
    console.log(
      `[docker] DB_HOST=${dbHostFromEnvFile} detectado no ${envFile}; usando DB_HOST=${dockerDbHostOverride} dentro do container`
    );
  }

  run('docker', ['rm', '-f', containerName], { stdio: 'ignore' });
  const dockerArgs = [
    'run',
    '-d',
    '--name',
    containerName,
    '--add-host',
    'host.docker.internal:host-gateway',
    '--env-file',
    envFile,
    '-e',
    `NODE_ENV=${nodeEnv}`,
    '-p',
    '3333:3333',
    imageName,
  ];

  if (dockerDbHostOverride) {
    dockerArgs.splice(dockerArgs.length - 3, 0, '-e', `DB_HOST=${dockerDbHostOverride}`);
  }

  run('docker', dockerArgs);
  process.exit(0);
}

console.error('Uso: node scripts/docker.js <build|run> [envFile]');
process.exit(1);