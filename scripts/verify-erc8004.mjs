import { compileContracts } from './compile-contracts.mjs';
import { inspectManager, publicProvider } from '../src/services/onchain.ts';

try {
  const [manager, url] = process.argv.slice(2);
  if (!manager || !url) throw new Error('Usage: npm run verify:erc8004 -- MANAGER_ADDRESS MANIFEST_URL');
  const source = new URL(url);
  if (source.protocol !== 'https:' && source.hostname !== '127.0.0.1' && source.hostname !== 'localhost') throw new Error('Use HTTPS or a local development URL');
  const response = await fetch(source, { redirect: 'error', signal: AbortSignal.timeout(15000) });
  if (!response.ok) throw new Error(`Manifest HTTP ${response.status}`);
  const manifest = await response.json();
  manifest.contracts = await compileContracts();
  const verified = await inspectManager(publicProvider, manager, manifest);
  console.log(JSON.stringify({ ok: true, scope: 'ERC-8004 identity, artifact hashes, canonical feedback, and contract-enforced native rewards', ...verified }, null, 2));
} catch (error) { console.error(JSON.stringify({ ok: false, error: error.shortMessage || error.message })); process.exitCode = 1; }
