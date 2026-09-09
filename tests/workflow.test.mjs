import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { Wallet, Transaction } from 'ethers';
import { Store } from '../server/store.mjs';
import { Career, configuration } from '../server/career.mjs';
import { createCareerServer } from '../server/index.mjs';
import { JournaledWallet } from '../server/chain.mjs';
import { verifyBundle } from '../server/verify.mjs';
import { StorageAdapter } from '../server/storage.mjs';
import { digest, json } from '../server/protocol.mjs';
import { validateTask } from '../agent/review-service.mjs';

const configured = () => configuration({ CAREER_ENABLE_TRANSACTIONS: '1', CAREER_MANAGER_PRIVATE_KEY: Wallet.createRandom().privateKey, CAREER_PROFESSOR_AGENT_ID: '1', CAREER_PROFESSOR_URL: 'https://one.example', CAREER_ANTISOCIAL_AGENT_ID: '2', CAREER_ANTISOCIAL_URL: 'https://two.example', CAREER_NEARMISS_AGENT_ID: '3', CAREER_NEARMISS_URL: 'https://three.example' });
test('server accepts the approved legacy Router key without returning it to the browser', () => {
  const config = configuration({ VITE_ZG_ROUTER_API_KEY: '  fixture-legacy-secret  ' });
  assert.equal(config.routerKey, 'fixture-legacy-secret');
  assert.equal(configuration({ ZG_ROUTER_API_KEY: 'fixture-server-secret', VITE_ZG_ROUTER_API_KEY: 'fixture-legacy-secret' }).routerKey, 'fixture-server-secret');
  assert.equal(configuration({ ZG_ROUTER_API_KEY: ' ', VITE_ZG_ROUTER_API_KEY: 'fixture-legacy-secret' }).routerKey, 'fixture-legacy-secret');
  const store = new Store(':memory:');
  assert.equal(JSON.stringify(new Career(store, config).summary()).includes('fixture-legacy-secret'), false);
  store.close();
});
test('configuration is closed by default, never claims identities exist', () => {
  const store = new Store(':memory:'); const career = new Career(store, configuration({}));
  assert.equal(career.readiness().ready, false);
  assert.throws(() => career.create('seed'), /尚未/);
  assert.equal(career.summary().jobs.length, 0); store.close();
});
test('seed precedes live work, duplicate jobs are blocked and seed retains identity', () => {
  const store = new Store(':memory:'); const career = new Career(store, configured());
  assert.throws(() => career.create('live'), /種子/);
  const seed = career.create('seed');
  assert.equal(seed.works.length, 1); assert.equal(seed.model, career.config.modelA);
  assert.throws(() => career.create('seed'), /恢復/);
  seed.status = 'completed'; seed.works[0].record = { worker: { agentId: '1' } }; store.put(seed);
  const job = career.create('live');
  assert.equal(job.works.length, 3); assert.equal(job.model, career.config.modelB);
  assert.notEqual(job.model, seed.model); store.close();
});
test('duplicate agent identities cannot masquerade as three independent workers', () => {
  const config = configured(); config.workers[1].agentId = config.workers[0].agentId;
  const store = new Store(':memory:'); const career = new Career(store, config);
  assert.equal(career.readiness().ready, false); store.close();
});
test('a pending signed payment is persisted before broadcast and never signed again', async () => {
  const store = new Store(':memory:'), signer = Wallet.createRandom(), target = Wallet.createRandom().address;
  let signing = 0, broadcasts = 0, confirmed = false;
  const provider = { getTransactionReceipt: async () => confirmed ? { status: 1 } : null, broadcastTransaction: async () => { broadcasts++; throw new Error('connection dropped'); }, getTransaction: async () => null };
  const wallet = new JournaledWallet(provider, '', store);
  wallet.wallet = { address: signer.address, populateTransaction: async tx => ({ ...tx, nonce: 0, gasLimit: 30000 }), signTransaction: async tx => { signing++; return signer.signTransaction(tx); } };
  const request = { to: target, value: 1000n, data: '0x' };
  await assert.rejects(wallet.send('work:payment', request), /狀態未知/);
  const saved = store.getTransaction('work:payment'); assert.ok(saved.raw);
  assert.equal(Transaction.from(saved.raw).to, target);
  confirmed = true;
  await wallet.send('work:payment', request);
  assert.equal(signing, 1); assert.equal(broadcasts, 1);
  await assert.rejects(wallet.send('work:payment', { ...request, value: 2000n }), /不符/); store.close();
});
test('unsigned evidence fails instead of producing a green badge', async () => {
  const result = await verifyBundle({ record: { schema: 'fake' } });
  assert.equal(result.ok, false); assert.equal(result.checks[0].status, 'failed');
});
test('Storage computes deterministic Merkle roots for exact record bytes', async () => {
  const storage = new StorageAdapter();
  const a = await storage.root({ schema: 'unit-test', value: 1 });
  const b = await storage.root({ schema: 'unit-test', value: 1 });
  const c = await storage.root({ schema: 'unit-test', value: 2 });
  assert.equal(a.rootHash, b.rootHash); assert.notEqual(a.rootHash, c.rootHash);
});
test('HTTP API rejects cross-origin and missing CSRF tokens', async () => {
  const store = new Store(':memory:'); const server = createCareerServer(new Career(store, configuration({})));
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    const status = await fetch(`${base}/api/career`).then(r => r.json());
    assert.equal(status.ready, false); assert.equal(status.token.length, 64);
    const noToken = await fetch(`${base}/api/jobs`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
    assert.equal(noToken.status, 400);
    const crossOrigin = await fetch(`${base}/api/jobs`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Career-Token': status.token, Origin: 'https://attacker.example' }, body: '{}' });
    assert.equal(crossOrigin.status, 400);
    const noConsent = await fetch(`${base}/api/jobs`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Career-Token': status.token }, body: '{"kind":"seed"}' });
    assert.equal(noConsent.status, 400); assert.equal(store.list().length, 0);
    const wav = await fetch(`${base}/api/music.wav`); assert.equal(wav.headers.get('content-type'), 'audio/wav'); assert.equal((await wav.arrayBuffer()).byteLength, 480044);
  } finally { server.close(); await once(server, 'close'); store.close(); }
});
test('worker does not accept arbitrary external prompts or unsigned paid requests', async () => {
  const wallet = Wallet.createRandom();
  const body = json({ manager: wallet.address, workerKey: 'professor', music: { notes: 'attacker text' } });
  assert.throws(() => validateTask(JSON.parse(body), body, '0x', { manager: wallet.address }), /signature|invalid/i);
  assert.notEqual(digest(body), digest(`${body} `));
});
