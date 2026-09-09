import { Contract, Wallet, formatEther } from 'ethers';
import { checkDomain, providerFor, readIdentity } from '../server/chain.mjs';
import { configuration } from '../server/career.mjs';
import { DOMAIN, json, sameAddress, requireValue } from '../server/protocol.mjs';

const rpc = providerFor();
try {
  const cfg = await fetch('https://agenticid.0g.ai/config', { signal: AbortSignal.timeout(15000), redirect: 'error' }).then(r => { if (!r.ok) throw new Error(`Attestor HTTP ${r.status}`); return r.json(); });
  requireValue(cfg.chain_id === 16602 && sameAddress(cfg.agentic_id_addr, DOMAIN.identity) && sameAddress(cfg.verified_feedback_addr, DOMAIN.verified), 'Attestor 部署已變更，停止配置');
  await checkDomain(rpc);
  const account = name => {
    const key = process.env[name];
    if (!key) return null;
    try { return new Wallet(key).address; } catch { throw new Error(`${name} 格式無效（不顯示內容）`); }
  };
  const owner = account('CAREER_OWNER_PRIVATE_KEY'), manager = account('CAREER_MANAGER_PRIVATE_KEY');
  requireValue(!owner || !manager || !sameAddress(owner, manager), 'Owner 與 Manager 必須是不同帳戶');
  const serving = new Contract(cfg.sandbox_serving_addr, [
    'function services(address) view returns(string url,string appId,uint256 pricePerCPUPerMin,uint256 pricePerMemGBPerMin,uint256 createFee)',
    'function getBalance(address,address) view returns(uint256 balance,uint256 pendingRefund,uint256 refundUnlockAt)',
  ], rpc);
  const pricing = await serving.services(cfg.sandbox_provider_addr);
  const config = configuration();
  const workers = [];
  for (const worker of config.workers) {
    if (!worker.agentId) { workers.push({ role: worker.key, configured: false, action: '尚未部署／綁定；不要每次測試重新 mint' }); continue; }
    const identity = await readIdentity(rpc, worker.agentId);
    workers.push({ role: worker.key, configured: true, agentId: worker.agentId, seal: identity.seal, owner: identity.owner, ownerMatches: owner ? sameAddress(owner, identity.owner) : null, managerIsOwner: manager ? sameAddress(manager, identity.owner) : null });
  }
  const balances = {};
  if (owner) {
    balances.ownerGas0G = formatEther(await rpc.getBalance(owner));
    balances.sandboxPrepaid0G = formatEther((await serving.getBalance(owner, cfg.sandbox_provider_addr)).balance);
  }
  if (manager) balances.managerGas0G = formatEther(await rpc.getBalance(manager));
  console.log(json({ scope: 'read-only preflight; no deployment, inference, upload or transaction', accounts: { owner, manager }, credentials: { ownerConfigured: Boolean(owner), managerConfigured: Boolean(manager), serverRouterKeyConfigured: Boolean(config.routerKey), legacyBrowserRouterKeyPresent: Boolean(process.env.VITE_ZG_ROUTER_API_KEY) }, balances, workers, paidJobLimit: config.maxLiveJobs,
    sandboxPricing: { chainId: 16602, createPerAgent0G: formatEther(pricing.createFee), createThreeAgents0G: formatEther(pricing.createFee * 3n), threeAgentsPerMinuteAssuming2CPU4GB0G: formatEther(3n * (pricing.pricePerCPUPerMin * 2n + pricing.pricePerMemGBPerMin * 4n)), excludes: 'mint gas, iData sync, storage, Worker rewards, Router inference' },
    lifecycle: '部署一次並保存 agentId/sealId；排練使用已保存證據；不工作時 stop，恢復時 start；不要為了清畫面 reset/redeploy；cache 必須在已確認可持久化的路徑。',
  }));
} catch (error) {
  console.error(json({ ok: false, error: String(error.shortMessage || error.message).replace(/(?:sk-|mk-)[A-Za-z0-9_-]+|0x[0-9a-fA-F]{64}/g, '[redacted]') })); process.exitCode = 1;
} finally { rpc.destroy(); }
