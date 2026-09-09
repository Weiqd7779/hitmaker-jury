import { spawn } from 'node:child_process';
import { createServer } from 'vite';

const backend = spawn(process.execPath, ['server/index.mjs'], { stdio: 'inherit', env: process.env });
const vite = await createServer();
let stopping = false;
const stop = async () => { if (stopping) return; stopping = true; backend.kill(); await vite.close(); };
backend.on('exit', code => { if (!stopping) { process.exitCode = code || 1; void stop(); } });
process.on('SIGINT', () => void stop());
process.on('SIGTERM', () => void stop());
try { await vite.listen(); vite.printUrls(); }
catch (error) { console.error(error.message); process.exitCode = 1; await stop(); }
