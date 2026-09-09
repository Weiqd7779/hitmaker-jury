import { formatEther, parseEther, sha256 } from 'ethers';
import { MUSIC, WORKERS, ROUTER, PRESENTATION_BATCH, digest, fixedAudio, json, requireValue } from './protocol.mjs';

export function presentationConfig(env = process.env) {
  const serverKey = env.ZG_ROUTER_API_KEY?.trim();
  const key = serverKey || env.VITE_ZG_ROUTER_API_KEY?.trim() || '';
  const base = (env.ZG_ROUTER_URL || (!serverKey ? env.VITE_ZG_ROUTER_URL : '') || ROUTER).replace(/\/$/, '');
  const url = new URL(base);
  requireValue(url.protocol === 'https:' && ['router-api.0g.ai', 'router-api-testnet.integratenetwork.work'].includes(url.hostname) && !url.username && !url.password && !url.search && !url.hash && url.pathname === '/v1', 'Router 端點不在已核對的允許清單');
  return { key, base, model: env.PRESENTATION_MODEL?.trim() || (url.hostname.includes('testnet') ? 'qwen2.5-omni' : '0gm-1.0-35b-a3b') };
}
export function reviewRequest(worker, model) {
  return { model, messages: [
    { role: 'system', content: `${worker.objective} 使用繁體中文，只回傳 JSON：{"score":0到100的數字,"headline":"短標題","critique":"兩句評論"}。評論不是客觀品質證明。` },
    { role: 'user', content: MUSIC.notes },
  ], max_tokens: 400, temperature: 0.7, response_format: { type: 'json_object' }, verify_tee: true };
}
export function estimateCost(request, model) {
  requireValue(/^\d+$/.test(model.pricing?.prompt) && /^\d+$/.test(model.pricing?.completion), '模型未提供可檢查的 neuron 定價，停止付費請求');
  const inputBound = BigInt(Buffer.byteLength(json(request.messages)) + 256);
  const estimate = inputBound * BigInt(model.pricing.prompt) + BigInt(request.max_tokens) * BigInt(model.pricing.completion);
  requireValue(estimate <= parseEther('0.01'), '保守估算超過每次 0.01 0G，停止請求');
  return formatEther(estimate);
}
export class Presentation {
  constructor(store, config = presentationConfig(), fetcher = fetch) { this.store = store; this.config = config; this.fetcher = fetcher; this.running = false; }
  summary() {
    const saved = this.store.presentation();
    return {
      schema: 'jury-presentation-v1', batch: PRESENTATION_BATCH, status: saved?.status || 'empty', running: this.running,
      keyConfigured: Boolean(this.config.key), router: saved?.router || this.config.base, requestedModel: saved?.requestedModel || this.config.model,
      attempts: saved?.attempts || 0, requestLimit: 3, estimatedPerRequestLimit0G: '0.01',
      entries: saved?.entries || [], error: saved?.error || (saved?.status === 'running' && !this.running ? '上次執行已中斷；保留結果與請求計數，不自動再次扣费' : null),
      music: { ...MUSIC, audioHash: sha256(fixedAudio()) }, workers: saved?.workers || WORKERS.map(({ objective, ...worker }) => worker),
      chain: { identity: 'not-deployed', reputation: 'not-submitted', storage: 'local-only', payment: 'simulated' },
    };
  }
  async generate() {
    requireValue(this.config.key, '尚未設定 Router API Key');
    if (this.store.presentation()) return this.summary();
    const state = { schema: 'jury-presentation-cache-v1', status: 'running', attempts: 0, requestedModel: this.config.model, router: this.config.base, createdAt: new Date().toISOString(), workers: WORKERS.map(({ objective, ...worker }) => worker), entries: [] };
    if (!this.store.beginPresentation(state)) return this.summary();
    this.running = true;
    try {
      const catalogResponse = await this.fetcher(`${this.config.base}/models`, { signal: AbortSignal.timeout(20000), redirect: 'error' });
      requireValue(catalogResponse.ok, `模型目錄 HTTP ${catalogResponse.status}`);
      const catalog = await catalogResponse.json();
      const model = catalog.data?.find(item => item.id === this.config.model && item.type === 'chatbot');
      requireValue(model, '指定聊天模型目前不可用；不改用其他模型或帳戶重試');
      for (const worker of WORKERS) {
        const request = reviewRequest(worker, this.config.model);
        const estimatedCost0G = estimateCost(request, model);
        const entry = { worker: worker.key, status: 'attempted', requestedModel: this.config.model, request, requestHash: digest(request), estimatedCost0G, startedAt: new Date().toISOString() };
        state.entries.push(entry); state.attempts++; this.store.savePresentation(state);
        const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${this.config.key}`, 'X-0G-Provider-Trust-Mode': 'verified', 'X-0G-Provider-Allow-Fallbacks': 'false', 'Allow-Fallbacks': 'false' };
        for (const [part, suffix] of [['prompt', 'Prompt'], ['completion', 'Completion']]) {
          const price = Number(model.pricing_usd?.[part]);
          requireValue(Number.isFinite(price) && price > 0, '缺少 USD 單價，無法設定 Router 價格上限');
          headers[`X-0G-Provider-Max-Price-Usd-${suffix}`] = (price * 1000000).toFixed(8);
        }
        const response = await this.fetcher(`${this.config.base}/chat/completions`, { method: 'POST', headers, body: json(request), signal: AbortSignal.timeout(120000), redirect: 'error' });
        entry.httpStatus = response.status;
        if (!response.ok) {
          entry.status = 'failed'; entry.retryAfter = response.headers.get('Retry-After');
          this.store.savePresentation(state);
          throw new Error(response.status === 401 || response.status === 403 ? `Router 授權失敗 HTTP ${response.status}；已停止，請檢查此環境的 Key` : `Router HTTP ${response.status}；不自動重試，請核對餘額或供應商狀態`);
        }
        const data = await response.json();
        requireValue(!json(data).includes(this.config.key), 'Router 回應包含敏感資訊，已停止保存與後續請求');
        const content = data.choices?.[0]?.message?.content;
        entry.model = data.model || null; entry.requestId = data.x_0g_trace?.request_id || data.id || null;
        entry.rawContent = typeof content === 'string' ? content.replaceAll(this.config.key, '[redacted]') : null;
        entry.provider = data.x_0g_trace?.provider || null; entry.routerTeeVerified = data.x_0g_trace?.tee_verified ?? null;
        entry.usage = data.usage ? { promptTokens: data.usage.prompt_tokens ?? null, completionTokens: data.usage.completion_tokens ?? null, totalTokens: data.usage.total_tokens ?? null } : null;
        const billed = data.x_0g_trace?.billing?.total_cost;
        entry.billedCost0G = typeof billed === 'string' && /^\d+$/.test(billed) ? formatEther(BigInt(billed)) : null;
        entry.receivedAt = new Date().toISOString();
        this.store.savePresentation(state);
        requireValue(entry.model === this.config.model, 'Router 回報模型與指定模型不同；保留回應，停止後續請求');
        requireValue(typeof content === 'string', '模型沒有回傳評論文字；不補上預設評論');
        const cleaned = content.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
        const review = JSON.parse(cleaned);
        requireValue(typeof review.score === 'number' && review.score >= 0 && review.score <= 100 && typeof review.headline === 'string' && typeof review.critique === 'string' && review.critique.trim(), '模型評論格式不完整；已保存原始文字，不自動再次付費');
        entry.review = { score: review.score, headline: review.headline.slice(0, 120), critique: review.critique.slice(0, 4000) };
        entry.contentHash = digest(content); entry.status = 'completed'; this.store.savePresentation(state);
        requireValue(!entry.billedCost0G || Number(entry.billedCost0G) <= 0.01, '回報費用超過 0.01 0G，停止後續請求');
      }
      state.status = 'completed'; state.completedAt = new Date().toISOString();
    } catch (error) {
      state.status = 'blocked';
      state.error = String(error.message).replaceAll(this.config.key, '[redacted]').replace(/(?:sk-|mk-)[A-Za-z0-9_-]+/g, '[redacted]').slice(0, 500);
    } finally { this.running = false; this.store.savePresentation(state); }
    return this.summary();
  }
}
