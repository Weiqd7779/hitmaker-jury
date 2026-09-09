import { useEffect, useRef, useState } from 'react';
import { ArrowRight, Check, Download, Headphones, Music2, Play, RotateCcw, X } from 'lucide-react';
import { PixelAvatar } from './components/PixelAvatar';
import { ERC8004Panel } from './components/ERC8004Panel';
import CareerApp from './CareerApp';
import { api, type WorkerKey } from './services/career';
import type { ChainState } from './services/onchain';
import './career.css';
import './presentation.css';

type Review = { score: number; headline: string; critique: string };
type Entry = { worker: WorkerKey; status: string; model?: string; review?: Review; rawContent?: string; contentHash?: string; requestId?: string; receivedAt?: string; billedCost0G?: string | null };
type PresentationState = { token: string; status: string; running: boolean; keyConfigured: boolean; router: string; requestedModel: string; attempts: number; error: string | null; entries: Entry[]; workers: { key: WorkerKey; name: string; title: string; pitch: string; amount: string }[]; music: { name: string; notes: string; audioHash: string } };
const readOnly = import.meta.env.PUBLIC_READ_ONLY_DEMO === 'true';
const stateURL = readOnly ? `${import.meta.env.BASE_URL}presentation.json` : '/api/presentation';
const audioURL = readOnly ? `${import.meta.env.BASE_URL}demo.wav` : '/api/music.wav';
const exportURL = readOnly ? `${import.meta.env.BASE_URL}jury-real-reviews.json` : '/api/presentation/export';
const stages = ['準備開始', 'Music Manager 發布工作', '四位候選主動應徵', '查看分版本履歷', '錄取三位專家', '音樂評審開始', '交付專業評論', 'Manager 接受成果', '工作報酬結算', '累積可攜職涯'];
const samples: Record<WorkerKey, Review> = {
  professor: { score: 78, headline: '讓聲音的層次與個性同時清楚', critique: 'G 與 A 的偏移可以形成鮮明的聲音張力。建議透過音量與層次安排，讓旋律的輪廓更聚焦。' },
  antisocial: { score: 85, headline: '熟悉旋律，也能創造新鮮感', critique: '三次重複提供清楚的記憶點。可以在最後一次加入節奏變化，讓音程張力形成更完整的收尾。' },
  nearmiss: { score: 82, headline: '用旋律反差建立市場定位', critique: '熟悉的小星星與特殊音準具備短影音辨識度。建議以趣味改編定位測試受眾反應。' },
};

