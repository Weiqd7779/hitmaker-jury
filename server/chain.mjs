import { Contract, Interface, JsonRpcProvider, Transaction, Wallet, keccak256, parseEther } from 'ethers';
import { DOMAIN, RPC, requireValue, sameAddress } from './protocol.mjs';

export const identityABI = [
  'function ownerOf(uint256) view returns(address)', 'function getAgentSeal(uint256) view returns(address)',
  'function intelligentDatasOf(uint256) view returns(tuple(string dataDescription,bytes32 dataHash)[])',
];
export const canonicalABI = [
  'function giveFeedback(uint256 agentId,int128 value,uint8 valueDecimals,string tag1,string tag2,string endpoint,string feedbackURI,bytes32 feedbackHash)',
  'function getLastIndex(uint256,address) view returns(uint64)',
  'function readFeedback(uint256,address,uint64) view returns(int128,uint8,string,string,bool)',
];
export const verifiedABI = [
  'function getIdentityRegistry() view returns(address)', 'function getCanonicalReputation() view returns(address)',
  'function isVerified(uint256,address,uint64) view returns(bool)',
  'function attestFeedbackWithTask(uint256 agentId,uint64 feedbackIndex,tuple(uint256 agentId,address submitter,uint256 timestamp,uint256 deadline,bytes32 taskHash,bytes32[] dataHashes,bytes32 frameworkHash,bytes signature) proof,tuple(string method,string uri,bytes32 reqBodyHash,bytes32 respBodyHash,uint16 statusCode) task)',
  'event FeedbackVerified(uint256 indexed agentId,address indexed clientAddress,uint64 indexed feedbackIndex,bytes32[] dataHashes,bytes32 frameworkHash,bytes32 taskHash,string uri)',
];
export const canonicalInterface = new Interface(canonicalABI);
export const verifiedInterface = new Interface(verifiedABI);
export function providerFor(url = RPC) { return new JsonRpcProvider(url, undefined, { cacheTimeout: -1 }); }
export async function checkDomain(provider) {
  requireValue(Number((await provider.getNetwork()).chainId) === DOMAIN.chainId, '僅允許 Galileo 測試網');
  const verified = new Contract(DOMAIN.verified, verifiedABI, provider);
  requireValue(sameAddress(await verified.getIdentityRegistry(), DOMAIN.identity) && sameAddress(await verified.getCanonicalReputation(), DOMAIN.canonical), '驗證合約環境不符');
}
export async function readIdentity(provider, agentId, blockTag = 'latest') {
  const contract = new Contract(DOMAIN.identity, identityABI, provider);
  const [owner, seal, data] = await Promise.all([contract.ownerOf(agentId, { blockTag }), contract.getAgentSeal(agentId, { blockTag }), contract.intelligentDatasOf(agentId, { blockTag })]);
  requireValue(seal !== '0x0000000000000000000000000000000000000000', 'AgentSeal 尚未綁定');
  return { owner, seal, dataHashes: data.map(d => d.dataHash) };
}
export async function confirmedTransaction(provider, hash) {
  const [tx, receipt] = await Promise.all([provider.getTransaction(hash), provider.getTransactionReceipt(hash)]);
  requireValue(tx && receipt, '交易尚未確認或 RPC 暫時無法查詢');
  requireValue(receipt.status === 1, '鏈上交易失敗');
  requireValue(Number(tx.chainId) === DOMAIN.chainId, '交易網路不符');
  return { tx, receipt };
}
export class JournaledWallet {
  constructor(provider, key, store) {
    this.provider = provider; this.store = store;
    requireValue(!key || /^0x[0-9a-fA-F]{64}$/.test(key), 'Manager key 格式無效，請透過環境變數安全設定');
    try { this.wallet = key ? new Wallet(key, provider) : null; }
    catch { throw new Error('Manager key 無效'); }
  }
  async send(id, transaction) {
    requireValue(this.wallet, '尚未設定 Manager 測試網簽署帳戶');
    let journal = this.store.getTransaction(id);
    if (!journal) {
      const pending = this.store.pendingTransactions();
      for (const item of pending) {
        if (item.id !== id) requireValue(await this.provider.getTransactionReceipt(item.hash), '仍有待確認交易，請先恢復原工作');
      }
      const prepared = await this.wallet.populateTransaction({ ...transaction, chainId: DOMAIN.chainId, type: 2, maxPriorityFeePerGas: 2000000000n, maxFeePerGas: 5000000000n });
      requireValue(BigInt(prepared.gasLimit) * 5000000000n <= parseEther('0.01'), '單筆 Gas 上限超出授權');
      const raw = await this.wallet.signTransaction(prepared);
      journal = { id, raw, hash: keccak256(raw), confirmed: false };
      this.store.putTransaction(journal);
    }
    const signed = Transaction.from(journal.raw);
    requireValue(sameAddress(signed.from, this.wallet.address) && sameAddress(signed.to, transaction.to) && signed.data === (transaction.data || '0x') && signed.value === BigInt(transaction.value || 0), '已保存交易與本次要求不符，停止重送');
    let receipt = await this.provider.getTransactionReceipt(journal.hash);
    if (!receipt) {
      try { await this.provider.broadcastTransaction(journal.raw); }
      catch { requireValue(await this.provider.getTransaction(journal.hash), `交易廣播狀態未知；保留 ${journal.hash}，只可重送同一筆交易`); }
      receipt = await this.provider.waitForTransaction(journal.hash, 1, 120000);
    }
    requireValue(receipt, `交易待確認：${journal.hash}；請恢復原工作，不要建立重複付款`);
    requireValue(receipt.status === 1, `交易失敗：${journal.hash}`);
    this.store.putTransaction({ ...journal, confirmed: true });
    return receipt;
  }
}
