import { Interface, getAddress, keccak256, parseEther, toQuantity, toUtf8Bytes } from 'ethers';

export type RpcProvider = { request(input: { method: string; params?: unknown[] }): Promise<any>; on?: (name: string, listener: (...args: any[]) => void) => void; removeListener?: (name: string, listener: (...args: any[]) => void) => void; isMetaMask?: boolean; providers?: RpcProvider[] };
export type ChainManifest = { schema: string; chainId: number; job: string; jobHash: string; model: string; totalRewardWei: string; workers: { key: string; name: string; title: string; artifactHash: string; recordPath: string; agentPath: string }[]; contracts: { identityRegistry: string; reputationRegistry: string; CareerJury: { abi: any[]; bytecode: string; runtimeHash: string }; CareerWorker: { abi: any[]; runtimeHash: string } } };
export type ChainState = { manager: string; owner: string; jobHash: string; model: string; settled: boolean; workers: { key: string; name: string; agentId: string; wallet: string; artifactURI: string; artifactHash: string; feedbackIndex: string; balanceWei: string; feedbackVerified: boolean }[] };
export const CHAIN_ID = 16602;
export const IDENTITY = '0x8004A818BFB912233c491871b3d84c89A494BD9e';
export const REPUTATION = '0x8004B663056A597Dffe9eCcC1965A193B7388713';
const identity = new Interface(['function ownerOf(uint256) view returns(address)', 'function tokenURI(uint256) view returns(string)', 'function getAgentWallet(uint256) view returns(address)']);
const reputation = new Interface(['function readFeedback(uint256,address,uint64) view returns(int128,uint8,string,string,bool)']);
const check = (condition: unknown, message: string) => { if (!condition) throw new Error(message); };
const equal = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();
export const publicProvider: RpcProvider = {
  async request({ method, params = [] }) {
    const response = await fetch('https://evmrpc-testnet.0g.ai', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }), signal: AbortSignal.timeout(20000) });
    const data = await response.json();
    if (!response.ok || data.error) throw new Error(data.error?.message || '請稍後重新查驗 Galileo');
    return data.result;
  },
};
export function validateManifest(manifest: ChainManifest) {
  check(manifest.schema === 'jury-erc8004-manifest-v1' && manifest.chainId === CHAIN_ID, '請使用 Galileo 工作資料');
  check(equal(manifest.contracts.identityRegistry, IDENTITY) && equal(manifest.contracts.reputationRegistry, REPUTATION), '請核對官方 Registry');
  check(manifest.workers.length === 3 && BigInt(manifest.totalRewardWei) === parseEther('0.003'), '請核對三位 Agent 與小額報酬');
  check(/^0x[0-9a-f]{64}$/i.test(manifest.jobHash) && /^0x[0-9a-f]+$/i.test(manifest.contracts.CareerJury.bytecode), '請重新載入工作資料');
}
export function deploymentData(manifest: ChainManifest, origin: string) {
  validateManifest(manifest);
  const url = new URL(origin);
  check(url.protocol === 'https:' || ['localhost', '127.0.0.1'].includes(url.hostname), '請使用 HTTPS 正式網址');
  const uri = (path: string) => new URL(path, url).href;
  const args = [manifest.workers.map(w => uri(w.agentPath)), manifest.workers.map(w => uri(w.recordPath)), manifest.workers.map(w => w.artifactHash), manifest.jobHash, manifest.model];
  return `${manifest.contracts.CareerJury.bytecode}${new Interface(manifest.contracts.CareerJury.abi).encodeDeploy(args).slice(2)}`;
}
export async function quoteTransaction(provider: RpcProvider, account: string, data: string, to?: string, value = 0n) {
  check(BigInt(await provider.request({ method: 'eth_chainId' })) === BigInt(CHAIN_ID), '請切換至 Galileo 測試網');
  const suggested = BigInt(await provider.request({ method: 'eth_gasPrice' }));
  const gasPrice = suggested < 2000000000n ? 2000000000n : suggested;
  check(gasPrice <= 5000000000n, '請在 Gas 價格回到 5 gwei 範圍時重試');
  const request = { from: getAddress(account), ...(to ? { to: getAddress(to) } : {}), data, value: toQuantity(value), gasPrice: toQuantity(gasPrice), chainId: toQuantity(CHAIN_ID) };
  const estimated = BigInt(await provider.request({ method: 'eth_estimateGas', params: [request] }));
  const gas = estimated * 120n / 100n + 10000n;
  const feeWei = gas * gasPrice, totalWei = feeWei + value;
  check(totalWei <= parseEther('0.01'), '本次預估超過 0.01 0G，請調整後再確認');
  const balance = BigInt(await provider.request({ method: 'eth_getBalance', params: [account, 'pending'] }));
  check(balance >= totalWei, '請補足本次畫面預估的 Gas 與報酬');
  return { request: { ...request, gas: toQuantity(gas) }, gas: gas.toString(), feeWei: feeWei.toString(), totalWei: totalWei.toString(), valueWei: value.toString() };
}
export async function receipt(provider: RpcProvider, hash: string) {
  check(/^0x[0-9a-f]{64}$/i.test(hash), '請輸入完整交易 Hash');
  const result = await provider.request({ method: 'eth_getTransactionReceipt', params: [hash] });
  if (!result) return null;
  check(BigInt(result.status) === 1n, '請檢查此筆交易的執行結果');
  return result;
}
export async function inspectManager(provider: RpcProvider, manager: string, manifest: ChainManifest, verifyArtifacts = true): Promise<ChainState> {
  validateManifest(manifest); manager = getAddress(manager);
  check(BigInt(await provider.request({ method: 'eth_chainId' })) === BigInt(CHAIN_ID), '請切換 Galileo 後查驗');
  const code = await provider.request({ method: 'eth_getCode', params: [manager, 'latest'] });
  check(keccak256(code) === manifest.contracts.CareerJury.runtimeHash, '請提供本版本的 Music Manager 合約');
  const face = new Interface(manifest.contracts.CareerJury.abi);
  const call = async (address: string, abi: Interface, name: string, args: unknown[] = []) => abi.decodeFunctionResult(name, await provider.request({ method: 'eth_call', params: [{ to: address, data: abi.encodeFunctionData(name, args) }, 'latest'] }));
  const owner = String((await call(manager, face, 'owner'))[0]);
  const jobHash = String((await call(manager, face, 'jobHash'))[0]);
  const model = String((await call(manager, face, 'model'))[0]);
  const settled = Boolean((await call(manager, face, 'settled'))[0]);
  check(jobHash === manifest.jobHash && model === manifest.model, '請載入此合約對應的模型與工作版本');
  const workers = [];
  for (let i = 0; i < 3; i++) {
    const wallet = String((await call(manager, face, 'workers', [i]))[0]), agentId = String((await call(manager, face, 'agentIds', [i]))[0]);
    const artifactHash = String((await call(manager, face, 'artifactHashes', [i]))[0]), artifactURI = String((await call(manager, face, 'artifactURIs', [i]))[0]);
    const feedbackIndex = String((await call(manager, face, 'feedbackIndexes', [i]))[0]);
    check(artifactHash === manifest.workers[i].artifactHash, '請核對交付內容的鏈上雜湊');
    check(equal(String((await call(IDENTITY, identity, 'ownerOf', [agentId]))[0]), wallet), '請核對 Agent ID 的持有人');
    check(equal(String((await call(IDENTITY, identity, 'getAgentWallet', [agentId]))[0]), wallet), '請核對 Agent 收款錢包');
    check(keccak256(await provider.request({ method: 'eth_getCode', params: [wallet, 'latest'] })) === manifest.contracts.CareerWorker.runtimeHash, '請核對 Agent 錢包程式');
    if (verifyArtifacts) {
      const uri = new URL(artifactURI);
      check(uri.protocol === 'https:' || ['127.0.0.1', 'localhost'].includes(uri.hostname), '請使用公開工作成果網址');
      const response = await fetch(uri.href, { redirect: 'error', signal: AbortSignal.timeout(15000) });
      check(response.ok, '請稍後重新下載工作成果');
      const text = await response.text();
      check(text.length < 100000 && keccak256(toUtf8Bytes(text)) === artifactHash, '請核對成果檔案與鏈上雜湊');
    }
    let feedbackVerified = false;
    if (settled) {
      const feedback = await call(REPUTATION, reputation, 'readFeedback', [agentId, manager, feedbackIndex]);
      check(feedback[0] === 1n && feedback[1] === 0n && feedback[2] === 'accepted' && feedback[3] === model && feedback[4] === false, '請核對目前有效的雇主評價');
      feedbackVerified = true;
    }
    workers.push({ key: manifest.workers[i].key, name: manifest.workers[i].name, agentId, wallet, artifactURI, artifactHash, feedbackIndex, balanceWei: String(BigInt(await provider.request({ method: 'eth_getBalance', params: [wallet, 'latest'] }))), feedbackVerified });
  }
  return { manager, owner, jobHash, model, settled, workers };
}
