import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { Wallet } from 'ethers';
import { Store } from '../server/store.mjs';
import { Career, configuration } from '../server/career.mjs';
import { createCareerServer } from '../server/index.mjs';
import { Presentation, presentationConfig } from '../server/presentation.mjs';

const cfg = { key: 'fixture-secret-not-a-real-key', base: 'https://router-api-testnet.integratenetwork.work/v1', model: 'qwen2.5-omni' };
const model = { id: cfg.model, type: 'chatbot', pricing: { prompt: '1190000000000', completion: '4770000000000' }, pricing_usd: { prompt: '0.000000175', completion: '0.0000007' } };
const reply = data => new Response(JSON.stringify(data), { headers: { 'Content-Type': 'application/json' } });
function fakeRouter(onRequest = () => {}) {
  return async (url, options) => {
    if (url.endsWith('/models')) return reply({ data: [model] });
    const body = JSON.parse(options.body); onRequest(body, options.headers);
    return reply({ id: 'test-request', model: cfg.model, choices: [{ message: { content: JSON.stringify({ score: 70, headline: 'Test fixture', critique: 'Not real inference' }) } }], x_0g_trace: { tee_verified: true, billing: { total_cost: '1000000000000' } } });
  };
}
test('legacy key stays paired with its configured testnet Router', () => {
  const env = { VITE_ZG_ROUTER_API_KEY: cfg.key, VITE_ZG_ROUTER_URL: cfg.base };
  assert.equal(presentationConfig(env).base, cfg.base);
  assert.equal(presentationConfig(env).model, cfg.model);
  assert.equal(presentationConfig({ ...env, ZG_ROUTER_API_KEY: 'new-server-key' }).base, 'https://router-api.0g.ai/v1');
  assert.throws(() => presentationConfig({ ...env, ZG_ROUTER_URL: 'http://localhost:9000/v1' }), /允許清單/);
});
test('three real-response slots are obtained once, cached, and separate from on-chain careers', async () => {
  const store = new Store(':memory:'); let calls = 0;
  const service = new Presentation(store, cfg, fakeRouter((request, headers) => { calls++; assert.equal(request.max_tokens, 400); assert.equal(headers['X-0G-Provider-Allow-Fallbacks'], 'false'); }));
  assert.equal(service.summary().attempts, 0);
  assert.equal((await service.generate()).status, 'completed');
  assert.equal(service.summary().entries.length, 3);
  await service.generate(); await new Presentation(store, cfg, fakeRouter(() => calls++)).generate();
  assert.equal(calls, 3); assert.equal(store.list().length, 0);
  assert.equal(JSON.stringify(service.summary()).includes(cfg.key), false);
  store.close();
});
test('parallel starts still dispatch only three inference requests', async () => {
  const store = new Store(':memory:'); let calls = 0;
  const a = new Presentation(store, cfg, fakeRouter(() => calls++));
  const b = new Presentation(store, cfg, fakeRouter(() => calls++));
  await Promise.all([a.generate(), b.generate()]); assert.equal(calls, 3); store.close();
});
test('authentication failure stops after one attempt and never retries automatically', async () => {
  const store = new Store(':memory:'); let calls = 0;
  const service = new Presentation(store, cfg, async url => url.endsWith('/models') ? reply({ data: [model] }) : (calls++, new Response('{}', { status: 401 })));
  assert.equal((await service.generate()).status, 'blocked'); await service.generate();
  assert.equal(calls, 1); assert.equal(service.summary().attempts, 1); store.close();
});
test('expensive catalog pricing is rejected before inference', async () => {
  const store = new Store(':memory:'); let calls = 0;
  const service = new Presentation(store, cfg, async url => { if (!url.endsWith('/models')) calls++; return reply({ data: [{ ...model, pricing: { prompt: '1000000000000000000', completion: '1000000000000000000' } }] }); });
  assert.equal((await service.generate()).status, 'blocked'); assert.equal(calls, 0); store.close();
});
test('unknown response failures consume an attempt but never cause another paid dispatch', async () => {
  const store = new Store(':memory:'); let calls = 0;
  const service = new Presentation(store, cfg, async url => { if (url.endsWith('/models')) return reply({ data: [model] }); calls++; throw new Error('connection lost'); });
  await service.generate(); await new Presentation(store, cfg, fakeRouter(() => calls++)).generate();
  assert.equal(calls, 1); assert.equal(service.summary().status, 'blocked'); store.close();
});
test('wallet challenge verifies ownership without transactions and rejects replay', async () => {
  const store = new Store(':memory:'), server = createCareerServer(new Career(store, configuration({}))), wallet = Wallet.createRandom();
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    const state = await fetch(`${base}/api/presentation`).then(r => r.json());
    const post = (path, data) => fetch(base + path, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Career-Token': state.token }, body: JSON.stringify(data) });
    assert.equal((await post('/api/wallet/challenge', { address: wallet.address, chainId: 1 })).status, 400);
    const challenge = await post('/api/wallet/challenge', { address: wallet.address, chainId: 16602 }).then(r => r.json());
    assert.match(challenge.message, /NOT a transaction/);
    const signature = await wallet.signMessage(challenge.message);
    const result = await post('/api/wallet/verify', { id: challenge.id, signature }).then(r => r.json());
    assert.equal(result.verified, true);
    assert.equal((await post('/api/wallet/verify', { id: challenge.id, signature })).status, 400);
    assert.equal((await post('/api/presentation/generate', {})).status, 400);
    assert.equal(store.list().length, 0); assert.equal(store.pendingTransactions().length, 0);
  } finally { server.close(); await once(server, 'close'); store.close(); }
});
