import { createServer } from 'node:http';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { Store } from './store.mjs';
import { Career } from './career.mjs';
import { fixedAudio, json, requireValue, PRESENTATION_BATCH } from './protocol.mjs';
import { verifyBundle } from './verify.mjs';
import { Presentation } from './presentation.mjs';
import { getAddress, verifyMessage } from 'ethers';
import { readFile } from 'node:fs/promises';
import { publication } from './publication.mjs';

export function createCareerServer(career, { allowedOrigins = ['http://localhost:5173', 'http://127.0.0.1:5173', 'http://localhost:4173', 'http://127.0.0.1:4173'], presentation = new Presentation(career.store) } = {}) {
  const token = randomBytes(32).toString('hex');
  const challenges = new Map();
  const published = async () => {
    const snapshot = presentation.summary();
    if (snapshot.status !== 'completed') return null;
    const contracts = JSON.parse(await readFile(new URL('../.career-local/contracts.json', import.meta.url), 'utf8'));
    return publication(snapshot, contracts);
  };
  return createServer(async (req, res) => {
    res.setHeader('Cache-Control', 'no-store'); res.setHeader('X-Content-Type-Options', 'nosniff');
    const send = (status, data) => { res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' }); res.end(json(data)); };
    try {
      requireValue(/^(localhost|127\.0\.0\.1)(:\d+)?$/.test(req.headers.host || ''), '不允許的 Host');
      const url = new URL(req.url, 'http://localhost');
      requireValue(!req.headers.origin || allowedOrigins.includes(req.headers.origin), '不允許的 Origin');
      if (req.method === 'GET' && url.pathname === '/api/career') return send(200, { ...career.summary(), token });
      if (req.method === 'GET' && url.pathname === '/api/presentation') return send(200, { ...presentation.summary(), token });
      if (req.method === 'GET' && url.pathname === '/api/chain/manifest') return send(200, (await published())?.manifest || { status: 'prepare-reviews' });
      const record = url.pathname.match(/^\/(agents|records)\/([a-f0-9]{64})\/(professor|antisocial|nearmiss)\.json$/);
      if (req.method === 'GET' && record) {
        const output = await published();
        if (!output || output.manifest.jobHash.slice(2) !== record[2]) return send(404, { error: '請核對工作版本' });
        const index = output.manifest.workers.findIndex(worker => worker.key === record[3]);
        return send(200, record[1] === 'agents' ? output.profiles[index] : output.records[index]);
      }
      if (req.method === 'GET' && url.pathname === '/api/presentation/export') {
        res.setHeader('Content-Disposition', 'attachment; filename="jury-real-reviews.json"');
        return send(200, { ...presentation.summary(), notice: 'Real Router responses when completed; local cache only; no on-chain identity, feedback, storage or settlement proof.' });
      }
      if (req.method === 'GET' && url.pathname === '/api/music.wav') {
        res.writeHead(200, { 'Content-Type': 'audio/wav' }); return res.end(fixedAudio());
      }
      const match = url.pathname.match(/^\/api\/jobs\/([0-9a-f-]{36})\/(resume|verify|evidence)\/?$/);
      if (req.method === 'GET' && match?.[2] === 'evidence') {
        const job = career.store.get(match[1]); requireValue(job, '工作不存在');
        const work = job.works.find(w => w.key === url.searchParams.get('worker'));
        requireValue(work?.record, '尚未產生工作證據');
        res.setHeader('Content-Disposition', `attachment; filename="career-${job.id}-${work.key}.json"`);
        return send(200, { schema: '0g-career-bundle-v1', record: work.record, compute: work.compute, storage: work.storage, feedback: work.feedback, payment: work.payment });
      }
      if (req.method !== 'POST') return send(404, { error: 'Not found' });
      const supplied = Buffer.from(req.headers['x-career-token'] || '');
      requireValue(supplied.length === token.length && timingSafeEqual(supplied, Buffer.from(token)), '操作授權已失效，請重新整理');
      requireValue(req.headers['content-type']?.startsWith('application/json'), '只接受 JSON');
      let body = '';
      for await (const chunk of req) { body += chunk; requireValue(Buffer.byteLength(body) <= 8192, '請求過大'); }
      const input = JSON.parse(body || '{}');
      if (url.pathname === '/api/presentation/generate') {
        requireValue(input.consent === 'up-to-three-inferences', '需要確認最多三次真實推論的費用');
        requireValue(presentation.summary().keyConfigured, '尚未配置 Router Key');
        presentation.generate().catch(() => console.error('Presentation request could not start; no automatic retry.'));
        return send(202, presentation.summary());
      }
      if (url.pathname === '/api/wallet/challenge') {
        requireValue(input.chainId === 16602, '請先切換 Galileo 測試網');
        for (const [id, challenge] of challenges) if (challenge.expires < Date.now()) challenges.delete(id);
        requireValue(challenges.size < 32, '簽署請求過多，請稍後再試');
        const address = getAddress(input.address), id = randomBytes(24).toString('hex'), expires = Date.now() + 120000;
        const message = `Hitmaker Jury wallet ownership check\nNetwork: 0G Galileo (16602)\nAddress: ${address}\nNonce: ${id}\nExpires: ${new Date(expires).toISOString()}\nThis is NOT a transaction or spending approval.`;
        challenges.set(id, { address, message, expires });
        return send(200, { id, message, expires });
      }
      if (url.pathname === '/api/wallet/verify') {
        const challenge = challenges.get(input.id); challenges.delete(input.id);
        requireValue(challenge && challenge.expires > Date.now(), '簽署請求已過期或已使用');
        requireValue(verifyMessage(challenge.message, input.signature) === challenge.address, '錢包簽署者不符');
        return send(200, { verified: true, address: challenge.address, scope: 'wallet ownership only; no transaction or spending approval' });
      }
      if (url.pathname === '/api/jobs') {
        requireValue(input.consent === 'run-paid-testnet', '需要明確確認測試網支出');
        requireValue(typeof input.requestId === 'string', '需要建立工作 requestId 以避免重複支出');
        const job = career.create(input.kind, input.requestId);
        if (!career.running && job.status === 'pending') {
          career.run(job.id).catch(() => { const saved = career.store.get(job.id); saved.status = 'blocked'; saved.error = '工作未能啟動，請檢查設定'; career.store.put(saved); });
        }
        return send(202, { id: job.id });
      }
      if (match?.[2] === 'resume') {
        requireValue(input.consent === 'run-paid-testnet', '需要明確確認恢復測試網操作');
        requireValue(!career.running, '工作正在執行');
        requireValue(career.store.get(match[1]), '工作不存在');
        career.run(match[1]).catch(() => {
          const saved = career.store.get(match[1]);
          saved.status = 'blocked'; saved.error = '工作未能恢復，請檢查設定'; career.store.put(saved);
        });
        return send(202, { id: match[1] });
      }
      if (match?.[2] === 'verify') {
        requireValue(!career.running, '請等工作結束後再重新驗證');
        const job = career.store.get(match[1]); requireValue(job, '工作不存在');
        const work = job.works.find(w => w.key === input.worker); requireValue(work?.record, '沒有可驗證工作');
        work.verification = await verifyBundle(work, { provider: career.provider, storage: career.storage });
        if (!work.verification.ok && work.status === 'completed') work.status = 'verification-unavailable';
        if (work.verification.ok) work.status = 'completed';
        career.store.put(job);
        return send(200, work.verification);
      }
      return send(404, { error: 'Not found' });
    } catch (error) {
      if (!res.headersSent) send(400, { error: String(error.shortMessage || error.message).replace(/(?:sk-|mk-)[A-Za-z0-9_-]+|0x[0-9a-fA-F]{64}/g, '[redacted]').slice(0, 400) });
      else res.end();
    }
  });
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const store = new Store();
  if (!store.presentation()) {
    try {
      const snapshot = JSON.parse(await readFile(new URL('../public/demo-records.json', import.meta.url), 'utf8'));
      if (snapshot.batch === PRESENTATION_BATCH && snapshot.status === 'completed') store.beginPresentation(snapshot);
    } catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
  const server = createCareerServer(new Career(store));
  server.listen(3001, '127.0.0.1', () => {
    for (const job of store.list()) if (job.status === 'running') { job.status = 'blocked'; job.error = '伺服器曾中斷，請恢復原工作'; store.put(job); }
    console.log('Career API ready at http://127.0.0.1:3001 — testnet writes are disabled unless explicitly configured.');
  });
  server.on('error', error => { console.error(error.code || 'Server failed'); process.exitCode = 1; });
}
