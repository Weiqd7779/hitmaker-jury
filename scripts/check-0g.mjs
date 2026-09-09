import { providerFor, checkDomain } from '../server/chain.mjs';
import { DOMAIN, ROUTER, json } from '../server/protocol.mjs';
import { COMPUTE_CONTRACT } from '../server/compute.mjs';

const results = [];
async function check(name, fn) {
  try { results.push({ name, ok: true, result: await fn() }); }
  catch (error) { results.push({ name, ok: false, error: error.shortMessage || error.message }); }
}
const chain = providerFor();
await check('Galileo registry bindings', async () => { await checkDomain(chain); return { blockNumber: await chain.getBlockNumber(), ...DOMAIN }; });
await check('Router model catalog', async () => {
  const res = await fetch(`${ROUTER}/models`, { signal: AbortSignal.timeout(15000), redirect: 'error' });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  if (!Array.isArray(data.data) || !data.data.length) throw new Error('Empty catalog');
  return data.data.filter(model => model.verifiability === 'TeeML').map(model => ({ id: model.id, verifiability: model.verifiability }));
});
const compute = providerFor('https://evmrpc.0g.ai');
await check('Compute service registry', async () => {
  if (Number((await compute.getNetwork()).chainId) !== 16661) throw new Error('Wrong Compute chain');
  if ((await compute.getCode(COMPUTE_CONTRACT)) === '0x') throw new Error('No contract code');
  return { contract: COMPUTE_CONTRACT, chainId: 16661 };
});
console.log(json({ ok: results.every(result => result.ok), checks: results, scope: 'Public read-only connectivity only; no inference, deployment, upload or transaction was performed.' }));
process.exitCode = results.every(result => result.ok) ? 0 : 1;
chain.destroy(); compute.destroy();
