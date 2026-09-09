import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { AbiCoder, Contract, ContractFactory, JsonRpcProvider, Wallet, keccak256, parseEther, toUtf8Bytes } from 'ethers';
import { compileContracts } from './compile-contracts.mjs';

const [siteUrlRaw, resumeFile] = process.argv.slice(2);
if (!siteUrlRaw) {
  console.error('Usage: npm run deploy:galileo -- https://your-site.vercel.app [resume.json]');
  process.exit(1);
}
const siteUrl = new URL(siteUrlRaw.replace(/\/$/, '') + '/');
if (siteUrl.protocol !== 'https:' && siteUrl.hostname !== '127.0.0.1' && siteUrl.hostname !== 'localhost') {
  console.error('Site URL must be HTTPS or local');
  process.exit(1);
}

const rpc = process.env.ZG_RPC_URL || 'https://evmrpc-testnet.0g.ai';
const provider = new JsonRpcProvider(rpc, 16602, { staticNetwork: true });
const privateKey = process.env.CAREER_OWNER_PRIVATE_KEY;
if (!privateKey || privateKey.length < 64) {
  console.error('Please set CAREER_OWNER_PRIVATE_KEY (and optionally ZG_RPC_URL)');
  process.exit(1);
}
const owner = new Wallet(privateKey, provider);
const publicDir = new URL('../public/', import.meta.url);
const root = new URL('../', import.meta.url);

async function loadSnapshot() {
  const snapshot = JSON.parse(await readFile(new URL('demo-records.json', publicDir), 'utf8'));
  if (snapshot.status !== 'completed' || snapshot.entries.length !== 3) throw new Error('Run npm run build:demo with real reviews first');
  const workers = snapshot.workers.map(worker => {
    const entry = snapshot.entries.find(item => item.worker === worker.key);
    if (!entry) throw new Error('Missing entry for worker ' + worker.key);
    return { key: worker.key, name: worker.name, title: worker.title, model: entry.model, requestId: entry.requestId, review: entry.review, rawContent: entry.rawContent, receivedAt: entry.receivedAt, billedCost0G: entry.billedCost0G, contentHash: entry.contentHash, router: snapshot.router, routerTeeVerified: entry.routerTeeVerified, input: snapshot.music };
  });
  const records = workers.map(worker => ({ schema: 'verifiable-agent-career/work-v1', job: 'Music Jury #031', agent: worker.name, role: worker.title, workerKey: worker.key, model: worker.model, source: '0G Compute Router', router: worker.router, requestId: worker.requestId, receivedAt: worker.receivedAt, input: worker.input, review: worker.review, rawContent: worker.rawContent, contentHash: worker.contentHash, routerVerification: worker.routerTeeVerified, billedCost0G: worker.billedCost0G }));
  const jsonText = records.map(record => JSON.stringify(record, null, 2));
  const hashes = jsonText.map(text => keccak256(toUtf8Bytes(text)));
  const jobHash = keccak256(AbiCoder.defaultAbiCoder().encode(['bytes32[3]', 'string'], [hashes, records[0].model]));
  const version = jobHash.slice(2);
  const recordURIs = workers.map((_, i) => new URL(`records/${version}/${workers[i].key}.json`, siteUrl).href);
  const agentURIs = workers.map((_, i) => new URL(`agents/${version}/${workers[i].key}.json`, siteUrl).href);
  return { snapshot, workers, records, jsonText, hashes, jobHash, version, recordURIs, agentURIs, model: records[0].model };
}

async function ensureFiles({ version, jsonText, workers }) {
  for (let i = 0; i < workers.length; i++) {
    const recordFile = new URL(`records/${version}/${workers[i].key}.json`, publicDir);
    const agentFile = new URL(`agents/${version}/${workers[i].key}.json`, publicDir);
    await mkdir(dirname(fileURLToPath(recordFile)), { recursive: true });
    await mkdir(dirname(fileURLToPath(agentFile)), { recursive: true });
    if (resumeFile) continue;
    await writeFile(recordFile, jsonText[i]);
    const profile = JSON.stringify({ type: 'https://eips.ethereum.org/EIPS/eip-8004#registration-v1', name: workers[i].name, description: `${workers[i].title} — Verifiable Agent Career Network / 0G Music Jury`, supportedTrust: ['reputation'], x_career: { job: 'Music Jury #031', model: workers[i].model, recordPath: `records/${version}/${workers[i].key}.json`, artifactHash: keccak256(toUtf8Bytes(jsonText[i])) } }, null, 2);
    await writeFile(agentFile, profile);
  }
}

async function gasSettings() {
  const price = await provider.send('eth_gasPrice', []);
  const gasPrice = BigInt(price) > 2000000000n ? BigInt(price) : 2000000000n;
  return { gasPrice };
}

function explorer(type, value) { return `https://chainscan-galileo.0g.ai/${type}/${value}`; }

const receipt = resumeFile ? JSON.parse(await readFile(resumeFile, 'utf8')) : {};
const contracts = receipt.contracts || await compileContracts();
const context = receipt.context || await loadSnapshot();
await ensureFiles(context);

if (!receipt.deploymentHash) {
  const balance = await provider.getBalance(owner.address);
  const factory = new ContractFactory(contracts.CareerJury.abi, contracts.CareerJury.bytecode, owner);
  const deployTx = await factory.getDeployTransaction(context.agentURIs, context.recordURIs, context.hashes, context.jobHash, context.model);
  const estimate = await provider.estimateGas({ ...deployTx, from: owner.address });
  const gas = estimate * 130n / 100n;
  const { gasPrice } = await gasSettings();
  const tx = await factory.deploy(context.agentURIs, context.recordURIs, context.hashes, context.jobHash, context.model, { gasLimit: gas, gasPrice });
  const deployed = await tx.waitForDeployment();
  receipt.manager = await deployed.getAddress();
  receipt.deploymentHash = deployed.deploymentTransaction().hash;
  receipt.context = context;
  receipt.contracts = contracts;
  receipt.deployedAt = new Date().toISOString();
}

if (!receipt.settlementHash) {
  const manager = new Contract(receipt.manager, contracts.CareerJury.abi, owner);
  const { gasPrice } = await gasSettings();
  const settleTx = await manager.settle({ value: parseEther('0.003'), gasPrice });
  const mined = await settleTx.wait();
  receipt.settlementHash = mined.hash;
  receipt.settledAt = new Date().toISOString();
}

const output = new URL('../.career-local/deploy-galileo.json', import.meta.url);
await mkdir(dirname(fileURLToPath(output)), { recursive: true });
await writeFile(output, JSON.stringify(receipt, null, 2));

console.log(JSON.stringify({
  network: '0G Galileo Testnet',
  chainId: 16602,
  owner: owner.address,
  manager: receipt.manager,
  deploymentHash: receipt.deploymentHash,
  deploymentExplorer: explorer('tx', receipt.deploymentHash),
  managerExplorer: explorer('address', receipt.manager),
  settlementHash: receipt.settlementHash,
  settlementExplorer: explorer('tx', receipt.settlementHash),
  totalReward: '0.003 0G',
  workerCount: 3,
  jobHash: context.jobHash,
  model: context.model,
  artifacts: context.recordURIs,
  saved: fileURLToPath(output)
}, null, 2));
provider.destroy();
