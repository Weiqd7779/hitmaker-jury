import { randomUUID } from 'node:crypto';
import { Contract, parseEther, sha256 } from 'ethers';
import { DOMAIN, MUSIC, WORKERS, ROUTER, RPC, json, digest, fixedAudio, requireValue, sameAddress, inspectService, taskReveal, paymentData } from './protocol.mjs';
import { canonicalABI, canonicalInterface, verifiedInterface, providerFor, checkDomain, readIdentity, JournaledWallet } from './chain.mjs';
import { StorageAdapter } from './storage.mjs';
import { captureCompute } from './compute.mjs';
import { verifyBundle } from './verify.mjs';

export function configuration(env = process.env) {
  return {
    enabled: env.CAREER_ENABLE_TRANSACTIONS === '1', managerKey: env.CAREER_MANAGER_PRIVATE_KEY || '',
    maxLiveJobs: Number(env.CAREER_MAX_LIVE_JOBS || '1'),
    routerKey: env.ZG_ROUTER_API_KEY?.trim() || env.VITE_ZG_ROUTER_API_KEY?.trim() || '',
    rpc: env.ZG_RPC_URL || RPC, modelA: env.CAREER_MODEL_A || '0gm-1.0-35b-a3b', modelB: env.CAREER_MODEL_B || 'glm-5.3',
    workers: WORKERS.map(worker => ({ ...worker, agentId: env[`CAREER_${worker.key.toUpperCase()}_AGENT_ID`] || '', endpoint: env[`CAREER_${worker.key.toUpperCase()}_URL`] || '' })),
  };
}
export class Career {
  constructor(store, config = configuration()) {
    this.store = store; this.config = config; this.running = false;
    this.provider = providerFor(config.rpc);
    this.wallet = new JournaledWallet(this.provider, config.managerKey, store);
    this.storage = new StorageAdapter(this.wallet.wallet, { rpc: config.rpc });
  }
  readiness() {
    const missing = [];
    if (!this.config.enabled) missing.push('尚未授權真實測試網交易：CAREER_ENABLE_TRANSACTIONS=1');
    if (!this.wallet.wallet) missing.push('尚未配置 CAREER_MANAGER_PRIVATE_KEY（雇主不可為 Worker owner）');
    for (const worker of this.config.workers) {
      if (!/^[1-9][0-9]*$/.test(worker.agentId)) missing.push(`${worker.name} 尚未配置鏈上 Agent ID`);
      try { const u = new URL(worker.endpoint); requireValue(u.protocol === 'https:' && !u.username && !u.password && u.pathname === '/' && !u.search && !u.hash, 'URL'); }
      catch { missing.push(`${worker.name} 尚未配置 HTTPS sealed Agent origin`); }
    }
    const ids = this.config.workers.map(w => w.agentId).filter(Boolean);
    if (new Set(ids).size !== ids.length) missing.push('三位 Worker 必須使用不同鏈上身分');
    if (this.config.modelA === this.config.modelB) missing.push('模型 A 與模型 B 必須不同');
    if (!Number.isSafeInteger(this.config.maxLiveJobs) || this.config.maxLiveJobs < 1 || this.config.maxLiveJobs > 10) missing.push('CAREER_MAX_LIVE_JOBS 必須介於 1 到 10，預設只允許一場付費展示');
    return { ready: missing.length === 0, missing };
  }
  summary() {
    return { ...this.readiness(), paidJobLimit: this.config.maxLiveJobs, paidJobsCreated: this.store.list().filter(j => j.kind === 'live').length, manager: this.wallet.wallet?.address || null, workers: this.config.workers.map(({ endpoint, objective, ...w }) => w), music: { ...MUSIC, audioHash: sha256(fixedAudio()) }, modelA: this.config.modelA, modelB: this.config.modelB, domain: DOMAIN, running: this.running, jobs: this.store.list() };
  }
  create(kind, requestId = randomUUID()) {
    requireValue(['seed', 'live'].includes(kind), '未知工作種類');
    requireValue(typeof requestId === 'string' && /^[0-9a-f-]{36}$/.test(requestId), '建立工作需要固定的 requestId');
    const existing = this.store.list().find(job => job.requestId === requestId);
    if (existing) {
      requireValue(existing.kind === kind && sameAddress(existing.manager, this.wallet.wallet?.address), '重複請求的種類或雇主不符');
      return existing;
    }
    requireValue(this.readiness().ready, this.readiness().missing.join('；'));
    requireValue(!this.running && !this.store.list().some(j => j.status !== 'completed'), '請先恢復尚未完成的工作');
    const seed = this.store.list().find(j => j.kind === 'seed' && j.status === 'completed');
    if (kind === 'seed') requireValue(!seed, '真實種子工作已存在，不重複建立');
    if (kind === 'live') {
      requireValue(seed && seed.works[0].record.worker.agentId === this.config.workers[0].agentId && sameAddress(seed.manager, this.wallet.wallet.address), '先為目前的主角身分與雇主完成模型 A 種子工作');
      requireValue(this.store.list().filter(j => j.kind === 'live').length < this.config.maxLiveJobs, '已達真實付費工作次數上限；排練請使用唯讀重播，不要清除資料庫');
    }
    const model = kind === 'seed' ? this.config.modelA : this.config.modelB;
    const workers = kind === 'seed' ? this.config.workers.slice(0, 1) : this.config.workers;
    const job = { id: randomUUID(), requestId, manager: this.wallet.wallet.address, kind, model, status: 'pending', createdAt: new Date().toISOString(), events: [], works: workers.map(w => ({ key: w.key, agentId: w.agentId, endpoint: w.endpoint, amount: w.amount, objectiveHash: digest(w.objective), status: 'pending' })) };
    this.event(job, 'job', 'pending', `${kind === 'seed' ? '真實種子工作' : 'Music Jury'} 已建立；Manager 選人與驗收為展示腳本`);
    return job;
  }
  event(job, key, status, message) {
    job.events.push({ id: randomUUID(), at: new Date().toISOString(), key, status, message });
    this.store.put(job);
  }
  async run(jobId) {
    requireValue(!this.running, '另一筆工作正在執行');
    requireValue(this.readiness().ready, this.readiness().missing.join('；'));
    const job = this.store.get(jobId);
    requireValue(job, '工作不存在');
    requireValue(sameAddress(job.manager, this.wallet.wallet.address), 'Manager 雇主已改變，不能使用新帳戶恢復舊工作');
    if (job.status === 'completed') return job;
    this.running = true;
    job.status = 'running'; delete job.error; this.store.put(job);
    try {
      await checkDomain(this.provider);
      const response = await fetch(`${ROUTER}/models`, { signal: AbortSignal.timeout(20000) });
      requireValue(response.ok, '無法取得即時模型目錄');
      const catalog = await response.json();
      requireValue(catalog.data?.some(m => m.id === job.model), '指定模型目前不在 Router 目錄');
      for (const work of job.works) {
        if (work.status === 'completed') continue;
        const worker = this.config.workers.find(w => w.key === work.key);
        requireValue(worker && worker.agentId === work.agentId && worker.endpoint === work.endpoint && digest(worker.objective) === work.objectiveHash, 'Worker 身分、端點或角色設定已變更，不能繼續此工作');
        if (!work.record) {
          requireValue(!work.retryAt || Date.now() >= work.retryAt, `請遵守 Retry-After，於 ${new Date(work.retryAt || Date.now()).toISOString()} 後恢復`);
          const identity = await readIdentity(this.provider, worker.agentId);
          requireValue(!sameAddress(identity.owner, this.wallet.wallet.address), 'Manager 不能是 Worker owner');
          const request = work.request || { method: 'POST', uri: '/api/review', body: json({ jobId: job.id, kind: job.kind, workerKey: worker.key, model: job.model, manager: this.wallet.wallet.address, payee: identity.seal, amount: work.amount, music: { ...MUSIC, audioHash: sha256(fixedAudio()) } }) };
          const cacheOnly = Boolean(work.inferenceAttempted);
          work.request = request; work.inferenceAttempted = true;
          work.status = 'reviewing'; this.event(job, worker.key, 'running', `${worker.name} 正在真實推論：${job.model}`);
          const { getBytes } = await import('ethers');
          const taskAuthorization = await this.wallet.wallet.signMessage(getBytes(digest(request.body)));
          const res = await fetch(`${worker.endpoint.replace(/\/$/, '')}/api/review`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Client-Address': this.wallet.wallet.address, 'X-Jury-Authorization': taskAuthorization, 'X-Jury-Cache-Only': cacheOnly ? '1' : '0' }, body: request.body, signal: AbortSignal.timeout(180000), redirect: 'error' });
          const retryAfter = res.headers.get('Retry-After');
          if (retryAfter) {
            work.retryAt = /^\d+$/.test(retryAfter) ? Date.now() + Number(retryAfter) * 1000 : Date.parse(retryAfter);
            this.store.put(job);
          }
          requireValue(res.status !== 409, 'Worker 推論結果未知、快取遺失或輸入衝突；已停止重新扣費，請先核對既有推論與帳單');
          requireValue(res.ok, `Worker 回應 HTTP ${res.status}${work.retryAt ? '；已保存 Retry-After，請稍後恢復原工作' : ''}`);
          requireValue(Number(res.headers.get('content-length') || 0) < 1024 * 1024, 'Agent 回應過大');
          const body = await res.text();
          requireValue(Buffer.byteLength(body) <= 1024 * 1024, 'Agent 回應過大');
          const block = await this.provider.getBlock('latest');
          const record = { schema: '0g-career-work-v1', domain: DOMAIN, jobId: job.id, kind: job.kind, manager: this.wallet.wallet.address, worker: { key: worker.key, name: worker.name, agentId: worker.agentId, model: job.model, payee: identity.seal, amount: work.amount }, request, response: { status: res.status, body, proofHeader: res.headers.get('X-Agent-Proof') }, observedBlock: { number: block.number, hash: block.hash } };
          const { proof } = inspectService(record, identity.seal);
          const historicalIdentity = await readIdentity(this.provider, worker.agentId, block.number);
          requireValue(proof.dataHashes.every(h => historicalIdentity.dataHashes.includes(h)), 'Agent data 尚未錨定至鏈上；等待 runtime 完成同步後再試');
          work.record = record; work.status = 'service-verified'; this.event(job, worker.key, 'passed', `${worker.name} service proof 與工作內容已核對`);
        }
        if (!work.compute) {
          work.compute = await captureCompute(JSON.parse(work.record.response.body));
          this.event(job, worker.key, 'passed', `${worker.name} Compute 供應商回應簽章已取得；非硬體 attestation`);
        }
        if (!work.storage?.stored) {
          if (work.storage?.attempted) {
            requireValue(await this.storage.download(work.storage.rootHash) === json(work.record), 'Storage 上次上傳狀態未知；停止重複付費，需查驗既有 rootHash');
            work.storage.stored = true;
          } else {
            const { rootHash } = await this.storage.root(work.record);
            work.storage = { rootHash, attempted: true, stored: false }; this.store.put(job);
            const uploaded = await this.storage.upload(work.record, this.wallet);
            requireValue(uploaded.rootHash === rootHash, 'Storage rootHash 不符');
            work.storage = { ...uploaded, attempted: true, stored: true };
          }
          this.event(job, worker.key, 'passed', `${worker.name} 成果已存入 0G Storage`);
        }
        work.status = 'accepted';
        if (!work.feedback?.txHash) {
          inspectService(work.record, work.record.worker.payee, { historical: Boolean(this.store.getTransaction(`${job.id}:${worker.key}:feedback`)) });
          const data = canonicalInterface.encodeFunctionData('giveFeedback', [worker.agentId, 1n, 0, 'accepted', job.model, '/api/review', `0g://storage/${work.storage.rootHash}`, digest(work.record)]);
          const receipt = await this.wallet.send(`${job.id}:${worker.key}:feedback`, { to: DOMAIN.canonical, data });
          const contract = new Contract(DOMAIN.canonical, canonicalABI, this.provider);
          const before = await contract.getLastIndex(worker.agentId, work.record.manager, { blockTag: receipt.blockNumber - 1 });
          const after = await contract.getLastIndex(worker.agentId, work.record.manager, { blockTag: receipt.blockNumber });
          requireValue(after === before + 1n, 'feedback 索引無法唯一關聯');
          work.feedback = { txHash: receipt.hash, index: String(after) }; this.store.put(job);
        }
        if (!work.feedback.attestTxHash) {
          const { proof } = inspectService(work.record, work.record.worker.payee, { historical: Boolean(this.store.getTransaction(`${job.id}:${worker.key}:attest`)) });
          const data = verifiedInterface.encodeFunctionData('attestFeedbackWithTask', [worker.agentId, work.feedback.index, proof, taskReveal(work.record.request, work.record.response)]);
          const receipt = await this.wallet.send(`${job.id}:${worker.key}:attest`, { to: DOMAIN.verified, data });
          work.feedback.attestTxHash = receipt.hash;
          this.event(job, worker.key, 'passed', `${worker.name} 雇主 feedback 與 proof-backed 標記已確認`);
        }
        if (!work.payment) {
          const receipt = await this.wallet.send(`${job.id}:${worker.key}:payment`, { to: work.record.worker.payee, value: parseEther(work.amount), data: paymentData(work.record) });
          work.payment = { txHash: receipt.hash };
          this.event(job, worker.key, 'passed', `${worker.name} 已收到 ${work.amount} 測試網 0G`);
        }
        work.verification = await verifyBundle(work, { provider: this.provider, storage: this.storage });
        requireValue(work.verification.ok, '完整證據尚未全部通過；保留已完成步驟，不增加履歷');
        work.status = 'completed'; this.event(job, worker.key, 'passed', `${worker.name} 已完整結案，履歷新增一筆`);
      }
      job.status = 'completed'; this.event(job, 'job', 'passed', 'Music Jury 完整結案；證據包可由另一位雇主獨立驗證');
    } catch (error) {
      job.status = 'blocked';
      job.error = (error.shortMessage || error.message || '外部服務失敗').replace(/(?:sk-|mk-)[A-Za-z0-9_-]+|0x[0-9a-fA-F]{64}/g, '[redacted]').slice(0, 400);
      this.event(job, 'job', 'failed', job.error);
    } finally { this.running = false; this.store.put(job); }
    return job;
  }
}
