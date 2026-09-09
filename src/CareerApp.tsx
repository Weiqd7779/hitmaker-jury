import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowRight, Check, ChevronRight, Download, ExternalLink, Headphones, History, LoaderCircle, Music2, RefreshCw, ShieldCheck, X } from 'lucide-react';
import { PixelAvatar } from './components/PixelAvatar';
import { api, careerCounts, reviewOf, type CareerState, type Job, type Work, type WorkerKey } from './services/career';
import './career.css';

const labels: Record<string, string> = { pending: '待執行', reviewing: '正在評論', 'service-verified': '回應已驗證', accepted: '已接受，待結案', running: '執行中', blocked: '需要處理', completed: '完整結案', 'verification-unavailable': '需要重新驗證' };
const checkLabels: Record<string, string> = { record: '工作與網路', identity: '歷史 Agent 身分', service: '回應與模型版本關聯', compute: 'Compute 回應簽章', artifact: 'Storage 成果完整性', feedback: '雇主評價與驗證標記', payment: '工作報酬' };
const short = (value: string) => `${value.slice(0, 8)}…${value.slice(-6)}`;
const explorer = (hash: string, type = 'tx') => `https://chainscan-galileo.0g.ai/${type}/${hash}`;

function Status({ status }: { status: string }) {
  return <span className={`career-status ${status === 'completed' || status === 'passed' ? 'good' : status === 'blocked' || status === 'failed' ? 'bad' : ''}`}>{labels[status] || status}</span>;
}
function TransactionLink({ hash, label }: { hash?: string; label: string }) {
  return hash ? <a className="evidence-link" href={explorer(hash)} target="_blank" rel="noopener noreferrer">{label}<span>{short(hash)} <ExternalLink size={12} /></span></a> : <div className="evidence-link muted">{label}<span>尚未產生</span></div>;
}

