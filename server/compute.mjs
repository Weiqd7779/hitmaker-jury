import { Contract, JsonRpcProvider, verifyMessage } from 'ethers';
import { requireValue, sameAddress } from './protocol.mjs';

export const COMPUTE_CONTRACT = '0x47340d900bdFec2BD393c626E12ea0656F938d84';
export const computeABI = ['function getService(address provider) view returns(tuple(address provider,string serviceType,string url,uint256 inputPrice,uint256 outputPrice,uint256 updatedAt,string model,string verifiability,string additionalInfo,address teeSignerAddress,bool teeSignerAcknowledged))'];
const chain = new JsonRpcProvider('https://evmrpc.0g.ai', undefined, { cacheTimeout: -1 });
async function serviceFor(provider, block, rpc = chain) {
  requireValue(/^0x[0-9a-fA-F]{40}$/.test(provider), '缺少 Compute provider');
  requireValue(Number((await rpc.getNetwork()).chainId) === 16661, 'Compute 驗證網路不符');
  const service = await new Contract(COMPUTE_CONTRACT, computeABI, rpc).getService(provider, { blockTag: block });
  const extra = JSON.parse(service.additionalInfo || '{}');
  const separated = extra.TargetSeparated === true && extra.ProviderType !== 'centralized';
  const signer = separated ? extra.TargetTeeAddress : service.teeSignerAddress;
  requireValue(signer && ['TeeML', 'TeeTLS'].includes(service.verifiability), '供應商未提供受支援的可驗證簽署者');
  return { url: service.url, signer, model: service.model, verifiability: service.verifiability };
}
export async function captureCompute(output) {
  const provider = output.router?.x_0g_trace?.provider;
  const reference = output.chatId || output.router?.id;
  requireValue(typeof reference === 'string' && reference.length < 256, '缺少 Compute response reference');
  const block = await chain.getBlock('latest');
  const service = await serviceFor(provider, block.number);
  const url = new URL(service.url);
  requireValue(url.protocol === 'https:' && !url.username && !url.password, 'Compute proof endpoint 必須使用 HTTPS');
  url.pathname = `${url.pathname.replace(/\/$/, '')}/v1/proxy/signature/${encodeURIComponent(reference)}`;
  url.search = new URLSearchParams({ model: output.model }).toString();
  const response = await fetch(url, { signal: AbortSignal.timeout(30000), redirect: 'error' });
  requireValue(response.ok, `Compute 簽章查詢失敗 (${response.status})`);
  const raw = await response.json();
  const evidence = { provider, reference, text: raw.text, signature: raw.signature, observedBlock: { number: block.number, hash: block.hash }, scope: 'provider-response-signature; not hardware attestation' };
  await verifyCompute(output, evidence);
  return evidence;
}
export async function verifyCompute(output, evidence, rpc = chain) {
  requireValue(evidence && typeof evidence.text === 'string' && typeof evidence.signature === 'string', '缺少可攜 Compute 簽章');
  requireValue(output.router?.model === output.model, 'Router 回報模型與版本不符');
  requireValue(sameAddress(evidence.provider, output.router?.x_0g_trace?.provider), 'Compute provider 關聯不符');
  requireValue(evidence.reference === (output.chatId || output.router?.id), 'Compute reference 關聯不符');
  const content = output.router?.choices?.[0]?.message?.content;
  requireValue(typeof content === 'string' && evidence.text === content, '供應商簽署文字與交付的推論不符');
  requireValue(Number.isSafeInteger(evidence.observedBlock?.number), '缺少 Compute 觀測區塊');
  const block = await rpc.getBlock(evidence.observedBlock.number);
  requireValue(block && block.hash === evidence.observedBlock.hash, 'Compute 歷史區塊不符');
  const service = await serviceFor(evidence.provider, block.number, rpc);
  requireValue(service.model === output.model, 'Compute 鏈上服務模型不符；不自行推測模型別名');
  requireValue(sameAddress(verifyMessage(evidence.text, evidence.signature), service.signer), 'Compute 簽章不符鏈上供應商簽署者');
  const parsed = JSON.parse(content);
  requireValue(JSON.stringify(parsed) === JSON.stringify(output.review), '評論與實際模型輸出不符');
  return { verifiability: service.verifiability, model: output.model, scope: 'provider-response-signature', hardwareAttestationVerified: false };
}
