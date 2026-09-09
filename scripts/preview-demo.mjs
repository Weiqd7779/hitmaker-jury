import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join, extname } from 'node:path';

const root = fileURLToPath(new URL('../dist-demo/', import.meta.url));
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.wav': 'audio/wav' };
const server = createServer(async (req, res) => {
  try {
    const path = new URL(req.url, 'http://localhost').pathname;
    if (path === '/favicon.ico') { res.writeHead(204); res.end(); return; }
    const file = path === '/' ? 'index.html' : path.slice(1);
    if (req.method !== 'GET' || !(['index.html', 'presentation.json', 'jury-real-reviews.json', 'demo.wav', 'chain/manifest.json'].includes(file) || /^assets\/[A-Za-z0-9_.-]+$/.test(file) || /^(agents|records)\/[a-f0-9]{64}\/(professor|antisocial|nearmiss)\.json$/.test(file))) { res.writeHead(404); res.end('Not found'); return; }
    const bytes = await readFile(join(root, file));
    res.writeHead(200, { 'Content-Type': types[extname(file)] || 'application/octet-stream', 'Content-Length': bytes.length, 'X-Content-Type-Options': 'nosniff' }); res.end(bytes);
  } catch { res.writeHead(404); res.end('Not found'); }
});
const port = parseInt(process.env.PREVIEW_PORT || '4174', 10);
server.listen(port, '127.0.0.1', () => console.log(`Read-only demo at http://127.0.0.1:${port} — no API endpoints or signing keys.`));
