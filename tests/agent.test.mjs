import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { Wallet, getBytes } from 'ethers';
import { createReviewServer } from '../agent/review-service.mjs';
import { WORKERS, MUSIC, json, digest } from '../server/protocol.mjs';

test('sealed service backend authenticates fixed tasks and caches retries without minting fake proof headers', async () => {
  const manager = Wallet.createRandom(), seal = Wallet.createRandom();
  const directory = await mkdtemp(join(tmpdir(), 'jury-agent-test-'));
  let calls = 0;
  const server = createReviewServer({ manager: manager.address, seal: seal.address.toLowerCase(), worker: WORKERS[0], models: ['model-a'], cacheDir: directory }, async input => { calls++; return { model: input.model, review: { critique: 'Test fixture' } }; });
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  const url = `http://127.0.0.1:${server.address().port}/api/review`;
  const input = { jobId: randomUUID(), kind: 'seed', manager: manager.address, workerKey: 'professor', model: 'model-a', payee: seal.address, amount: '0.001', music: MUSIC };
  const body = json(input), signature = await manager.signMessage(getBytes(digest(body)));
  try {
    const unsigned = await fetch(url, { method: 'POST', body });
    assert.equal(unsigned.status, 400); assert.equal(calls, 0);
    for (let i = 0; i < 2; i++) {
      const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Jury-Authorization': signature }, body });
      assert.equal(response.status, 200); assert.equal(response.headers.get('X-Agent-Proof'), null);
      assert.equal((await response.json()).model, 'model-a');
    }
    assert.equal(calls, 1);
    const changed = json({ ...input, model: 'not-allowed' });
    const altered = await fetch(url, { method: 'POST', headers: { 'X-Jury-Authorization': await manager.signMessage(getBytes(digest(changed))) }, body: changed });
    assert.equal(altered.status, 400); assert.equal(calls, 1);
    const lost = json({ ...input, jobId: randomUUID() });
    const cacheMiss = await fetch(url, { method: 'POST', headers: { 'X-Jury-Authorization': await manager.signMessage(getBytes(digest(lost))), 'X-Jury-Cache-Only': '1' }, body: lost });
    assert.equal(cacheMiss.status, 409); assert.equal(calls, 1);
  } finally { server.close(); await once(server, 'close'); await rm(directory, { recursive: true }); }
});
