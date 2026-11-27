// Starts the API, the shop and the admin together for local development: `pnpm dev`.
// A plain Node launcher (no turbo), so it behaves the same on Windows, macOS, Linux and Cloud Shell.
import { spawn } from 'node:child_process';
import net from 'node:net';

const services = [
  { name: 'api  ', color: 36, filter: '@dairy/api', port: 4000 },
  { name: 'shop ', color: 32, filter: '@dairy/web', port: 3000 },
  { name: 'admin', color: 35, filter: '@dairy/admin', port: 5173 },
];

const only = process.argv.slice(2).filter((a) => !a.startsWith('-'));
const run = services.filter((s) => only.length === 0 || only.some((o) => s.name.trim() === o));

const inUse = (port) =>
  new Promise((resolve) => {
    const s = net.connect({ port, host: '127.0.0.1' });
    s.once('connect', () => (s.destroy(), resolve(true)));
    s.once('error', () => resolve(false));
  });

for (const s of run) {
  if (await inUse(s.port)) {
    console.error(`\nPort ${s.port} is already in use (is an old "pnpm dev" still running?). Stop it, or close that terminal, then try again.\n`);
    process.exit(1);
  }
}

const children = [];
let stopping = false;
const stop = (code = 0) => {
  if (stopping) return;
  stopping = true;
  for (const c of children) {
    try {
      if (process.platform === 'win32') spawn('taskkill', ['/pid', String(c.pid), '/T', '/F'], { stdio: 'ignore' });
      else process.kill(-c.pid, 'SIGTERM');
    } catch {
      /* already gone */
    }
  }
  setTimeout(() => process.exit(code), 800);
};

const tag = (s) => `\x1b[${s.color}m${s.name}\x1b[0m │ `;
const pipe = (s, stream, out) => {
  let buf = '';
  stream.on('data', (d) => {
    buf += d.toString();
    const lines = buf.split(/\r?\n/);
    buf = lines.pop() ?? '';
    for (const l of lines) if (l.trim()) out.write(`${tag(s)}${l}\n`);
  });
};

for (const s of run) {
  const child = spawn('pnpm', ['--filter', s.filter, 'dev'], { shell: process.platform === 'win32', detached: process.platform !== 'win32', env: { ...process.env, FORCE_COLOR: '1' } });
  children.push(child);
  pipe(s, child.stdout, process.stdout);
  pipe(s, child.stderr, process.stderr);
  child.on('exit', (code, signal) => {
    if (stopping) return;
    console.error(`\n${tag(s)}stopped (${signal ?? `exit code ${code}`}). Stopping everything.`);
    if (signal === 'SIGKILL' || code === 137) console.error('   That usually means the computer ran out of memory. Close other programs, or run one part at a time: pnpm dev api | shop | admin.\n');
    stop(code || 1);
  });
}

process.on('SIGINT', () => stop(0));
process.on('SIGTERM', () => stop(0));

setTimeout(() => {
  if (stopping) return;
  console.log('\n\x1b[1;32m  Starting… when it says "Ready", open:\x1b[0m');
  console.log('    Shop   http://localhost:3000');
  console.log('    Admin  http://localhost:5173');
  console.log('    API    http://localhost:4000/docs');
  console.log('  Press Ctrl+C to stop everything.\n');
}, 1500);
