import { AbiCoder, concat, getAddress, getBytes, hexlify, keccak256, sha256, toUtf8Bytes, verifyMessage } from 'ethers';

export const DOMAIN = Object.freeze({
  chainId: 16602,
  identity: '0x34493302287308f565CF3409DAAdEDF4C8895648',
  canonical: '0x8004B663056A597Dffe9eCcC1965A193B7388713',
  verified: '0xc0c902666078774435429d1fdeb5b1b17d95d583',
});
export const RPC = 'https://evmrpc-testnet.0g.ai';
export const INDEXER = 'https://indexer-storage-testnet-turbo.0g.ai';
export const ROUTER = 'https://router-api.0g.ai/v1';
export const PRESENTATION_BATCH = 'music-jury-031-v2';
export const WORKERS = Object.freeze([
  { key: 'professor', name: 'MixMaster', title: 'Mixing Specialist', amount: '0.001', pitch: '我會關注聲音平衡與層次，讓旋律的個性清楚呈現。', objective: '你是 MixMaster，混音專家。根據提供的音訊分析描述，評論音高偏移對聲音平衡、層次與混音呈現的影響，提出一項具體建議。只使用描述中的資料，不捏造頻譜量測或聲稱直接聽過音訊。' },
  { key: 'antisocial', name: 'MelodyFox', title: 'Composition Specialist', amount: '0.001', pitch: '我會檢視旋律輪廓、重複段落與音程張力，找出作品的記憶點。', objective: '你是 MelodyFox，作曲專家。根據提供的音訊分析描述，評論旋律輪廓、三次重複結構和偏移音程的張力，提出一項作曲建議。只使用描述中的資料，不捏造量測或聲稱直接聽過音訊。' },
  { key: 'nearmiss', name: 'HitRadar', title: 'Commercial Music Analyst', amount: '0.001', pitch: '我會從受眾與傳播情境出發，判斷這段旋律的市場定位。', objective: '你是 HitRadar，商業音樂分析師。根據提供的音訊分析描述，評論熟悉旋律與特殊音準的受眾吸引力、短影音傳播和市場定位，提出一項商業建議。不要捏造市場統計或聲稱直接聽過音訊。' },
]);
export const MUSIC = Object.freeze({
  name: '走音小星星 · Career Session', duration: 15, source: 'deterministic-synthesis-v1',
  analysisSource: '預先準備的展示描述，非現場量測，未經 TEE 驗證',
  notes: '合成小星星旋律，重複三次。G 音約偏低 40 音分，A 音約偏高 65 音分。請討論音準、辨識度與刻意偏移的可能美感。',
});
export const json = value => JSON.stringify(value, (_, v) => typeof v === 'bigint' ? v.toString() : v);
export const digest = value => sha256(toUtf8Bytes(typeof value === 'string' ? value : json(value)));
export const sameAddress = (a, b) => typeof a === 'string' && typeof b === 'string' && a.toLowerCase() === b.toLowerCase();
export function requireValue(condition, message) { if (!condition) throw new Error(message); }
export function parseProof(header) {
  requireValue(typeof header === 'string' && header.length < 32768, '缺少有效 X-Agent-Proof');
  const dot = header.indexOf('.');
  requireValue(dot > 0, 'X-Agent-Proof 格式錯誤');
  const signature = header.slice(0, dot);
  requireValue(/^0x[0-9a-fA-F]{130}$/.test(signature), 'ServeProof 簽章長度錯誤');
  const p = JSON.parse(Buffer.from(header.slice(dot + 1), 'base64url').toString('utf8'));
  for (const field of ['task_hash', 'framework_hash']) requireValue(/^0x[0-9a-fA-F]{64}$/.test(p[field]), `proof ${field} 錯誤`);
  requireValue(Array.isArray(p.data_hashes) && p.data_hashes.length > 0 && p.data_hashes.length <= 128 && p.data_hashes.every(h => /^0x[0-9a-fA-F]{64}$/.test(h)), 'proof 缺少有效 data hashes');
  const proof = { agentId: BigInt(p.agent_id), submitter: getAddress(p.submitter), timestamp: BigInt(p.timestamp), deadline: BigInt(p.deadline), taskHash: p.task_hash, dataHashes: p.data_hashes, frameworkHash: p.framework_hash, signature };
  requireValue(proof.agentId > 0n && proof.timestamp > 0n && proof.deadline > proof.timestamp, 'proof 時間或身分無效');
  return proof;
}
export function proofDigest(proof, domain = DOMAIN) {
  return keccak256(AbiCoder.defaultAbiCoder().encode(
    ['uint256', 'address', 'address', 'uint256', 'uint256', 'uint256', 'bytes32', 'bytes32', 'bytes32'],
    [domain.chainId, domain.identity, proof.submitter, proof.agentId, proof.timestamp, proof.deadline, proof.taskHash, keccak256(concat(proof.dataHashes)), proof.frameworkHash],
  ));
}
export function taskReveal(request, response) {
  return { method: request.method, uri: request.uri, reqBodyHash: keccak256(toUtf8Bytes(request.body)), respBodyHash: keccak256(toUtf8Bytes(response.body)), statusCode: response.status };
}
export function taskDigest(task) {
  return keccak256(concat([toUtf8Bytes(task.method), toUtf8Bytes(task.uri), task.reqBodyHash, task.respBodyHash, toUtf8Bytes(String(task.statusCode))]));
}
export function inspectService(record, seal, { historical = false, now = Date.now() / 1000 } = {}) {
  const proof = parseProof(record.response.proofHeader);
  requireValue(proof.agentId === BigInt(record.worker.agentId), 'proof 不屬於此 Worker');
  requireValue(sameAddress(proof.submitter, record.manager), 'proof 不屬於此雇主');
  requireValue(sameAddress(verifyMessage(getBytes(proofDigest(proof, record.domain)), proof.signature), seal), 'AgentSeal 簽章驗證失敗');
  requireValue(taskDigest(taskReveal(record.request, record.response)) === proof.taskHash, '請求或交付內容與 taskHash 不符');
  requireValue(record.request.method === 'POST' && record.request.uri === '/api/review' && record.response.status === 200, '不是成功的音樂評審服務');
  requireValue(Number(proof.timestamp) <= now + 60, 'proof 時間在未來');
  if (!historical) requireValue(Number(proof.deadline) > now, 'proof 已過期，不能提交新的驗證標記');
  const input = JSON.parse(record.request.body);
  const output = JSON.parse(record.response.body);
  requireValue(input.jobId === record.jobId && output.jobId === record.jobId, '工作 ID 關聯錯誤');
  requireValue(input.model === record.worker.model && output.model === record.worker.model, '模型版本關聯錯誤');
  requireValue(input.workerKey === record.worker.key && output.workerKey === record.worker.key, '角色關聯錯誤');
  requireValue(input.payee === record.worker.payee && input.amount === record.worker.amount, '付款條件未綁定工作');
  requireValue(input.manager === record.manager && input.kind === record.kind, '雇主或工作種類不符');
  requireValue(typeof output.review?.critique === 'string' && output.review.critique.length > 0, '缺少交付評論');
  return { proof, output, input, expiredNow: Number(proof.deadline) <= now };
}
export function paymentData(record) {
  return hexlify(toUtf8Bytes(json({ protocol: '0g-career-v1', jobId: record.jobId, agentId: record.worker.agentId, model: record.worker.model, artifactHash: digest(record), taskHash: parseProof(record.response.proofHeader).taskHash })));
}
export function countCareer(works, agentId, model) {
  const unique = new Map();
  for (const work of works) {
    if (work.status === 'completed' && work.verification?.ok === true && String(work.record.worker.agentId) === String(agentId)) {
      unique.set(`${work.record.jobId}:${agentId}`, work);
    }
  }
  return { lifetime: unique.size, current: [...unique.values()].filter(w => w.record.worker.model === model).length };
}
export function fixedAudio() {
  const rate = 16000, seconds = 15;
  const data = Buffer.alloc(44 + rate * seconds * 2);
  data.write('RIFF'); data.writeUInt32LE(data.length - 8, 4); data.write('WAVEfmt ', 8); data.writeUInt32LE(16, 16);
  data.writeUInt16LE(1, 20); data.writeUInt16LE(1, 22); data.writeUInt32LE(rate, 24); data.writeUInt32LE(rate * 2, 28);
  data.writeUInt16LE(2, 32); data.writeUInt16LE(16, 34); data.write('data', 36); data.writeUInt32LE(data.length - 44, 40);
  const notes = [261.63, 261.63, 392 * 2 ** (-40 / 1200), 392 * 2 ** (-40 / 1200), 440 * 2 ** (65 / 1200), 440 * 2 ** (65 / 1200), 392];
  for (let i = 0; i < rate * seconds; i++) {
    const t = i / rate, local = t % 5, n = Math.min(6, Math.floor(local / 0.65)), pos = local - n * 0.65;
    const envelope = Math.min(1, pos / 0.02) * Math.max(0, 1 - pos / (n === 6 ? 1.1 : 0.6));
    data.writeInt16LE(Math.round(Math.sin(2 * Math.PI * notes[n] * t) * envelope * 6500), 44 + i * 2);
  }
  return data;
}
