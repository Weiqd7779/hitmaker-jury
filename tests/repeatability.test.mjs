import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { Wallet, getBytes } from 'ethers';
import { Store } from '../server/store.mjs';
import { Career, configuration } from '../server/career.mjs';
import { createReviewServer } from '../agent/review-service.mjs';
import { WORKERS, MUSIC, json, digest } from '../server/protocol.mjs';

function configured() {
  return configuration({ CAREER_ENABLE_TRANSACTIONS: '1', CAREER_MANAGER_PRIVATE_KEY: Wallet.createRandom().privateKey, CAREER_PROFESSOR_AGENT_ID: '1', CAREER_PROFESSOR_URL: 'https://one.example', CAREER_ANTISOCIAL_AGENT_ID: '2', CAREER_ANTISOCIAL_URL: 'https://two.example', CAREER_NEARMISS_AGENT_ID: '3', CAREER_NEARMISS_URL: 'https://three.example' });
}
test('repeated create requests return the same job even after completion', () => {
  const store = new Store(':memory:'), career = new Career(store, configured()), requestId = randomUUID();
  const job = career.create('seed', requestId);
  assert.equal(career.create('seed', requestId).id, job.id);
  job.status = 'completed'; store.put(job);
  assert.equal(career.create('seed', requestId).id, job.id);
  assert.equal(store.list().length, 1); store.close();
});
test('a completed test session cannot silently exceed the configured paid-job quota', () => {
  const store = new Store(':memory:'), career = new Career(store, configured());
  const seed = career.create('seed'); seed.status = 'completed'; seed.works[0].record = { worker: { agentId: '1' } }; store.put(seed);
  const live = career.create('live'); live.status = 'completed'; store.put(live);
  assert.throws(() => career.create('live'), /上限/); store.close();
});
test('changing the Manager account cannot resume a previous account work item', async () => {
  const store = new Store(':memory:'), config = configured();
  const original = new Career(store, config), job = original.create('seed');
  const changed = new Career(store, { ...config, managerKey: Wallet.createRandom().privateKey });
  changed.provider.getNetwork = async () => { throw new Error('network access forbidden in this test'); };
  await assert.rejects(changed.run(job.id), /Manager|雇主/); store.close();
});
test('transaction journals cannot be overwritten or reverted to unconfirmed', () => {
  const store = new Store(':memory:');
  const first = { id: 'payment', raw: 'signed-one', hash: 'hash-one', confirmed: false };
  store.putTransaction(first);
  assert.throws(() => store.putTransaction({ ...first, raw: 'signed-two' }), /覆寫/);
  store.putTransaction({ ...first, confirmed: true }); store.putTransaction(first);
  assert.equal(store.getTransaction('payment').confirmed, true); store.close();
});
test('creation intents and transaction hashes survive database restart', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'jury-store-restart-'));
  try {
    const path = join(directory, 'career.sqlite'), config = configured(), requestId = randomUUID();
    const first = new Store(path), career = new Career(first, config), job = career.create('seed', requestId);
    first.putTransaction({ id: 'payment', raw: 'signed-one', hash: 'hash-one', confirmed: false }); first.close();
    const second = new Store(path);
    assert.equal(new Career(second, config).create('seed', requestId).id, job.id);
    assert.equal(second.getTransaction('payment').hash, 'hash-one'); second.close();
  } finally { await rm(directory, { recursive: true }); }
});
test('a Worker restart after ambiguous inference failure never automatically charges again', async () => {
  const cacheDir = await mkdtemp(join(tmpdir(), 'jury-repeat-'));
  const manager = Wallet.createRandom(), seal = Wallet.createRandom();
  const config = { manager: manager.address, seal: seal.address, worker: WORKERS[0], models: ['model-a', 'model-b'], cacheDir };
  const input = { jobId: randomUUID(), kind: 'seed', manager: manager.address, workerKey: 'professor', model: 'model-a', payee: seal.address, amount: '0.001', music: MUSIC };
  let calls = 0;
  const invoke = async body => {
    const server = createReviewServer(config, async () => { calls++; throw new Error('upstream charged, connection lost'); });
    server.listen(0, '127.0.0.1'); await once(server, 'listening');
    try {
      return await fetch(`http://127.0.0.1:${server.address().port}/api/review`, { method: 'POST', headers: { 'X-Jury-Authorization': await manager.signMessage(getBytes(digest(body))) }, body }).then(async r => ({ status: r.status, body: await r.json() }));
    } finally { server.close(); await once(server, 'close'); }
  };
  try {
    await invoke(json(input));
    const repeated = await invoke(json(input));
    assert.equal(repeated.status, 409); assert.equal(calls, 1);
    await invoke(json({ ...input, model: 'model-b' }));
    assert.equal(calls, 1);
  } finally { await rm(cacheDir, { recursive: true }); }
});
