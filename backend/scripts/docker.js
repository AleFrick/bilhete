import { spawnSync } from 'child_process';

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

if (action === 'build') {
  run('docker', ['build', '-t', imageName, '.']);
  process.exit(0);
}

if (action === 'run') {
  const { envFile, nodeEnv } = resolveRuntimeConfig(process.argv[3]);

  console.log(`[docker] Running with envFile=${envFile} NODE_ENV=${nodeEnv}`);
  run('docker', ['rm', '-f', containerName], { stdio: 'ignore' });
  run('docker', [
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
  ]);
  process.exit(0);
}

console.error('Uso: node scripts/docker.js <build|run> [envFile]');
process.exit(1);