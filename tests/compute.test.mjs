import test from 'node:test';
import assert from 'node:assert/strict';
import { Interface, Wallet } from 'ethers';
import { computeABI, verifyCompute } from '../server/compute.mjs';
import { digest } from '../server/protocol.mjs';

async function fixture() {
  const signer = Wallet.createRandom(), providerAddress = Wallet.createRandom().address;
  const review = { score: 72, headline: 'Fixture', critique: 'Unit test only' }, text = JSON.stringify(review);
  const output = { model: 'model-a', chatId: 'chat-1', review, router: { model: 'model-a', x_0g_trace: { provider: providerAddress }, choices: [{ message: { content: text } }] } };
  const evidence = { provider: providerAddress, reference: 'chat-1', text, signature: await signer.signMessage(text), observedBlock: { number: 99, hash: digest('compute-block') } };
  const face = new Interface(computeABI);
  const rpc = {
    getNetwork: async () => ({ chainId: 16661n }),
    getBlock: async () => ({ number: 99, hash: digest('compute-block') }),
    call: async () => face.encodeFunctionResult('getService', [[providerAddress, 'chatbot', 'https://provider.example', 1, 1, 1, 'model-a', 'TeeML', '{}', signer.address, true]]),
  };
  return { output, evidence, rpc };
}
test('Compute verifies exact signed content against the historical on-chain signer', async () => {
  const f = await fixture(); const result = await verifyCompute(f.output, f.evidence, f.rpc);
  assert.equal(result.model, 'model-a'); assert.equal(result.hardwareAttestationVerified, false);
});
test('Compute rejects a valid signature for different output bytes', async () => {
  const f = await fixture(); f.output.router.choices[0].message.content += ' ';
  await assert.rejects(verifyCompute(f.output, f.evidence, f.rpc), /簽署文字/);
});
test('Compute rejects switching reported models without matching chain service metadata', async () => {
  const f = await fixture(); f.output.model = 'model-b'; f.output.router.model = 'model-b';
  await assert.rejects(verifyCompute(f.output, f.evidence, f.rpc), /模型不符/);
});
test('Compute rejects a signature from an unrelated signer', async () => {
  const f = await fixture(); f.evidence.signature = await Wallet.createRandom().signMessage(f.evidence.text);
  await assert.rejects(verifyCompute(f.output, f.evidence, f.rpc), /簽章不符/);
});