function Presentation() {
  const [data, setData] = useState<PresentationState | null>(null);
  const [connectionError, setConnectionError] = useState('');
  const [actionError, setActionError] = useState('');
  const [source, setSource] = useState<'real' | 'sample'>('real');
  const [phase, setPhase] = useState(0);
  const [running, setRunning] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [selected, setSelected] = useState<WorkerKey | null>(null);
  const [version, setVersion] = useState('current');
  const [chain, setChain] = useState<ChainState | null>(null);
  const audio = useRef<HTMLAudioElement>(null);
  const ready = data?.entries.filter(entry => entry.status === 'completed' && entry.review).length === 3;
  const linkedChain = source === 'real' ? chain : null;
  useEffect(() => {
    let active = true;
    const refresh = async () => {
      try { const state = await api<PresentationState>(stateURL); if (active) { setData(state); setConnectionError(''); } }
      catch { if (active) setConnectionError('請確認服務連線，或重新載入頁面。'); }
    };
    void refresh();
    if (readOnly) return () => { active = false; };
    const timer = setInterval(() => void refresh(), 1500);
    return () => { active = false; clearInterval(timer); };
  }, []);
  useEffect(() => {
    if (!running || phase === 0) return;
    if (phase >= 9) { setRunning(false); return; }
    if (phase === 5) { void audio.current?.play().catch(() => setActionError('請按播放器的播放鍵，或繼續下一幕。')); return; }
    const timer = setTimeout(() => setPhase(value => value + 1), phase === 6 ? 4500 : 1800);
    return () => clearTimeout(timer);
  }, [phase, running]);
  useEffect(() => {
    if (!confirm && !selected) return;
    const previous = document.activeElement as HTMLElement | null;
    const root = document.querySelector<HTMLElement>('[role="dialog"]');
    const controls = () => Array.from(root?.querySelectorAll<HTMLElement>('button:not(:disabled),select,a[href]') || []);
    controls()[0]?.focus();
    const before = document.body.style.overflow; document.body.style.overflow = 'hidden';
    const keyboard = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !submitting) { setConfirm(false); setSelected(null); }
      if (event.key === 'Tab') {
        const nodes = controls(), first = nodes[0], last = nodes[nodes.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
      }
    };
    document.addEventListener('keydown', keyboard);
    return () => { document.removeEventListener('keydown', keyboard); document.body.style.overflow = before; previous?.focus(); };
  }, [confirm, selected, submitting]);
  const start = () => {
    if (!data || (source === 'real' && !ready)) return;
    audio.current?.pause(); if (audio.current) audio.current.currentTime = 0;
    setActionError(''); setSelected(null); setPhase(1); setRunning(true);
  };
  const next = () => { if (phase === 5) audio.current?.pause(); setPhase(value => Math.min(value + 1, 9)); };
  const generate = async () => {
    if (!data) return;
    setSubmitting(true); setActionError('');
    try { await api('/api/presentation/generate', data.token, { consent: 'up-to-three-inferences' }); setConfirm(false); }
    catch (error) { setActionError((error as Error).message); }
    finally { setSubmitting(false); }
  };
  const entryFor = (key: WorkerKey) => data?.entries.find(entry => entry.worker === key);
  const reviewFor = (key: WorkerKey) => source === 'sample' ? samples[key] : entryFor(key)?.review;
  const worker = data?.workers.find(item => item.key === selected);
  const onchain = () => document.getElementById('onchain')?.scrollIntoView({ behavior: 'smooth' });
  return <div className="career-app presentation-app">
    <header className="career-header">
      <a className="career-brand" href={import.meta.env.BASE_URL}><span className="brand-icon"><Music2 size={21} /></span>VERIFIABLE <span>AGENT CAREERS</span></a>
      <a className="network-link" href="#onchain">0G Galileo</a>
    </header>
    <main className="career-layout"><div className="career-story">
      <section className="career-hero">
        <h1>讓每次工作，<br /><span>成為可驗證的職涯。</span></h1>
        <p>Agent 主動應徵、交付成果、獲得評價與報酬，帶著可攜履歷迎接下一位雇主。</p>
        <div className="hero-tags"><span>Model-Versioned</span><span>Portable Reputation</span><span>Powered by 0G</span></div>
      </section>
      <div className="source-chips"><span>真實 0G 模型評論</span><span>職涯情境演示</span>{linkedChain?.settled && <span>鏈上工作已結算</span>}</div>
      {(connectionError || actionError) && <div role="alert" className="career-alert">{connectionError || actionError}</div>}
      <section className="session-card">
        <div className="session-heading"><div><h2>Music Jury #031</h2><p>為同一段音樂，組成三個不同觀點的評審團。</p></div><Headphones size={28} /></div>
        <div className="music-player"><span className={`record-disc ${phase === 5 && running ? 'spinning' : ''}`}><Music2 size={24} /></span><div className="track-info"><strong>{data?.music.name || 'Music Jury · 15 秒音樂'}</strong><audio ref={audio} src={audioURL} preload="metadata" controls onEnded={() => { if (phase === 5 && running) setPhase(6); }} /></div></div>
        <div className="review-source"><label>評論來源<select value={source} disabled={running} onChange={event => { setSource(event.target.value as 'real' | 'sample'); setPhase(0); }}><option value="real">真實 AI 交付</option><option value="sample">情境評論</option></select></label><span className="career-status">{source === 'sample' ? '情境示例' : ready ? '三份交付已保存' : '準備取得評論'}</span></div>
        {!ready && !readOnly && <button className="prepare-reviews" disabled={!data?.keyConfigured || data.status !== 'empty' || submitting || running} onClick={() => setConfirm(true)}>{data?.running ? '正在取得三位評論' : '準備三位真實評論'}</button>}
        {data?.error && <p className="wallet-error" role="alert">{data.error}</p>}
        <div className="session-actions"><h3 className="scene-title">{stages[phase]}</h3><div className="scene-buttons"><button className="primary-button" disabled={!data || running || (source === 'real' && !ready)} onClick={start}>{phase === 9 ? <RotateCcw size={16} /> : <Play size={16} />}{phase === 9 ? '重新播放' : '開始展示'}</button>{running && <button onClick={next}>下一幕<ArrowRight size={14} /></button>}</div></div>
      </section>
      <section className="manager-scene"><PixelAvatar character="producer" label="MUSIC MANAGER" size="sm" motion={running ? 'glint' : 'idle'} /><div><h2>{phase < 1 ? '下一份工作，從這裡開始。' : phase < 4 ? '我需要混音、作曲與市場三種觀點。' : phase < 7 ? '三位專家，請提交你們的評論。' : '成果已接受，將這次合作寫進履歷。'}</h2></div></section>
      <section className="jury-section">
        <div className="section-heading"><h2>{phase >= 4 ? '你的三位音樂專家' : '四位 Agent，主動應徵。'}</h2></div>
        <div className="jury-grid">{data?.workers.map(item => {
          const review = reviewFor(item.key), real = entryFor(item.key), identity = linkedChain?.workers.find(w => w.key === item.key);
          return <article className={`worker-card ${item.key}`} key={item.key}>
            <div className="worker-topline"><span>{item.title}</span><span className="career-status">{phase >= 4 ? '錄取' : phase >= 2 ? '應徵' : '待命'}</span></div>
            <div className="avatar-stage"><PixelAvatar character={item.key} label={item.name.toUpperCase()} size="md" score={phase >= 6 ? review?.score : undefined} motion={phase === 5 ? item.key === 'professor' ? 'furious' : item.key === 'antisocial' ? 'groove' : 'jitter' : 'idle'} /></div>
            <h3>{item.name}</h3><p className="worker-pitch">{phase >= 6 && review ? review.headline : item.pitch}</p>
            {identity ? <a className="agent-id" href={`https://chainscan-galileo.0g.ai/address/${identity.wallet}`} target="_blank" rel="noopener noreferrer">Agent #{identity.agentId}</a> : <button className="agent-id" onClick={onchain}>建立職業身分<ArrowRight size={12} /></button>}
            <div className="career-counts"><div><strong>{linkedChain?.settled ? 1 : phase >= 9 ? 2 : 1}</strong><span>{linkedChain?.settled ? '鏈上工作' : '履歷示例'}</span></div><div><strong>{real?.status === 'completed' ? 1 : 0}</strong><span>AI 交付</span></div></div>
            <button className="resume-button" onClick={() => { setSelected(item.key); setVersion(phase >= 6 ? 'current' : 'previous'); }}>查看履歷與交付<ArrowRight size={14} /></button>
          </article>;
        })}</div>
        <div className="candidate-row"><PixelAvatar character="candidate" label="BRUTALCRITIC" size="sm" /><div><strong>BrutalCritic</strong><p>「我會用更直接的觀點，挑戰這首作品的表現。」</p></div><span className="career-status">{phase >= 4 ? '候補' : '應徵'}</span></div>
      </section>
      {phase >= 6 && <section className="history-section" id="deliverables"><h2>同樣的素材，不同的專業觀點。</h2><div className="delivered-reviews">{data?.workers.map(item => <article key={item.key}><div><strong>{item.name}</strong><span className="career-status">{source === 'real' ? '真實 AI 交付' : '情境評論'}</span></div><h3>{reviewFor(item.key)?.headline}</h3><p>{reviewFor(item.key)?.critique}</p></article>)}</div>{source === 'real' && <a className="export-reviews" href={exportURL} download="jury-real-reviews.json"><Download size={16} />下載 AI 交付紀錄</a>}</section>}
      {phase >= 8 && <section className="history-section demo-ledger"><h2>{linkedChain?.settled ? '工作報酬已結算' : '工作報酬結算預覽'}</h2><span className="career-status">{linkedChain?.settled ? 'Galileo 鏈上紀錄' : '情境示例'}</span>{data?.workers.map(item => <div key={item.key}><span>Music Manager → {item.name}</span><strong>0.001 0G</strong></div>)}<p>三位 Agent，合計 0.003 0G。</p>{!linkedChain?.settled && <button className="primary-button" onClick={onchain}>開啟鏈上結算<ArrowRight size={15} /></button>}</section>}
      {phase >= 9 && <section className="career-finale" data-testid="career-complete"><h2>每次交付，都成為下一次機會。</h2><p>身分、模型版本、成果、評價與報酬，組成可攜帶的 Work Experience Credential。</p><strong>{linkedChain?.settled ? '三位 Agent 的工作紀錄已連上 Galileo' : '查看履歷，或完成這次工作的鏈上紀錄。'}</strong></section>}
      <ERC8004Panel readOnly={readOnly} onVerified={setChain} />
      <footer className="career-footer">Verify What It Has Actually Done.</footer>
    </div>
    <aside className="trust-trail">
      <div className="trail-title"><Check size={20} /><h2>0G TRUST TRAIL</h2></div>
      <div className="trust-primitives"><span>0G Compute</span><span>ERC-8004 Identity</span><span>ERC-8004 Reputation</span><span>0G Chain</span></div>
      <div className="proof-states"><div><strong>AI 交付</strong><span>{ready ? '三份已保存' : '取得評論'}</span></div><div><strong>職業身分</strong><button onClick={onchain}>{chain ? '三位已登記' : '建立 Agent ID'}</button></div><div><strong>客戶評價</strong><button onClick={onchain}>{linkedChain?.settled ? '已寫入 Registry' : '提交 Feedback'}</button></div><div><strong>工作報酬</strong><button onClick={onchain}>{linkedChain?.settled ? '0.003 0G 已結算' : '支付報酬'}</button></div></div>
      <ol className="trail-events" aria-live="polite">{stages.slice(1, phase + 1).map((title, index) => <li key={title} className="running"><span className="event-mark"><Check size={11} /></span><span className="event-source">{index === 5 && source === 'real' ? 'AI 交付' : '情境流程'}</span><p>{title}</p></li>)}</ol>
      <details className="trail-note"><summary>查看推論憑據</summary>{data?.entries.map(entry => <div className="saved-entry" key={entry.worker}><strong>{data.workers.find(w => w.key === entry.worker)?.name}</strong><span>{entry.status === 'completed' ? '已保存' : '處理中'}</span><code>{entry.requestId || '取得回應 ID'}</code>{entry.billedCost0G && <span>{entry.billedCost0G} 0G</span>}</div>)}</details>
    </aside></main>
    {confirm && <div className="dialog-backdrop"><section role="dialog" aria-modal="true" aria-labelledby="generation-title" className="consent-dialog"><h2 id="generation-title">取得三位專家的真實評論</h2><p>MixMaster、MelodyFox、HitRadar 各一份。使用現有 0G Key，最多三次請求，每次預估額度 0.01 0G。成功結果將保存供後續重播。</p><div className="evidence-actions"><button disabled={submitting} onClick={() => setConfirm(false)}>返回</button><button disabled={submitting} onClick={() => void generate()}>確認取得三份評論</button></div></section></div>}
    {selected && worker && <div className="dialog-backdrop"><section className="career-drawer" role="dialog" aria-modal="true" aria-labelledby="presentation-drawer-title"><button className="close-dialog" aria-label="關閉履歷" onClick={() => setSelected(null)}><X /></button><h2 id="presentation-drawer-title">{worker.name} · 職涯履歷</h2><label className="version-filter">模型版本<select value={version} onChange={event => setVersion(event.target.value)}><option value="previous">歷史版本示例</option><option value="current">目前版本 · {data?.requestedModel}</option></select></label>{version === 'previous' ? <article className="work-evidence"><span className="career-status">情境示例</span><h3>SoundLab · Music Review</h3><p>模型 A 的工作經歷，依版本獨立呈現。</p></article> : <article className="work-evidence"><span className="career-status">{source === 'sample' ? '情境評論' : '0G Compute 交付'}</span><h3>{reviewFor(selected)?.headline || '準備評論'}</h3><blockquote>{reviewFor(selected)?.critique || '取得評論，開啟這一版的第一份工作。'}</blockquote>{source === 'real' && entryFor(selected)?.status === 'completed' && <><dl><dt>模型</dt><dd>{entryFor(selected)?.model}</dd><dt>Request ID</dt><dd>{entryFor(selected)?.requestId}</dd><dt>交付時間</dt><dd>{entryFor(selected)?.receivedAt}</dd><dt>內容雜湊</dt><dd>{entryFor(selected)?.contentHash}</dd>{linkedChain?.workers.find(w => w.key === selected) && <><dt>Agent ID</dt><dd>{linkedChain.workers.find(w => w.key === selected)?.agentId}</dd><dt>雇主</dt><dd>{linkedChain.manager}</dd></>}</dl><a className="export-reviews" href={exportURL} download="jury-real-reviews.json"><Download size={14} />下載 AI 交付紀錄</a></>}</article>}</section></div>}
  </div>;
}

export default function PresentationApp() {
  return !readOnly && new URLSearchParams(window.location.search).get('mode') === 'legacy' ? <CareerApp /> : <Presentation />;
}
