import { spawn } from 'node:child_process';

const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';

const build = spawn(npm, ['run', 'build'], { stdio: 'inherit', env: process.env });
build.on('exit', (code) => {
  if (code !== 0) process.exit(code ?? 1);
  const server = spawn(npm, ['--prefix', 'server', 'start'], { stdio: 'inherit', env: process.env });
  const shutdown = () => server.kill('SIGTERM');
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
  server.on('exit', (serverCode) => process.exit(serverCode ?? 0));
});
