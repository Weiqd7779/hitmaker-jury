import React, { useState, useEffect } from 'react';
import { Live0GHUD } from './components/Live0GHUD';
import { ExecutiveCommandBar } from './components/ExecutiveCommandBar';
import { HitmakerStage } from './components/HitmakerStage';
import { VerifiableProofDrawer } from './components/VerifiableProofDrawer';
import { ServeProofReviewModal } from './components/ServeProofReviewModal';
import { AudioAnalysis, StageStep, SingleJudgeReview, ProducerVerdict, NetworkStatus } from './types';
import { PRESET_OFF_PITCH_STAR, playTrack, stopAudio } from './services/audioAnalyzer';
import { fetch0GNetworkStatus } from './services/zgChain';
import { executeJudgeReviews, executeProducerSynthesis } from './services/zgCompute';
import { Award, TrendingUp, ShieldCheck, FileCheck, Coins, Sparkles, ExternalLink, RefreshCw } from 'lucide-react';
import confetti from 'canvas-confetti';

export const App: React.FC = () => {
  const [networkStatus, setNetworkStatus] = useState<NetworkStatus>({
    connected: true,
    chainId: 16602,
    blockNumber: 53546290,
    pingMs: 120,
    gasPriceGwei: 2.0,
    routerOnline: true,
    onlineModelsCount: 30,
    activeModel: '0gm-1.0-35b-a3b'
  });

  const [currentAudio, setCurrentAudio] = useState<AudioAnalysis>(PRESET_OFF_PITCH_STAR);
  const [bossDirective, setBossDirective] = useState('這首想走地下龐克風，幫我找最挑剔的耳朵來審！');
  const [budget, setBudget] = useState(0.03);
  const [stage, setStage] = useState<StageStep>('idle');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isAnalyzed, setIsAnalyzed] = useState(false);
  const [listeningPhase, setListeningPhase] = useState(0);
  const [playbackProgress, setPlaybackProgress] = useState(0);
  const [currentTimeSec, setCurrentTimeSec] = useState(0);
  const [reviews, setReviews] = useState<SingleJudgeReview[]>([]);
  const [verdict, setVerdict] = useState<ProducerVerdict | null>(null);
  const [selectedCharacter, setSelectedCharacter] = useState<string | null>(null);
  const [showReviewModal, setShowReviewModal] = useState(false);

  // 定期更新真實 0G 測試網狀態
  useEffect(() => {
    fetch0GNetworkStatus().then(setNetworkStatus);
    const interval = setInterval(() => {
      fetch0GNetworkStatus().then(setNetworkStatus);
    }, 8000);
    return () => clearInterval(interval);
  }, []);

  // 音訊切換處理（換歌時不劇透指標，重設狀態）
  const handleAudioChange = (newAudio: AudioAnalysis) => {
    stopAudio();
    setCurrentAudio(newAudio);
    setIsAnalyzed(false);
    setReviews([]);
    setVerdict(null);
    setStage('idle');
  };

  // 執行全自動 6 幕 Agent 舞台流程
  const handleHireProducer = async () => {
    setIsProcessing(true);
    setIsAnalyzed(false);
    setVerdict(null);
    setReviews([]);

    // 幕 1: 接單入帳 (1.0s)
    setStage('hired');
    await new Promise(r => setTimeout(r, 1000));

    // 幕 2: 市集搜尋評審 (精準 3 秒搜尋動畫)
    setStage('scouting');
    await new Promise(r => setTimeout(r, 3000));

    // 幕 3: 評審現身入座！簽約撥款 (1.5s)
    setStage('contracting');
    await new Promise(r => setTimeout(r, 1500));

    // 幕 4: 音樂現場聆聽與邊播邊演 (根據音樂時長播放完畢才換下一幕)
    setStage('listening');
    setListeningPhase(0);
    setPlaybackProgress(0);
    setCurrentTimeSec(0);

    const duration = currentAudio.duration || 8.5;
    const startTime = Date.now();
    let audioEnded = false;

    // 播放音訊（真實播放使用者上傳的 MP3/WAV 或預設小星星）
    const stopCurrentPlay = playTrack(
      currentAudio, 
      () => {
        audioEnded = true;
      },
      (currSec, prog) => {
        setCurrentTimeSec(currSec);
        setPlaybackProgress(prog);
      }
    );

    // 背景同時向 0G Compute 發送真實推論請求
    const computePromise = executeJudgeReviews(currentAudio);

    // 隨音樂進度持續更新動態講評與波形進度
    await new Promise<void>((resolve) => {
      const interval = setInterval(() => {
        const elapsed = (Date.now() - startTime) / 1000;
        const progress = Math.min(100, (elapsed / duration) * 100);
        setPlaybackProgress(progress);
        setCurrentTimeSec(elapsed);

        // 動態演變對話階段 (隨音樂時間軸推進)
        if (elapsed < duration * 0.28) {
          setListeningPhase(0); // 前奏進來了...
        } else if (elapsed < duration * 0.58) {
          setListeningPhase(1); // 發現音高偏移！開始震動
        } else if (elapsed < duration * 0.88) {
          setListeningPhase(2); // 走音大爆發！劇烈狂震
        } else {
          setListeningPhase(3); // 演奏收尾
        }

        // 當音樂播放完成時結束本幕
        if (elapsed >= duration || audioEnded) {
          clearInterval(interval);
          setListeningPhase(3);
          setPlaybackProgress(100);
          setCurrentTimeSec(duration);
          resolve();
        }
      }, 200);
    });

    stopCurrentPlay();

    // 等待 0G Compute 推論回傳
    const fetchedReviews = await computePromise;
    setReviews(fetchedReviews);

    // 音樂播完後停頓 0.8 秒，讓評審收尾回神
    await new Promise(r => setTimeout(r, 800));

    // 幕 5: 舉牌出章 (音樂真正播完後，才給予評論與蓋下防偽印章！)
    setStage('stamping');
    await new Promise(r => setTimeout(r, 2200));

    // 幕 6: 經紀人戰略復盤報告（此時音準率與分析才正式揭曉！）
    const finalVerdict = await executeProducerSynthesis(currentAudio, fetchedReviews, budget);
    setVerdict(finalVerdict);
    setIsAnalyzed(true);
    setStage('report');
    setIsProcessing(false);

    confetti({
      particleCount: 110,
      spread: 75,
      origin: { y: 0.6 }
    });
  };

  const handleReset = () => {
    stopAudio();
    setStage('idle');
    setIsProcessing(false);
    setIsAnalyzed(false);
    setReviews([]);
    setVerdict(null);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-purple-600 selection:text-white">
      {/* 頂部即時 0G 狀態欄 */}
      <Live0GHUD 
        status={networkStatus} 
        onRefresh={() => fetch0GNetworkStatus().then(setNetworkStatus)} 
      />

      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 space-y-6">
        {/* 老闆辦公室發包控制台 (Command Bar) */}
        <ExecutiveCommandBar
          currentAudio={currentAudio}
          onAudioChange={handleAudioChange}
          bossDirective={bossDirective}
          onDirectiveChange={setBossDirective}
          budget={budget}
          onBudgetChange={setBudget}
          isProcessing={isProcessing}
          onHireProducer={handleHireProducer}
          isAnalyzed={isAnalyzed}
        />

        {/* 賽璐珞像素互動舞台 (Hitmaker Stage) */}
        <HitmakerStage
          stage={stage}
          budget={budget}
          producerCommission={verdict ? verdict.producerCommission : Math.max(0, parseFloat((budget - 0.024).toFixed(3)))}
          reviews={reviews}
          onSelectCharacter={setSelectedCharacter}
          selectedCharacter={selectedCharacter}
          listeningPhase={listeningPhase}
          playbackProgress={playbackProgress}
          currentTimeSec={currentTimeSec}
          audioDuration={currentAudio.duration || 8.5}
        />

        {/* 幕 6 & 7：王牌經紀人戰略復盤報告 (Executive Verdict) */}
        {verdict && (stage === 'report' || stage === 'reviewed') && (
          <section className="bg-slate-900 border-2 border-purple-500/50 rounded-2xl p-6 shadow-2xl space-y-6 animate-in fade-in slide-in-from-bottom duration-500">
            {/* 報告頂部 */}
            <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-800">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-amber-500 to-purple-600 flex items-center justify-center text-slate-950 font-bold text-xl shadow-lg">
                  {verdict.overallScore}
                </div>
                <div>
                  <span className="font-pixel text-[10px] text-amber-400">PRODUCER STRATEGIC VERDICT</span>
                  <h3 className="font-bold text-lg text-slate-100">{verdict.title}</h3>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={() => setShowReviewModal(true)}
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-purple-600 hover:from-amber-400 hover:to-purple-500 text-slate-950 font-bold text-xs cursor-pointer shadow-lg shadow-purple-900/30 flex items-center gap-2"
                >
                  <Sparkles className="w-4 h-4 text-slate-950" />
                  <span>⭐ 憑服務證明提交鏈上評價</span>
                </button>
                <button
                  onClick={handleReset}
                  className="px-3.5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs cursor-pointer flex items-center gap-1.5"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>重新委託</span>
                </button>
              </div>
            </div>

            {/* 製作人商業洞察與包裝策略 */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div className="p-4 rounded-xl bg-purple-950/30 border border-purple-800/50 space-y-1.5">
                <span className="font-pixel text-[10px] text-purple-300 flex items-center gap-1.5">
                  <TrendingUp className="w-3.5 h-3.5 text-purple-400" />
                  商業發行價值評估
                </span>
                <p className="text-slate-200 leading-relaxed font-sans text-xs">
                  {verdict.commercialVerdict}
                </p>
              </div>

              <div className="p-4 rounded-xl bg-amber-950/20 border border-amber-800/40 space-y-1.5">
                <span className="font-pixel text-[10px] text-amber-300 flex items-center gap-1.5">
                  <Award className="w-3.5 h-3.5 text-amber-400" />
                  製作人市場行銷策略
                </span>
                <p className="text-slate-200 leading-relaxed font-sans text-xs">
                  {verdict.marketingStrategy}
                </p>
              </div>
            </div>

            {/* 3 位評審的多元意見分歧比對 (Same Evidence → Different Objective) */}
            <div>
              <h4 className="text-xs font-semibold text-slate-400 mb-3 flex items-center gap-1.5">
                <FileCheck className="w-3.5 h-3.5 text-emerald-400" />
                特約專家評判分歧矩陣（Same Evidence → Different Objectives）
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {verdict.reviews.map((rev) => (
                  <div 
                    key={rev.judgeId}
                    onClick={() => setSelectedCharacter(rev.judgeId)}
                    className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 hover:border-slate-700 cursor-pointer transition-all hover:scale-[1.01] space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-pixel text-[10px] text-slate-300">{rev.judgeName}</span>
                      <span className={`font-pixel text-xs font-bold ${rev.score < 50 ? 'text-rose-400' : rev.score > 90 ? 'text-emerald-400' : 'text-amber-300'}`}>
                        {rev.score}分
                      </span>
                    </div>
                    <p className="font-bold text-xs text-slate-200">{rev.headline}</p>
                    <p className="text-[11px] text-slate-400 line-clamp-3 leading-relaxed">
                      {rev.detailedCritique}
                    </p>
                    <div className="pt-2 flex items-center justify-between text-[10px] text-emerald-400/90 font-mono border-t border-slate-900">
                      <span>✓ TEE Verified</span>
                      <span className="text-slate-500">檢視 Proof →</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* 經紀人帳本向老闆復盤 */}
            <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs font-mono">
              <span className="text-slate-400">{verdict.producerNote}</span>
              <span className="text-emerald-400 font-bold bg-emerald-950/80 px-2 py-1 rounded border border-emerald-800">
                經紀人結餘收益: +{verdict.producerCommission} 0G
              </span>
            </div>
          </section>
        )}
      </main>

      {/* 右側 0G 可驗證證明抽屜 (Verifiable Proof Drawer) */}
      <VerifiableProofDrawer
        selectedCharacter={selectedCharacter}
        onClose={() => setSelectedCharacter(null)}
        reviews={reviews}
        budget={budget}
        producerCommission={verdict ? verdict.producerCommission : Math.max(0, parseFloat((budget - 0.024).toFixed(3)))}
      />

      {/* 憑服務證明提交評價彈窗 (ServeProof Review Modal) */}
      {verdict && (
        <ServeProofReviewModal
          verdict={verdict}
          isOpen={showReviewModal}
          onClose={() => setShowReviewModal(false)}
          onSubmitReview={() => setStage('reviewed')}
        />
      )}

      {/* 底部頁尾 */}
      <footer className="bg-slate-950 border-t border-slate-900 py-4 px-6 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-2">
          <span>0G Hitmaker Jury · 2026 Hackathon Track C (Multi-Agent Economy)</span>
          <div className="flex gap-4">
            <a href="https://docs.0g.ai" target="_blank" rel="noopener noreferrer" className="hover:text-purple-400 transition-colors">
              0G 官方文檔
            </a>
            <a href="https://router-api.0g.ai/v1" target="_blank" rel="noopener noreferrer" className="hover:text-purple-400 transition-colors">
              0G Compute Router
            </a>
            <a href="https://chainscan-galileo.0g.ai" target="_blank" rel="noopener noreferrer" className="hover:text-purple-400 transition-colors">
              Galileo Explorer
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default App;
