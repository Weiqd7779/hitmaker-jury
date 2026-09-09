import { Contract, parseEther } from 'ethers';
import { DOMAIN, json, digest, inspectService, sameAddress, requireValue, paymentData } from './protocol.mjs';
import { checkDomain, readIdentity, confirmedTransaction, canonicalABI, canonicalInterface, verifiedInterface, verifiedABI, providerFor } from './chain.mjs';
import { StorageAdapter } from './storage.mjs';
import { verifyCompute } from './compute.mjs';

export async function verifyBundle(bundle, dependencies = {}) {
  const provider = dependencies.provider || providerFor();
  const storage = dependencies.storage || new StorageAdapter();
  const compute = dependencies.compute || verifyCompute;
  const checks = [];
  const step = async (key, fn) => {
    try { const detail = await fn(); checks.push({ key, status: 'passed', detail: detail || '核對通過' }); return detail; }
    catch (error) {
      const detail = error.shortMessage || error.message;
      const unavailable = ['NETWORK_ERROR', 'TIMEOUT', 'SERVER_ERROR'].includes(error.code) || /fetch failed|timeout|timed out|socket|暫時無法查詢|RPC|missing trie|historical state/i.test(detail);
      checks.push({ key, status: unavailable ? 'unavailable' : 'failed', detail }); return null;
    }
  };
  const record = bundle?.record;
  const schema = await step('record', async () => {
    requireValue(record?.schema === '0g-career-work-v1' && ['seed', 'live'].includes(record.kind), '不支援的工作紀錄格式');
    requireValue(json(record.domain) === json(DOMAIN), '不信任此合約部署；本驗證器只接受固定 Galileo 環境');
    requireValue(/^0x[0-9a-fA-F]{64}$/.test(bundle.storage?.rootHash), '缺少 Storage 證據');
    await checkDomain(provider);
    return '固定合約與 Galileo 網路已核對';
  });
  if (!schema) return { ok: false, checkedAt: new Date().toISOString(), checks };
  let identity;
  await step('identity', async () => {
    const block = await provider.getBlock(record.observedBlock.number);
    requireValue(block && block.hash === record.observedBlock.hash, '歷史區塊不存在或已改變');
    identity = await readIdentity(provider, record.worker.agentId, block.number);
    requireValue(sameAddress(identity.seal, record.worker.payee), '收款者不是當時 AgentSeal');
    requireValue(!sameAddress(identity.owner, record.manager), '雇主不能是 Worker owner');
    return `Agent #${record.worker.agentId}，歷史區塊 ${block.number}`;
  });
  let service;
  await step('service', async () => {
    requireValue(identity, '歷史身分尚未通過驗證');
    service = inspectService(record, identity.seal, { historical: true });
    requireValue(service.proof.dataHashes.every(h => identity.dataHashes.includes(h)), '歷史 Agent data 不符');
    const block = await provider.getBlock(record.observedBlock.number);
    requireValue(block.timestamp >= Number(service.proof.timestamp) - 120 && block.timestamp <= Number(service.proof.deadline), '觀測區塊未落在服務的合理有效期間');
    return service.expiredNow ? '歷史簽章與交付關聯有效；即時 proof 已過期，不可重複兌換' : '簽章、雇主、job、模型欄位與原始回應皆相符';
  });
  await step('compute', async () => {
    requireValue(service, '服務內容尚未通過驗證');
    const result = await compute(service.output, bundle.compute);
    return `供應商回應簽章已核對；模型 ${result.model}。不等同硬體 attestation 驗證。`;
  });
  await step('artifact', async () => {
    requireValue(Buffer.byteLength(json(record)) <= 1024 * 1024, '成果紀錄超過大小限制');
    const expected = await storage.root(record);
    requireValue(expected.rootHash === bundle.storage.rootHash, 'Storage rootHash 不是此成果的 Merkle root');
    const bytes = await storage.download(bundle.storage.rootHash);
    requireValue(bytes === json(record), 'Storage 成果與證據包不符');
    return '已重新下載成果並核對 Merkle proof 與完整原始內容';
  });
  await step('feedback', async () => {
    requireValue(service && bundle.feedback?.txHash && bundle.feedback?.attestTxHash, '缺少完整 feedback 證據');
    const { tx, receipt } = await confirmedTransaction(provider, bundle.feedback.txHash);
    requireValue(sameAddress(tx.to, DOMAIN.canonical) && sameAddress(tx.from, record.manager), 'feedback 提交者或合約錯誤');
    const decoded = canonicalInterface.parseTransaction({ data: tx.data });
    requireValue(decoded?.name === 'giveFeedback' && String(decoded.args[0]) === record.worker.agentId && decoded.args[7] === digest(record), 'feedback 未綁定此成果');
    requireValue(decoded.args[1] === 1n && decoded.args[2] === 0n && decoded.args[3] === 'accepted' && decoded.args[4] === record.worker.model, 'feedback 不是此模型的接受紀錄');
    requireValue(decoded.args[6] === `0g://storage/${bundle.storage.rootHash}`, 'feedback Storage 指標不符');
    const canonical = new Contract(DOMAIN.canonical, canonicalABI, provider);
    const index = BigInt(bundle.feedback.index);
    const before = await canonical.getLastIndex(record.worker.agentId, record.manager, { blockTag: receipt.blockNumber - 1 });
    const after = await canonical.getLastIndex(record.worker.agentId, record.manager, { blockTag: receipt.blockNumber });
    requireValue(after === before + 1n && index === after, '同區塊有多筆 feedback 或索引不符，無法唯一關聯');
    const entry = await canonical.readFeedback(record.worker.agentId, record.manager, index);
    requireValue(!entry[4] && entry[0] === 1n && entry[2] === 'accepted' && entry[3] === record.worker.model, 'feedback 已撤銷或內容不符');
    const attestation = await confirmedTransaction(provider, bundle.feedback.attestTxHash);
    requireValue(sameAddress(attestation.tx.to, DOMAIN.verified) && sameAddress(attestation.tx.from, record.manager), '驗證標記提交者錯誤');
    const event = attestation.receipt.logs.filter(log => sameAddress(log.address, DOMAIN.verified)).map(log => { try { return verifiedInterface.parseLog(log); } catch { return null; } }).find(e => e?.name === 'FeedbackVerified' && String(e.args.agentId) === record.worker.agentId && sameAddress(e.args.clientAddress, record.manager) && e.args.feedbackIndex === index);
    requireValue(event && event.args.taskHash === service.proof.taskHash && event.args.frameworkHash === service.proof.frameworkHash && json([...event.args.dataHashes]) === json(service.proof.dataHashes) && event.args.uri === '/api/review', '鏈上驗證事件與本次工作 proof 不符');
    const verified = new Contract(DOMAIN.verified, verifiedABI, provider);
    requireValue(await verified.isVerified(record.worker.agentId, record.manager, index), '鏈上沒有 proof-backed 標記');
    return '雇主接受紀錄、未撤銷 feedback 與 task-bound 驗證標記均存在';
  });
  await step('payment', async () => {
    requireValue(bundle.payment?.txHash, '缺少付款紀錄');
    const { tx } = await confirmedTransaction(provider, bundle.payment.txHash);
    requireValue(sameAddress(tx.from, record.manager) && sameAddress(tx.to, record.worker.payee), '付款雙方不符');
    requireValue(tx.value === parseEther(record.worker.amount) && tx.data === paymentData(record), '付款金額或工作承諾不符');
    return `${record.worker.amount} 0G 已付給此 Worker，交易綁定 job、模型與成果`;
  });
  return { ok: checks.length === 7 && checks.every(c => c.status === 'passed'), checkedAt: new Date().toISOString(), checks, limitations: ['不驗證評論品質或 Agent 自主性', '模型為簽署回應中的識別，不是權重 checkpoint 證明', '硬體 attestation 與機密性尚未納入', '需要 RPC 歷史查詢與 Storage 可用性；無法查詢不等於造假'] };
}
