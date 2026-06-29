import { spawnSync } from 'child_process';

const imageName = 'bilhete-frontend:latest';
const containerName = 'bilhete-frontend';
const defaultApiUrl = 'http://68.168.222.85:3333/api';

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

if (action === 'build') {
  const apiUrl = process.argv[3] || process.env.VITE_API_URL || defaultApiUrl;
  console.log(`[docker] Building with VITE_API_URL=${apiUrl}`);

  run('docker', [
    'build',
    '--no-cache',
    '-t',
    imageName,
    '--build-arg',
    `VITE_API_URL=${apiUrl}`,
    '.',
  ]);
  process.exit(0);
}

if (action === 'run') {
  run('docker', ['rm', '-f', containerName], { stdio: 'ignore' });
  run('docker', [
    'run',
    '-d',
    '--name',
    containerName,
    '-p',
    '4173:4173',
    imageName,
  ]);
  process.exit(0);
}

console.error('Uso: node scripts/docker.js <build|run> [VITE_API_URL]');
process.exit(1);
