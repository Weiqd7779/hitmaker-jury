import { build } from 'vite';
import { readFile, writeFile, mkdir, cp } from 'node:fs/promises';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Store } from '../server/store.mjs';
import { Presentation } from '../server/presentation.mjs';
import { fixedAudio, json, requireValue } from '../server/protocol.mjs';
import { publication } from '../server/publication.mjs';
import { compileContracts } from './compile-contracts.mjs';

const store = new Store();
try {
  const saved = store.presentation();
  requireValue(saved?.status === 'completed' && saved.entries.length === 3 && saved.entries.every(entry => entry.status === 'completed' && entry.review), '請先取得三位對應角色的真實評論');
  const snapshot = new Presentation(store, { key: '', base: saved.router, model: saved.requestedModel }).summary();
  snapshot.readOnly = true; snapshot.token = ''; snapshot.keyConfigured = false;
  snapshot.notice = 'Real 0G Router deliveries. Story examples are labeled. ERC-8004 registration, feedback and settlement use user-confirmed MetaMask transactions.';
  const contracts = await compileContracts();
  let deployment = null;
  try {
    const receipt = JSON.parse(await readFile(new URL('../.career-local/deploy-galileo.json', import.meta.url), 'utf8'));
    if (receipt.manager && receipt.deploymentHash && receipt.settlementHash) deployment = receipt;
  } catch { /* no on-chain deployment yet */ }
  if (deployment) {
    snapshot.chain = { network: '0G Galileo Testnet', chainId: 16602, manager: deployment.manager, owner: deployment.owner, deploymentHash: deployment.deploymentHash, settlementHash: deployment.settlementHash };
    snapshot.chainTransactions = 'confirmed on Galileo';
  }
  const data = json(snapshot);
  requireValue(!/(?:sk-|mk-)[A-Za-z0-9_-]{8,}|PRIVATE_KEY|Bearer /.test(data), '請檢查公開資料中的敏感欄位');
  const output = publication(snapshot, contracts, deployment);
  for (let i = 0; i < 3; i++) {
    for (const [path, value, isRecord] of [[output.manifest.workers[i].recordPath, output.jsonText[i], true], [output.manifest.workers[i].agentPath, output.profiles[i], false]]) {
      const target = new URL(`../public/${path}`, import.meta.url);
      await mkdir(dirname(fileURLToPath(target)), { recursive: true });
      await writeFile(target, isRecord ? value : json(value));
    }
  }
  await writeFile(new URL('../public/demo-records.json', import.meta.url), data);
  await build({ root: fileURLToPath(new URL('../', import.meta.url)), base: './', publicDir: false, define: { 'import.meta.env.PUBLIC_READ_ONLY_DEMO': JSON.stringify('true') }, build: { outDir: 'dist-demo', emptyOutDir: true } });
  await mkdir(new URL('../dist-demo/chain/', import.meta.url), { recursive: true });
  const reviewsPayload = JSON.stringify(output.records, null, 2);
  await writeFile(new URL('../dist-demo/chain/manifest.json', import.meta.url), json(output.manifest));
  await writeFile(new URL('../public/jury-real-reviews.json', import.meta.url), reviewsPayload);
  await writeFile(new URL('../dist-demo/presentation.json', import.meta.url), data);
  await writeFile(new URL('../dist-demo/jury-real-reviews.json', import.meta.url), reviewsPayload);
  await writeFile(new URL('../dist-demo/demo.wav', import.meta.url), fixedAudio());
  await cp(new URL('../public/records/', import.meta.url), new URL('../dist-demo/records/', import.meta.url), { recursive: true });
  await cp(new URL('../public/agents/', import.meta.url), new URL('../dist-demo/agents/', import.meta.url), { recursive: true });
  console.log(JSON.stringify({ directory: 'dist-demo', jobHash: output.manifest.jobHash, model: output.manifest.model, workers: output.manifest.workers.map(worker => worker.name), inference: 'saved responses', signing: 'MetaMask only' }));
} finally { store.close(); }
