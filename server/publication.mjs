import { AbiCoder, keccak256, toUtf8Bytes } from 'ethers';
import { json, requireValue } from './protocol.mjs';

export function publication(snapshot, contracts, deployment = null) {
  requireValue(snapshot.status === 'completed' && snapshot.entries.length === 3 && snapshot.entries.every(entry => entry.status === 'completed'), '請先完成三位評審的評論');
  const records = snapshot.workers.map(worker => {
    const entry = snapshot.entries.find(item => item.worker === worker.key);
    requireValue(entry?.review && entry.model && entry.rawContent && entry.requestId, '請確認評論來源與模型資料');
    return { schema: 'verifiable-agent-career/work-v1', job: 'Music Jury #031', agent: worker.name, role: worker.title, workerKey: worker.key, model: entry.model, source: '0G Compute Router', router: snapshot.router, requestId: entry.requestId, receivedAt: entry.receivedAt, input: snapshot.music, review: entry.review, rawContent: entry.rawContent, contentHash: entry.contentHash, routerVerification: entry.routerTeeVerified, billedCost0G: entry.billedCost0G };
  });
  requireValue(new Set(records.map(record => record.model)).size === 1, '請使用同一模型版本建立本次評審記錄');
  const jsonText = records.map(record => JSON.stringify(record, null, 2));
  const hashes = jsonText.map(text => keccak256(toUtf8Bytes(text)));
  const jobHash = keccak256(AbiCoder.defaultAbiCoder().encode(['bytes32[3]', 'string'], [hashes, records[0].model]));
  const version = jobHash.slice(2);
  const profiles = records.map((record, i) => ({ type: 'https://eips.ethereum.org/EIPS/eip-8004#registration-v1', name: record.agent, description: `${record.role} — Verifiable Agent Career Network / 0G Music Jury`, supportedTrust: ['reputation'], x_career: { job: record.job, model: record.model, recordPath: `records/${version}/${record.workerKey}.json`, artifactHash: hashes[i] } }));
  const manifest = { schema: 'jury-erc8004-manifest-v1', chainId: 16602, job: 'Music Jury #031', jobHash, model: records[0].model, rewardWei: '1000000000000000', totalRewardWei: '3000000000000000', contracts, workers: records.map((record, i) => ({ key: record.workerKey, name: record.agent, title: record.role, artifactHash: hashes[i], recordPath: `records/${version}/${record.workerKey}.json`, agentPath: `agents/${version}/${record.workerKey}.json` })) };
  if (deployment && deployment.manager) { manifest.manager = deployment.manager; manifest.owner = deployment.owner; manifest.deploymentHash = deployment.deploymentHash; manifest.settlementHash = deployment.settlementHash; manifest.settled = Boolean(deployment.settlementHash); }
  return { records, profiles, manifest, jsonText };
}
