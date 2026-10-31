import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const isWin = process.platform === 'win32';
const npmCmd = isWin ? 'npm.cmd' : 'npm';

console.log('===============================================================');
console.log('       UNIFIED AI WORKSPACE - LOCAL SYSTEM ORCHESTRATOR        ');
console.log('===============================================================');
console.log('Starting Backend Server (port 5000) and Frontend Vite (port 5173)...\n');

// 1. Run migrations first to ensure database is up-to-date
console.log('[System] Verifying database schema & migrations...');
const migrateProcess = spawn(npmCmd, ['run', 'migrate'], {
  cwd: path.join(__dirname, 'backend'),
  stdio: 'inherit',
  shell: true
});

migrateProcess.on('close', (code) => {
  if (code !== 0) {
    console.warn('[System] Migration exited with code', code, '- continuing startup...');
  } else {
    console.log('[System] Database verified.\n');
  }

  // 2. Start Backend
  const backend = spawn(npmCmd, ['run', 'start'], {
    cwd: path.join(__dirname, 'backend'),
    shell: true
  });

  backend.stdout.on('data', (d) => {
    process.stdout.write(`\x1b[36m[Backend]\x1b[0m ${d.toString()}`);
  });
  backend.stderr.on('data', (d) => {
    process.stderr.write(`\x1b[31m[Backend Error]\x1b[0m ${d.toString()}`);
  });

  // 3. Start Frontend
  const frontend = spawn(npmCmd, ['run', 'dev'], {
    cwd: path.join(__dirname, 'frontend'),
    shell: true
  });

  frontend.stdout.on('data', (d) => {
    process.stdout.write(`\x1b[35m[Frontend]\x1b[0m ${d.toString()}`);
  });
  frontend.stderr.on('data', (d) => {
    process.stderr.write(`\x1b[31m[Frontend Error]\x1b[0m ${d.toString()}`);
  });

  // Handle process termination
  const cleanup = () => {
    console.log('\n[System] Gracefully shutting down services...');
    backend.kill('SIGINT');
    frontend.kill('SIGINT');
    process.exit(0);
  };

  process.on('SIGINT', cleanup);
  process.on('SIGTERM', cleanup);
});
