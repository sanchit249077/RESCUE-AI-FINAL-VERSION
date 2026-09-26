import { spawn } from 'node:child_process';

const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const children = [];

function run(args, name) {
  const child = spawn(npm, args, { stdio: 'inherit', env: process.env });
  children.push(child);
  child.on('exit', (code, signal) => {
    if (code && !signal) process.exitCode = code;
  });
  return child;
}

run(['--prefix', 'server', 'run', 'dev'], 'backend');
run(['run', 'dev'], 'frontend');

const shutdown = () => {
  for (const child of children) child.kill('SIGTERM');
  setTimeout(() => process.exit(0), 250);
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
process.on('exit', () => children.forEach((child) => child.kill('SIGTERM')));
