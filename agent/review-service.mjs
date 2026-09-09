import { createServer, request as httpRequest } from 'node:http';
import { mkdir, readFile, writeFile, rename } from 'node:fs/promises';
import { join, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getBytes, verifyMessage } from 'ethers';
import { WORKERS, MUSIC, ROUTER, json, digest, sameAddress, requireValue } from '../server/protocol.mjs';

export function validateTask(input, body, signature, config) {
  requireValue(sameAddress(verifyMessage(getBytes(digest(body)), signature), config.manager), '雇主授權簽章錯誤');
  requireValue(sameAddress(input.manager, config.manager), '雇主不符');
  requireValue(input.workerKey === config.worker.key && sameAddress(input.payee, config.seal) && input.amount === config.worker.amount, '工作或付款條件不符');
  requireValue(config.models.includes(input.model), '未授權的工作模型');
  requireValue(input.music?.source === MUSIC.source && input.music.notes === MUSIC.notes && input.music.name === MUSIC.name, '只接受固定公開展示素材');
  requireValue(/^[0-9a-f-]{36}$/.test(input.jobId) && ['seed', 'live'].includes(input.kind), '工作 ID 或種類無效');
}
export function createReviewServer(config, infer = async input => {
  const response = await fetch(`${ROUTER}/chat/completions`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${config.apiKey}`, 'X-0G-Provider-Trust-Mode': 'verified', 'Allow-Fallbacks': 'true' },
    body: json({ model: input.model, messages: [{ role: 'system', content: `${config.worker.objective} 僅回傳 JSON：{"score":0到100,"headline":"短標題","critique":"二至三句評論"}。` }, { role: 'user', content: input.music.notes }], max_tokens: 800, temperature: 0.7, verify_tee: true, response_format: { type: 'json_object' } }),
    signal: AbortSignal.timeout(150000), redirect: 'error',
  });
  if (!response.ok) {
    const error = new Error(`0G Router HTTP ${response.status}`); error.status = response.status; error.retryAfter = response.headers.get('Retry-After'); throw error;
  }
  const router = await response.json();
  requireValue(router.model === input.model, '實際模型與指定模型不同');
  requireValue(router.x_0g_trace?.tee_verified === true, 'Router 未回報通過簽章驗證');
  const review = JSON.parse(router.choices?.[0]?.message?.content || '');
  requireValue(typeof review.critique === 'string' && typeof review.headline === 'string' && Number.isFinite(review.score) && review.score >= 0 && review.score <= 100, '模型交付格式不完整；不使用預設評論');
  return { jobId: input.jobId, workerKey: input.workerKey, model: input.model, review, router, chatId: response.headers.get('ZG-Res-Key') || router.id, computedAt: new Date().toISOString() };
}) {
  let busy = false;
  return createServer(async (req, res) => {
    res.setHeader('Content-Type', 'application/json'); res.setHeader('Cache-Control', 'no-store');
    try {
      requireValue(req.method === 'POST' && req.url === '/api/review', 'Unknown service');
      let body = '';
      for await (const chunk of req) { body += chunk; requireValue(Buffer.byteLength(body) <= 16384, '請求過大'); }
      const input = JSON.parse(body);
      validateTask(input, body, req.headers['x-jury-authorization'], config);
      await mkdir(config.cacheDir, { recursive: true });
      const taskId = digest({ jobId: input.jobId, worker: config.worker.key, manager: config.manager.toLowerCase(), seal: config.seal.toLowerCase() });
      const path = join(config.cacheDir, `${taskId.slice(2)}.json`);
      const conflict = message => Object.assign(new Error(message), { status: 409, code: 'INFERENCE_STATE_UNKNOWN' });
      try {
        const cached = JSON.parse(await readFile(path, 'utf8'));
        if (cached.requestHash !== digest(body)) throw conflict('同一工作不能變更模型或輸入後再次推論');
        res.end(json(cached.output)); return;
      } catch (error) { if (error.code !== 'ENOENT') throw error; }
      if (req.headers['x-jury-cache-only'] === '1') throw conflict('恢復模式找不到既有成果；停止重新推論以避免再次扣费');
      requireValue(!busy, 'Worker 忙碌中，請稍後恢復原工作'); busy = true;
      try {
        try { await writeFile(`${path}.claim`, json({ requestHash: digest(body), createdAt: new Date().toISOString(), model: input.model }), { flag: 'wx', mode: 0o600, flush: true }); }
        catch (error) { if (error.code === 'EEXIST') throw conflict('上次推論結果未知，需人工核對帳單；不自動重試'); throw error; }
        const output = await infer(input);
        await writeFile(`${path}.tmp`, json({ requestHash: digest(body), output }), { mode: 0o600, flush: true }); await rename(`${path}.tmp`, path);
        res.end(json(output));
      } finally { busy = false; }
    } catch (error) {
      res.statusCode = [409, 429].includes(error.status) ? error.status : 400;
      if (error.retryAfter && (/^\d+$/.test(error.retryAfter) || Number.isFinite(Date.parse(error.retryAfter)))) res.setHeader('Retry-After', error.retryAfter);
      res.end(json({ error: error.status === 409 ? error.message : 'Worker 無法完成此請求；請檢查授權、模型可用性與執行日誌。', code: error.status === 409 ? 'INFERENCE_STATE_UNKNOWN' : 'WORKER_ERROR', retryAfter: error.retryAfter || null }));
    }
  });
}
export async function registerService(socketPath, port) {
  const request = (method, body) => new Promise((resolve, reject) => {
    const req = httpRequest({ socketPath, path: '/services', method, headers: { 'Content-Type': 'application/json' } }, res => {
      let text = ''; res.on('data', data => text += data); res.on('end', () => {
        if (res.statusCode !== 200) return reject(new Error('sealed service registration failed'));
        try { resolve(JSON.parse(text)); } catch (error) { reject(error); }
      });
    });
    req.on('error', reject); req.setTimeout(10000, () => req.destroy(new Error('sealed socket timeout'))); req.end(body ? json(body) : undefined);
  });
  const existing = await request('GET');
  const services = (existing.services || []).filter(service => service.path !== '/api/review');
  services.push({ path: '/api/review', method: 'POST', description: 'Music review using fixed public analysis and a model-version-bound work receipt', backend: `http://127.0.0.1:${port}` });
  await request('POST', { services });
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const worker = WORKERS.find(w => w.key === process.env.JURY_WORKER_KEY);
  const config = { worker, manager: process.env.JURY_MANAGER_ADDRESS, seal: process.env.AGENT_SEAL, apiKey: process.env.ZG_ROUTER_API_KEY?.trim() || process.env.VITE_ZG_ROUTER_API_KEY?.trim() || process.env.OPENAI_API_KEY?.trim(), models: (process.env.JURY_ALLOWED_MODELS || '0gm-1.0-35b-a3b,glm-5.3').split(','), cacheDir: process.env.JURY_CACHE_DIR };
  requireValue(worker && config.manager && config.seal && config.apiKey && process.env.SEAL_SIGN_SOCK, '需要在已部署 sealed Agent 內設定 worker、manager、模型金鑰及 sign socket');
  requireValue(isAbsolute(config.cacheDir || ''), 'JURY_CACHE_DIR 必須明確指定已確認可持久化的絕對路徑，不能依賴目前工作目錄');
  const server = createReviewServer(config);
  server.listen(8788, '127.0.0.1', async () => {
    try { await registerService(process.env.SEAL_SIGN_SOCK, 8788); console.log('Music review service registered through sealed /api/review'); }
    catch { console.error('Service registration failed'); server.close(); process.exitCode = 1; }
  });
}
