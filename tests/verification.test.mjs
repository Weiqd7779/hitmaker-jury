import test from 'node:test';
import assert from 'node:assert/strict';
import { Interface, Wallet, getBytes, parseEther } from 'ethers';
import { verifyBundle } from '../server/verify.mjs';
import { DOMAIN, json, digest, taskDigest, taskReveal, proofDigest, paymentData } from '../server/protocol.mjs';
import { identityABI, canonicalABI, verifiedABI, canonicalInterface, verifiedInterface } from '../server/chain.mjs';

async function evidenceFixture() {
  const seal = Wallet.createRandom(), manager = Wallet.createRandom().address, now = Math.floor(Date.now() / 1000);
  const input = { jobId: 'proof-job', kind: 'seed', manager, workerKey: 'professor', model: 'model-a', payee: seal.address, amount: '0.001' };
  const record = { schema: '0g-career-work-v1', kind: 'seed', jobId: input.jobId, manager, domain: DOMAIN, worker: { key: 'professor', agentId: '1', model: 'model-a', payee: seal.address, amount: '0.001' }, observedBlock: { number: 100, hash: digest('block100') }, request: { method: 'POST', uri: '/api/review', body: json(input) }, response: { status: 200, body: json({ jobId: input.jobId, workerKey: 'professor', model: 'model-a', review: { critique: 'Unit-test fixture only' } }), proofHeader: '' } };
  const proof = { agentId: 1n, submitter: manager, timestamp: BigInt(now - 7200), deadline: BigInt(now - 3600), taskHash: taskDigest(taskReveal(record.request, record.response)), dataHashes: [digest('state')], frameworkHash: digest('framework') };
  const sig = await seal.signMessage(getBytes(proofDigest(proof)));
  record.response.proofHeader = `${sig}.${Buffer.from(json({ agent_id: '1', submitter: manager, timestamp: Number(proof.timestamp), deadline: Number(proof.deadline), task_hash: proof.taskHash, data_hashes: proof.dataHashes, framework_hash: proof.frameworkHash })).toString('base64url')}`;
  const bundle = { record, compute: {}, storage: { rootHash: digest('storage') }, feedback: { txHash: digest('feedback'), attestTxHash: digest('attest'), index: '1' }, payment: { txHash: digest('payment') } };
  let revoked = false, artifact = json(record), paymentOverride = null;
  const interfaces = [new Interface(identityABI), new Interface(canonicalABI), new Interface(verifiedABI)];
  const provider = {
    getNetwork: async () => ({ chainId: 16602n }),
    getBlock: async () => ({ number: 100, hash: record.observedBlock.hash, timestamp: now - 7100 }),
    call: async transaction => {
      const face = interfaces.find(i => i.getFunction(transaction.data.slice(0, 10)));
      const decoded = face.parseTransaction(transaction), name = decoded.name;
      const values = { getIdentityRegistry: [DOMAIN.identity], getCanonicalReputation: [DOMAIN.canonical], ownerOf: ['0x1111111111111111111111111111111111111111'], getAgentSeal: [seal.address], intelligentDatasOf: [[[json({ role: 'framework' }), proof.dataHashes[0]]]], getLastIndex: [transaction.blockTag === '0xc7' || transaction.blockTag === 199 ? 0n : 1n], readFeedback: [1n, 0, 'accepted', 'model-a', revoked], isVerified: [true] };
      return face.encodeFunctionResult(name, values[name]);
    },
    getTransaction: async hash => {
      if (hash === bundle.feedback.txHash) return { chainId: 16602n, to: DOMAIN.canonical, from: manager, data: canonicalInterface.encodeFunctionData('giveFeedback', [1, 1, 0, 'accepted', 'model-a', '/api/review', `0g://storage/${bundle.storage.rootHash}`, digest(record)]) };
      if (hash === bundle.feedback.attestTxHash) return { chainId: 16602n, to: DOMAIN.verified, from: manager };
      if (hash === bundle.payment.txHash) return { chainId: 16602n, to: seal.address, from: manager, value: parseEther('0.001'), data: paymentOverride || paymentData(record) };
      return null;
    },
    getTransactionReceipt: async hash => {
      const event = verifiedInterface.encodeEventLog(verifiedInterface.getEvent('FeedbackVerified'), [1, manager, 1, proof.dataHashes, proof.frameworkHash, proof.taskHash, '/api/review']);
      return { status: 1, blockNumber: 200, logs: hash === bundle.feedback.attestTxHash ? [{ address: DOMAIN.verified, ...event }] : [] };
    },
  };
  return { bundle, dependencies: { provider, storage: { root: async () => ({ rootHash: bundle.storage.rootHash }), download: async () => artifact }, compute: async () => ({ model: 'model-a' }) }, revoke: () => { revoked = true; }, tamperArtifact: () => { artifact += ' '; }, tamperPayment: () => { paymentOverride = '0x00'; } };
}

test('historical complete work verifies after proof expiry without current-state substitution', async () => {
  const { bundle, dependencies } = await evidenceFixture();
  const result = await verifyBundle(bundle, dependencies);
  assert.equal(result.ok, true, json(result));
  assert.equal(result.checks.length, 7);
  assert.match(result.checks.find(c => c.key === 'service').detail, /已過期/);
});
test('a changed artifact cannot keep a completed verified badge', async () => {
  const f = await evidenceFixture(); f.tamperArtifact();
  const result = await verifyBundle(f.bundle, f.dependencies);
  assert.equal(result.ok, false); assert.equal(result.checks.find(c => c.key === 'artifact').status, 'failed');
});
test('revoked feedback invalidates current verified completion', async () => {
  const f = await evidenceFixture(); f.revoke();
  const result = await verifyBundle(f.bundle, f.dependencies);
  assert.equal(result.ok, false); assert.equal(result.checks.find(c => c.key === 'feedback').status, 'failed');
});
test('an unrelated transfer is not accepted as work settlement', async () => {
  const f = await evidenceFixture(); f.tamperPayment();
  const result = await verifyBundle(f.bundle, f.dependencies);
  assert.equal(result.ok, false); assert.equal(result.checks.find(c => c.key === 'payment').status, 'failed');
});
test('untrusted registry substitution is rejected before external lookups', async () => {
  const f = await evidenceFixture(); f.bundle.record.domain = { ...DOMAIN, verified: Wallet.createRandom().address };
  const result = await verifyBundle(f.bundle, f.dependencies);
  assert.equal(result.ok, false); assert.equal(result.checks.length, 1);
});
