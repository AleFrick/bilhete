import { spawnSync } from 'child_process';

const imageName = 'bilhete-frontend:latest';
const containerName = 'bilhete-frontend';

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
  run('docker', [
    'build',
    '-t',
    imageName,
    '--build-arg',
    'VITE_API_URL=http://localhost:3333/api',
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

console.error('Uso: node scripts/docker.js <build|run>');
process.exit(1);