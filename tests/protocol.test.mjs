import test from 'node:test';
import assert from 'node:assert/strict';
import { Wallet, getBytes } from 'ethers';
import { DOMAIN, json, digest, fixedAudio, taskReveal, taskDigest, proofDigest, parseProof, inspectService, paymentData, countCareer } from '../server/protocol.mjs';

export async function fixture() {
  const seal = Wallet.createRandom(), manager = Wallet.createRandom().address;
  const record = { schema: '0g-career-work-v1', domain: DOMAIN, jobId: 'test-job', kind: 'seed', manager,
    worker: { key: 'professor', agentId: '1', model: 'model-a', payee: seal.address, amount: '0.001' },
    request: { method: 'POST', uri: '/api/review', body: '' }, response: { status: 200, body: '', proofHeader: '' } };
  record.request.body = json({ jobId: record.jobId, kind: record.kind, manager, model: record.worker.model, workerKey: record.worker.key, payee: seal.address, amount: '0.001' });
  record.response.body = json({ jobId: record.jobId, workerKey: 'professor', model: 'model-a', review: { critique: 'Test-only review' } });
  const now = Math.floor(Date.now() / 1000);
  const proof = { agentId: 1n, submitter: manager, timestamp: BigInt(now - 10), deadline: BigInt(now + 3590), taskHash: taskDigest(taskReveal(record.request, record.response)), dataHashes: [digest('state')], frameworkHash: digest('framework') };
  const signature = await seal.signMessage(getBytes(proofDigest(proof)));
  record.response.proofHeader = `${signature}.${Buffer.from(json({ agent_id: '1', submitter: manager, timestamp: Number(proof.timestamp), deadline: Number(proof.deadline), task_hash: proof.taskHash, data_hashes: proof.dataHashes, framework_hash: proof.frameworkHash })).toString('base64url')}`;
  return { record, seal, proof };
}

test('verifies an exact response and its submitting employer', async () => {
  const { record, seal } = await fixture();
  assert.equal(inspectService(record, seal.address).output.model, 'model-a');
});
test('rejects modified response bytes, model and submitter', async () => {
  const { record, seal } = await fixture();
  const changed = structuredClone(record); changed.response.body += ' ';
  assert.throws(() => inspectService(changed, seal.address), /taskHash/);
  changed.response.body = record.response.body; changed.worker.model = 'model-b';
  assert.throws(() => inspectService(changed, seal.address), /模型/);
  changed.worker.model = 'model-a'; changed.manager = Wallet.createRandom().address;
  assert.throws(() => inspectService(changed, seal.address), /雇主/);
});
test('historical signature remains verifiable after redemption deadline', async () => {
  const { record, seal, proof } = await fixture();
  const now = Number(proof.deadline) + 1;
  assert.throws(() => inspectService(record, seal.address, { now }), /過期/);
  assert.equal(inspectService(record, seal.address, { now, historical: true }).expiredNow, true);
});
test('rejects other signing identities and missing proof', async () => {
  const { record } = await fixture();
  assert.throws(() => inspectService(record, Wallet.createRandom().address), /簽章/);
  assert.throws(() => parseProof(''), /格式/);
});
test('payments commit to the artifact, job and model', async () => {
  const { record } = await fixture();
  const first = paymentData(record);
  record.worker.model = 'model-b';
  assert.notEqual(paymentData(record), first);
});
test('career counts only complete verified unique work for the same identity and model', () => {
  const make = (jobId, model, status = 'completed', agentId = '1', ok = true) => ({ record: { jobId, worker: { agentId, model } }, status, verification: { ok } });
  const works = [make('old', 'a'), make('new', 'b'), make('new', 'b'), make('pending', 'b', 'pending'), make('other', 'b', 'completed', '2'), make('bad', 'b', 'completed', '1', false)];
  assert.deepEqual(countCareer(works, '1', 'b'), { lifetime: 2, current: 1 });
});
test('fixed music has deterministic bytes and a 15-second WAV header', () => {
  const a = fixedAudio();
  assert.equal(a.length, 480044);
  assert.deepEqual(a, fixedAudio());
  assert.equal(a.toString('ascii', 0, 4), 'RIFF');
});
