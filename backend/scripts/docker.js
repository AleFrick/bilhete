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

if (action === 'build') {
  run('docker', ['build', '-t', imageName, '.']);
  process.exit(0);
}

if (action === 'run') {
  run('docker', ['rm', '-f', containerName], { stdio: 'ignore' });
  run('docker', [
    'run',
    '-d',
    '--name',
    containerName,
    '--env-file',
    '.env.development',
    '-p',
    '3333:3333',
    imageName,
  ]);
  process.exit(0);
}

console.error('Uso: node scripts/docker.js <build|run>');
process.exit(1);