export default function CareerApp() {
  const [state, setState] = useState<CareerState | null>(null);
  const [error, setError] = useState('');
  const [selectedJob, setSelectedJob] = useState<string | null>(null);
  const [selectedWorker, setSelectedWorker] = useState<WorkerKey | null>(null);
  const [consent, setConsent] = useState<'seed' | 'live' | 'resume' | null>(null);
  const [busy, setBusy] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [replay, setReplay] = useState<{ jobId: string; visible: number; startedAt: number } | null>(null);
  const audio = useRef<HTMLAudioElement>(null);
  const closeDrawer = useRef<HTMLButtonElement>(null);
  const restoreFocus = useRef<HTMLElement | null>(null);
  const refresh = useCallback(async () => {
    try { setState(await api<CareerState>('/api/career')); setError(''); }
    catch { setError('無法連線至 Career API。請使用 npm run dev 同時啟動前端與本機伺服器。'); }
  }, []);
  useEffect(() => {
    let active = true;
    const poll = async () => { try { const data = await api<CareerState>('/api/career'); if (active) { setState(data); setError(''); } } catch { if (active) setError('Career API 暫時無法連線，未將任何證據標示為成功。'); } };
    void poll(); const timer = setInterval(() => void poll(), 2500);
    return () => { active = false; clearInterval(timer); };
  }, []);
  useEffect(() => {
    if (!selectedWorker && !consent) return;
    const previous = document.activeElement as HTMLElement | null;
    restoreFocus.current = previous;
    const dialog = document.querySelector<HTMLElement>('[role="dialog"]');
    const focusable = () => Array.from(dialog?.querySelectorAll<HTMLElement>('button:not(:disabled), a[href], select, input') || []);
    focusable()[0]?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !busy) { setSelectedWorker(null); setConsent(null); }
      if (event.key === 'Tab') {
        const nodes = focusable(), first = nodes[0], last = nodes[nodes.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
      }
    };
    document.addEventListener('keydown', onKey); const overflow = document.body.style.overflow; document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = overflow; previous?.focus(); };
  }, [selectedWorker, consent, busy]);
  const job = state?.jobs.find(j => j.id === selectedJob) || state?.jobs[0];
  const seedExists = state?.jobs.some(j => j.kind === 'seed' && j.status === 'completed') || false;
  const unfinished = state?.jobs.find(j => j.status !== 'completed');
  const selected = state?.workers.find(w => w.key === selectedWorker);
  const histories = state?.jobs.flatMap(j => j.works.filter(w => w.key === selectedWorker && w.record).map(w => ({ job: j, work: w }))) || [];
  const [historyFilter, setHistoryFilter] = useState('all');
  const paidQuotaReached = Boolean(state && !unfinished && seedExists && state.paidJobsCreated >= state.paidJobLimit);
  const visibleEvents = job?.events.slice(0, replay?.jobId === job.id ? replay.visible : undefined) || [];
  useEffect(() => {
    if (!replay || !job || replay.jobId !== job.id) return;
    const count = job.events.length;
    const timer = setInterval(() => setReplay(previous => {
      if (!previous || previous.visible >= count) { clearInterval(timer); return previous; }
      return { ...previous, visible: previous.visible + 1 };
    }), 700);
    return () => clearInterval(timer);
  }, [replay?.startedAt, job?.id, job?.events.length]);
  const startReplay = () => {
    if (!job || state?.running) return;
    setSelectedJob(job.id); setReplay({ jobId: job.id, visible: 0, startedAt: Date.now() });
    if (audio.current) { audio.current.currentTime = 0; void audio.current.play().catch(() => setPlaying(false)); }
  };
  const run = async () => {
    if (!state || !consent) return;
    setBusy(true); setError('');
    try {
      let requestId: string | undefined;
      if (consent !== 'resume') {
        const saved = sessionStorage.getItem('career-create-intent');
        const intent = saved ? JSON.parse(saved) as { kind: string; requestId: string } : null;
        requestId = intent?.kind === consent ? intent.requestId : crypto.randomUUID();
        sessionStorage.setItem('career-create-intent', JSON.stringify({ kind: consent, requestId }));
      }
      const result = await api<{ id: string }>(consent === 'resume' ? `/api/jobs/${unfinished?.id}/resume` : '/api/jobs', state.token, { kind: consent, requestId, consent: 'run-paid-testnet' });
      sessionStorage.removeItem('career-create-intent');
      setReplay(null); setSelectedJob(result.id); setConsent(null); await refresh();
      if (audio.current) void audio.current.play().catch(() => setPlaying(false));
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  };
  const verify = async (j: Job, work: Work) => {
    if (!state) return;
    setBusy(true);
    try { await api(`/api/jobs/${j.id}/verify`, state.token, { worker: work.key }); await refresh(); }
    catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  };
  return <div className="career-app">
    <header className="career-header"><a className="career-brand" href="/"><span className="brand-icon"><Music2 size={21} /></span>HITMAKER <span>CAREERS</span></a><div className="header-meta"><span className="network-dot" />0G Galileo <span className="header-divider">/</span><span>PUBLIC DEMO</span></div></header>
    <main className="career-layout">
      <div className="career-story">
        <section className="career-hero"><div className="eyebrow">VERIFIABLE AGENT CAREER NETWORK</div><h1>好作品留下聲音。<br /><span>好工作留下證據。</span></h1><p>讓音樂評審不只是一次 API 呼叫。每次交付，都成為下一位雇主能自行查驗的工作經歷。</p><div className="hero-tags"><span>Model-versioned</span><span>Evidence-backed</span><span>Independently verifiable</span></div></section>
        {error && <div className="career-alert" role="alert">{error}<button onClick={() => void refresh()} aria-label="重新連線"><RefreshCw size={16} /></button></div>}
        {state && !state.ready && <details className="setup-panel" open><summary>真實執行尚未配置 <span>{state.missing.length} 項待處理</span></summary><ul>{state.missing.map(item => <li key={item}>{item}</li>)}</ul><p>沒有假履歷、假 proof 或預設成功狀態。部署與授權完成後，才能建立第一筆真實工作。</p></details>}
        <section className="session-card"><div className="session-heading"><div><div className="eyebrow">NOW HIRING / MUSIC JURY</div><h2>三雙不同的耳朵，一份可驗證的經歷。</h2></div><Headphones size={28} /></div>
          <div className="music-player"><span className={`record-disc ${playing ? 'spinning' : ''}`}><Music2 size={22} /></span><div className="track-info"><strong>{state?.music.name || '走音小星星 · Career Session'}</strong><small>15 秒固定合成素材 · 根據預先準備的分析資料評論</small><audio ref={audio} src="/api/music.wav" controls preload="metadata" onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} onEnded={() => setPlaying(false)} /></div></div>
          <details className="analysis-details"><summary>查看輸入分析與素材雜湊</summary><p>{state?.music.notes}</p><p className="muted">{state?.music.analysisSource}</p><code>{state?.music.audioHash || '等待 API 提供真實素材 hash'}</code></details>
          <div className="job-terms"><div><small>WORKER REWARD</small><strong>0.003 <span>測試網 0G</span></strong><small>三位各 0.001；另計 Gas、Storage 與 Compute 費用</small></div><div><small>CURRENT WORK MODEL</small><strong className="model-name">{state?.modelB || '等待模型設定'}</strong><small>只按工作模型分版，不代表完整能力快照</small></div></div>
          <div className="session-actions"><span>Manager 選人與接受成果：<b>展示腳本</b><br /><small>平台不判斷音樂評論品質。</small></span><button className="primary-button" disabled={!state?.ready || state.running || busy || paidQuotaReached || Boolean(replay)} onClick={() => setConsent(unfinished ? 'resume' : seedExists ? 'live' : 'seed')}>{state?.running ? <><LoaderCircle className="spin" size={16} />工作進行中</> : <>{paidQuotaReached ? '已達真實工作次數上限' : unfinished ? '恢復未完成工作' : seedExists ? '新增真實三人工作（會支出）' : '先建立真實種子工作'}<ArrowRight size={16} /></>}</button></div>
        </section>
        <section className="jury-section"><div className="section-heading"><div><div className="eyebrow">THE TALENT</div><h2>不同觀點，同樣可查驗。</h2></div><span className="muted">3 WORKERS + 1 DEMO CANDIDATE</span></div>
          <div className="jury-grid">{state?.workers.map(worker => {
            const work = job?.works.find(w => w.key === worker.key), review = reviewOf(work);
            const counts = careerCounts(state.jobs, worker.agentId, state.modelB);
            return <article className={`worker-card ${worker.key}`} key={worker.key}><div className="worker-topline"><span>{worker.title}</span><Status status={work?.status || 'pending'} /></div><div className="avatar-stage"><PixelAvatar character={worker.key} size="md" motion={work?.status === 'reviewing' ? worker.key === 'professor' ? 'furious' : worker.key === 'antisocial' ? 'groove' : 'jitter' : 'idle'} score={review?.score} hasStamp={false} /></div><h3>{worker.name}</h3><p className="worker-pitch">{review ? review.headline : worker.pitch}</p><p className="identity-label">{worker.agentId ? `Agent #${worker.agentId} · 待逐筆核對證據` : 'CHAIN IDENTITY NOT CONFIGURED'}</p><div className="career-counts"><div><strong>{counts.lifetime}</strong><small>Lifetime completed</small></div><div><strong>{counts.current}</strong><small>Current model</small></div></div><button className="resume-button" onClick={() => { setHistoryFilter('all'); setSelectedWorker(worker.key); }}>查看可驗證履歷<ChevronRight size={15} /></button></article>;
          })}</div>
          {!state && <div className="empty-state"><LoaderCircle className="spin" />正在取得真實角色設定與工作紀錄…</div>}
          <div className="candidate-row"><PixelAvatar character="candidate" size="sm" /><div><strong>Pop Critic</strong><p>「我想從流行市場的角度，加入這次討論。」</p><small>模擬候選角色 · 腳本安排未錄取 · 不產生 verified 履歷</small></div><span className="career-status">NOT HIRED</span></div>
        </section>
        <section className="history-section"><div className="section-heading"><div><div className="eyebrow">WORK HISTORY</div><h2>經歷不靠自述。</h2></div><History size={21} /></div>{state?.jobs.length ? <div className="job-list">{state.jobs.map(j => <button key={j.id} className={`job-row ${job?.id === j.id ? 'selected' : ''}`} onClick={() => { setReplay(null); setSelectedJob(j.id); }}><div><strong>{j.kind === 'seed' ? '真實種子工作 · 團隊測試' : 'Music Jury · 三人評審'}</strong><small>{j.model} · {new Date(j.createdAt).toLocaleString('zh-TW')}</small></div><Status status={j.status} /><ChevronRight size={16} /></button>)}</div> : <div className="empty-state"><History size={24} /><h3>第一筆經歷，從真實工作開始。</h3><p>這裡不會預填「43 筆工作」。完成種子工作後，它的證據才會出現在履歷中。</p></div>}</section>
        {job && <section className="session-card replay-panel"><div className="eyebrow">READ-ONLY REHEARSAL</div><h2>反覆排練，不反覆扣款。</h2><p>重播已保存的真實事件與音樂，不重新推論、上傳、評價或付款，也不增加履歷。原始事件時間保持不變。</p><div className="evidence-actions"><button disabled={state?.running} onClick={startReplay}>重播既有工作（不發交易）</button>{replay && <button onClick={() => { setReplay(null); audio.current?.pause(); }}>結束重播</button>}</div><small>已建立付費三人工作：{state?.paidJobsCreated ?? 0} / {state?.paidJobLimit ?? 1} 場。新增真實工作需要另外確認支出。</small></section>}
        <footer className="career-footer">Don't trust an agent's résumé. Verify the work behind it.<span>第一階段：公開素材 · 機密試工與完整能力版本化留待後續</span></footer>
      </div>
      <aside className="trust-trail"><div className="trail-title"><ShieldCheck size={21} /><div><h2>0G TRUST TRAIL</h2><span>事件來自實際工作，不是動畫計時器</span></div></div><div className="trail-boundary"><span className="eyebrow">TRUST BOUNDARY</span><p>驗證身分、交付與結算的證據。<br />不驗證評論品質、Agent 自主性或端到端機密性。</p></div>
        {job ? <>{replay && <div className="trail-boundary"><strong>唯讀重播 · 非即時執行</strong><p>正在重播既有紀錄，不會產生新支出或新履歷。</p></div>}<div className="trail-job"><span>{job.kind === 'seed' ? 'SEED WORK' : 'MUSIC JURY'}</span><code>{short(job.id)}</code><Status status={job.status} /></div><ol className="trail-events" aria-live="polite">{visibleEvents.map(event => <li key={event.id} className={event.status}><span className="event-mark">{event.status === 'passed' ? <Check size={12} /> : event.status === 'failed' ? '!' : '·'}</span><time>{new Date(event.at).toLocaleTimeString('zh-TW')}</time><p>{event.message}</p></li>)}</ol>{job.works.map(work => work.record && <button className="trail-evidence" key={work.key} onClick={() => { setHistoryFilter(job.model); setSelectedWorker(work.key); }}>檢視 {work.record.worker.name} 證據<ChevronRight size={14} /></button>)}</> : <div className="trail-waiting"><span className="waiting-dot" /><h3>等待第一筆真實工作</h3><p>身分解析、回應驗證、成果保存、雇主評價與付款確認，會逐項留下時間與證據。</p></div>}
        <div className="trail-note"><strong>可攜，不只可看。</strong><p>每筆工作可匯出證據包。另一位雇主可用獨立工具直接查鏈與取回成果，不需要平台資料庫。</p><code>npm run verify:career -- evidence.json</code></div>
      </aside>
    </main>
    {selected && <div className="dialog-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) setSelectedWorker(null); }}><section className="career-drawer" role="dialog" aria-modal="true" aria-labelledby="resume-title"><button ref={closeDrawer} className="close-dialog" aria-label="關閉履歷" onClick={() => setSelectedWorker(null)}><X /></button><div className="eyebrow">VERIFIABLE WORK EXPERIENCE</div><h2 id="resume-title">{selected.name} 的工作履歷</h2><p className="muted">同一個鏈上身分，依工作模型分開累積。測試雇主由同團隊控制，不宣稱獨立背書。</p><label className="version-filter">模型版本<select value={historyFilter} onChange={event => setHistoryFilter(event.target.value)}><option value="all">全部版本</option>{[...new Set([state!.modelA, state!.modelB, ...histories.map(h => h.job.model)])].map(model => <option key={model} value={model}>{model}</option>)}</select></label>
      {histories.filter(h => historyFilter === 'all' || h.job.model === historyFilter).map(({ job: j, work }) => <article className="work-evidence" key={j.id}><div className="section-heading"><h3>{j.kind === 'seed' ? '種子工作' : 'Music Jury'} · {short(j.id)}</h3><Status status={work.status} /></div><dl><dt>Performed by</dt><dd>{work.record!.worker.name} / Agent #{work.record!.worker.agentId}</dd><dt>工作模型</dt><dd>{work.record!.worker.model}</dd><dt>雇主</dt><dd>{work.record!.manager}</dd><dt>收款者</dt><dd>{work.record!.worker.payee}</dd></dl><blockquote>{reviewOf(work)?.critique}</blockquote><div className="evidence-actions"><button disabled={busy || state?.running} onClick={() => void verify(j, work)}><RefreshCw size={14} />重新驗證</button><a href={`/api/jobs/${j.id}/evidence?worker=${work.key}`} download><Download size={14} />匯出證據包</a></div>{work.verification && <div className="verification-result"><strong>{work.verification.ok ? '完整工作證據已通過' : '尚未全部通過；查詢失敗不等於造假'}</strong><small>最近查驗：{new Date(work.verification.checkedAt).toLocaleString('zh-TW')}</small>{work.verification.checks.map(check => <details key={check.key}><summary><span className={check.status === 'passed' ? 'text-emerald-400' : 'text-amber-400'}>{check.status === 'passed' ? 'PASS' : 'CHECK'}</span>{checkLabels[check.key] || check.key}</summary><p>{check.detail}</p></details>)}</div>}<TransactionLink hash={work.feedback?.txHash} label="ERC-8004 feedback" /><TransactionLink hash={work.feedback?.attestTxHash} label="ServeProof 驗證標記" /><TransactionLink hash={work.payment?.txHash} label="Worker 報酬" />{work.storage?.rootHash && <div className="storage-root"><small>0G STORAGE ROOT HASH</small><code>{work.storage.rootHash}</code><p>獨立驗證工具會按此 rootHash 重新下載並核對成果。</p></div>}<details className="raw-proof"><summary>檢視原始 X-Agent-Proof</summary><pre>{work.record!.response.proofHeader}</pre></details></article>)}
      {!histories.filter(h => historyFilter === 'all' || h.job.model === historyFilter).length && <div className="empty-state">此模型版本尚無真實工作紀錄。</div>}<p className="drawer-limit">模型識別是簽署工作回應中的欄位，不等同精確權重或完整能力證明。原始 proof 過期不會自動否定已上鏈的歷史工作。</p></section></div>}
    {consent && <div className="dialog-backdrop"><section className="consent-dialog" role="dialog" aria-modal="true" aria-labelledby="consent-title"><h2 id="consent-title">確認真實測試網操作</h2><p>{consent === 'resume' ? '恢復既有工作，重用已保存的交易，不建立第二次付款。' : consent === 'seed' ? '為第一位 Worker 建立模型 A 的真實種子工作。' : '以模型 B 執行三位 Worker 的音樂評審工作。'}</p><ul><li>Worker 報酬：{consent === 'seed' ? '0.001' : consent === 'live' ? '0.003' : '僅尚未結算的既有款項'} 測試網 0G。</li><li>另有 Storage 與鏈上 Gas；Compute 使用 Router 計費帳戶，並非免費 Galileo 推論。</li><li>sealed Agent 運行期間的 CPU／記憶體費用另計；唯讀重播不會重新推論或發交易。</li><li>工作內容、feedback 與付款證據全部公開。</li><li>Manager 接受成果為 Demo 腳本，不是品質保證。</li></ul><div className="evidence-actions"><button disabled={busy} onClick={() => setConsent(null)}>取消</button><button className="primary-button" disabled={busy} onClick={() => void run()}>{busy ? '正在啟動…' : '確認並執行'}</button></div></section></div>}
  </div>;
}
