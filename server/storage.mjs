import { Indexer, MemData } from '@0gfoundation/0g-storage-ts-sdk';
import { AbstractSigner, parseEther, resolveProperties } from 'ethers';
import { INDEXER, RPC, json, requireValue } from './protocol.mjs';

export class StorageAdapter {
  constructor(signer, { indexer = INDEXER, rpc = RPC } = {}) { this.indexer = new Indexer(indexer); this.signer = signer; this.rpc = rpc; }
  async root(record) {
    const file = new MemData(new TextEncoder().encode(json(record)));
    const [tree, error] = await file.merkleTree();
    if (error) throw error;
    requireValue(tree, '無法計算 Storage Merkle root');
    return { file, rootHash: tree.rootHash() };
  }
  async upload(record, journal) {
    requireValue(this.signer && journal, '尚未設定 Storage 測試網交易授權');
    const { file } = await this.root(record);
    const original = this.signer;
    const signer = new class extends AbstractSigner {
      constructor() { super(original.provider); }
      async getAddress() { return original.address; }
      connect() { throw new Error('Storage signer cannot change networks'); }
      signTransaction() { throw new Error('Storage raw signing is disabled'); }
      signMessage() { throw new Error('Storage message signing is disabled'); }
      signTypedData() { throw new Error('Storage typed-data signing is disabled'); }
      async sendTransaction(input) {
        const tx = await resolveProperties(input);
        requireValue(BigInt(tx.value || 0) <= parseEther('0.005'), 'Storage 費用超出每位 Worker 0.005 0G 上限');
        const receipt = await journal.send(`${record.jobId}:${record.worker.key}:storage`, { to: tx.to, data: tx.data || '0x', value: tx.value || 0n });
        const response = await original.provider.getTransaction(receipt.hash);
        requireValue(response, 'Storage 交易暫時無法查詢，保留既有交易');
        return response;
      }
    }();
    const [result, error] = await this.indexer.upload(file, this.rpc, signer, undefined, undefined, { gasPrice: 2000000000n });
    if (error) throw error;
    requireValue(result.rootHash, '預期單一小型成果檔案');
    return { rootHash: result.rootHash, txHash: result.txHash || null };
  }
  async download(rootHash) {
    requireValue(/^0x[0-9a-fA-F]{64}$/.test(rootHash), 'Storage rootHash 無效');
    const [blob, error] = await this.indexer.downloadToBlob(rootHash, { proof: true });
    if (error) throw error;
    requireValue(blob.size <= 2 * 1024 * 1024, '成果檔案超過大小限制');
    return blob.text();
  }
}
