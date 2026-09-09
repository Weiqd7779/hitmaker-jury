import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { json, PRESENTATION_BATCH } from './protocol.mjs';

export class Store {
  constructor(path = fileURLToPath(new URL('../.career-local/career.sqlite', import.meta.url))) {
    if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
    this.db = new DatabaseSync(path);
    this.db.exec('PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA busy_timeout=5000; CREATE TABLE IF NOT EXISTS jobs(id TEXT PRIMARY KEY, body TEXT NOT NULL); CREATE TABLE IF NOT EXISTS transactions(id TEXT PRIMARY KEY, body TEXT NOT NULL); CREATE TABLE IF NOT EXISTS presentation(id TEXT PRIMARY KEY, body TEXT NOT NULL);');
  }
  list() { return this.db.prepare('SELECT body FROM jobs ORDER BY rowid DESC').all().map(r => JSON.parse(r.body)); }
  get(id) { const row = this.db.prepare('SELECT body FROM jobs WHERE id=?').get(id); return row ? JSON.parse(row.body) : null; }
  put(job) { this.db.prepare('INSERT INTO jobs VALUES(?,?) ON CONFLICT(id) DO UPDATE SET body=excluded.body').run(job.id, json(job)); }
  getTransaction(id) { const row = this.db.prepare('SELECT body FROM transactions WHERE id=?').get(id); return row ? JSON.parse(row.body) : null; }
  putTransaction(value) {
    this.db.prepare('INSERT OR IGNORE INTO transactions VALUES(?,?)').run(value.id, json(value));
    const existing = this.getTransaction(value.id);
    if (existing.raw !== value.raw || existing.hash !== value.hash) throw new Error('不可覆寫同一操作的已簽署交易');
    if (value.confirmed) this.db.prepare('UPDATE transactions SET body=? WHERE id=?').run(json({ ...existing, confirmed: true }), value.id);
  }
  pendingTransactions() { return this.db.prepare('SELECT body FROM transactions').all().map(r => JSON.parse(r.body)).filter(t => !t.confirmed); }
  presentation() { const row = this.db.prepare('SELECT body FROM presentation WHERE id=?').get(PRESENTATION_BATCH); return row ? JSON.parse(row.body) : null; }
  savePresentation(value) { this.db.prepare('INSERT INTO presentation VALUES(?,?) ON CONFLICT(id) DO UPDATE SET body=excluded.body').run(PRESENTATION_BATCH, json(value)); }
  beginPresentation(value) { return this.db.prepare('INSERT OR IGNORE INTO presentation VALUES(?,?)').run(PRESENTATION_BATCH, json(value)).changes === 1; }
  close() { this.db.close(); }
}
