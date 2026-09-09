import React from 'react';
import { PixelAvatar, AvatarMotion } from './PixelAvatar';
import { StageStep, SingleJudgeReview, JudgeProfile } from '../types';
import { JUDGES_DATA } from '../services/zgCompute';
import { ShieldCheck, Coins, Sparkles, Building2, FileCheck2, ArrowRight, Search, UserX, Radar, Receipt } from 'lucide-react';

interface HitmakerStageProps {
  stage: StageStep;
  budget: number;
  producerCommission: number;
  reviews: SingleJudgeReview[];
  onSelectCharacter: (charId: string) => void;
  selectedCharacter: string | null;
  listeningPhase?: number; // 0: intro, 1: deviance, 2: climax, 3: finish
  playbackProgress?: number; // 0 to 100
  currentTimeSec?: number;
  audioDuration?: number;
  onOpenDeductionProof?: () => void;
}

export const HitmakerStage: React.FC<HitmakerStageProps> = ({
  stage,
  budget,
  producerCommission,
  reviews,
  onSelectCharacter,
  selectedCharacter,
  listeningPhase = 0,
  playbackProgress = 0,
  currentTimeSec = 0,
  audioDuration = 8.5,
  onOpenDeductionProof
}) => {
  // 取得特定評審在當前階段的動態與對話（隨音樂進度動態演變）
  const getJudgeMotion = (judgeId: string): AvatarMotion => {
    if (stage === 'listening') {
      if (listeningPhase === 0) {
        return judgeId === 'nearmiss' ? 'jitter' : 'idle';
      }
      if (judgeId === 'professor') return 'furious';
      if (judgeId === 'antisocial') return 'groove';
      if (judgeId === 'nearmiss') return 'jitter';
    }
    if (stage === 'stamping' || stage === 'report' || stage === 'reviewed') {
      return 'idle';
    }
    if (stage === 'scouting') {
      return 'scan';
    }
    if (stage === 'contracting') {
      return 'hired';
    }
    return 'idle';
  };

  const getJudgeSpeech = (judgeId: string): string => {
    const review = reviews.find(r => r.judgeId === judgeId);
    if (stage === 'scouting') {
      return '「鏈上身分核驗中...」';
    }
    if (stage === 'contracting') {
      return '「預算已入帳！接單就座。」';
    }
    if (stage === 'listening') {
      if (listeningPhase === 0) {
        if (judgeId === 'professor') return '「前奏進來了... 聽聽看基本功。」';
        if (judgeId === 'antisocial') return '「切，又是規矩的開頭，快來點刺激的！」';
        if (judgeId === 'nearmiss') return '「基準音頻 261Hz，卡尺對準中...」';
      } else if (listeningPhase === 1) {
        if (judgeId === 'professor') return '「等等！這個音怎麼回事？！嚴重偏低！」';
        if (judgeId === 'antisocial') return '「喔喔！來了！這個跑調很有靈魂喔！」';
        if (judgeId === 'nearmiss') return '「偏移 42 cents！卡尺亮紅燈！精妙擦邊！」';
      } else if (listeningPhase === 2) {
        if (judgeId === 'professor') return '「啊啊啊！這是蓄意謀殺音階！必須最低分！」';
        if (judgeId === 'antisocial') return '「太狂了！這就是純粹的地下龐克！太爽了！」';
        if (judgeId === 'nearmiss') return '「誤差精準卡在半音之內！極限微距藝術！」';
      } else {
        if (judgeId === 'professor') return '「不堪入耳！我要給予最嚴厲處分！」';
        if (judgeId === 'antisocial') return '「給我立刻簽下這張 Demo！必大火！」';
        if (judgeId === 'nearmiss') return '「量測數據已鎖定，微距失誤已存證！」';
      }
    }
    if ((stage === 'stamping' || stage === 'report' || stage === 'reviewed') && review) {
      return `「${review.headline}」`;
    }
    return '';
  };

  const getProducerSpeech = (): string => {
    switch (stage) {
      case 'idle':
        return '「老闆，把試聽帶交給我，我去業界找專家驗貨！」';
      case 'hired':
        return '「收到老闆指示！預算已鎖入合約，立即啟動外包檢索！」';
      case 'scouting':
        return '「正在核驗 Professor、Anti-Social、Near-Miss 的 ERC-8004 證書...」';
      case 'contracting':
        return `「成功以 0.024 0G 簽下 3 位專家！為老闆省下 ${producerCommission.toFixed(3)} 0G！」`;
      case 'listening':
        if (listeningPhase === 0) return '「老闆聽聽看，前奏進來了...」';
        if (listeningPhase === 1) return '「出現了！三位表情開始不對勁了！」';
        if (listeningPhase === 2) return '「走音破音大爆發！評審徹底坐不住了！」';
        return '「演奏結束！專家們準備出章給分！」';
      case 'stamping':
        return '「每一跳皆出具 X-Agent-Proof 硬體防偽證明！」';
      case 'report':
      case 'reviewed':
        return '「老闆請過目！製作人戰略復盤已就緒，這首 Demo 能大火！」';
      default:
        return '';
    }
  };

  const getStageTitle = () => {
    switch (stage) {
      case 'idle':
        return '📍 準備階段：等待雇主上傳音訊並批准委託預算';
      case 'hired':
        return '🎬 第 1 幕：經紀人接單彈跳，0G 預算金幣正式進場！';
      case 'scouting':
        return '🎬 第 2 幕：經紀人掃描市集，核驗外包 Agentic ID 與歷史聲譽';
      case 'contracting':
        return '🎬 第 3 幕：經紀人自主下單撥款，三位專家受聘入座評審席';
      case 'listening':
        return '🎬 第 4 幕：同一音樂激辯！Professor 狂暴震動、Anti-Social 龐克搖擺！';
      case 'stamping':
        return '🎬 第 5 幕：評審重砸出章，蓋下發光的綠色 X-Agent-Proof 防偽印章！';
      case 'report':
        return '🎬 第 6 幕：王牌經紀人向前滑入，向老闆提交多元洞察商業戰略報告';
      case 'reviewed':
        return '🎉 閉環完成：老闆已憑驗證通過的 ServeProof 提交鏈上聲譽好評！';
    }
  };

  return (
    <div className="relative bg-slate-950 border-2 border-slate-800 rounded-2xl overflow-hidden shadow-2xl p-4 sm:p-6 my-4">
      {/* 像素舞台背景網格與光束 */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-purple-900/20 via-slate-950 to-slate-950 pointer-events-none" />
      <div className="absolute inset-0 scanlines opacity-40 pointer-events-none" />

      {/* 舞台頂部當前幕次橫幅 */}
      <div className="relative z-10 flex flex-wrap items-center justify-between gap-2 bg-slate-900/90 border border-slate-700/80 px-3.5 py-2 rounded-lg mb-6 backdrop-blur text-xs">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-ping" />
          <span className="font-pixel text-[11px] text-amber-300 tracking-wide">
            {getStageTitle()}
          </span>
        </div>

        {/* 經紀人帳本小卡 */}
        <div className="flex items-center gap-3 font-mono text-[11px] text-slate-300">
          <span className="flex items-center gap-1">
            <Coins className="w-3.5 h-3.5 text-amber-400" />
            <span>總預算:</span>
            <span className="text-amber-300 font-bold">{budget} 0G</span>
          </span>
          <ArrowRight className="w-3 h-3 text-slate-600" />
          <span className="flex items-center gap-1">
            <span>外包花費:</span>
            <span className="text-rose-400 font-bold">0.024 0G</span>
          </span>
          <span className="flex items-center gap-1 bg-emerald-950/80 text-emerald-300 px-1.5 py-0.5 rounded border border-emerald-800 text-[10px]">
            經紀佣金 +{producerCommission.toFixed(3)} 0G
          </span>
          {onOpenDeductionProof && (
            <button
              onClick={onOpenDeductionProof}
              className="flex items-center gap-1 bg-emerald-950 hover:bg-emerald-900 text-emerald-300 px-2 py-0.5 rounded border border-emerald-700 text-[10px] cursor-pointer transition-colors shadow-sm font-sans"
              title="查驗 0G 充值與 GPU 算力扣款存證"
            >
              <Receipt className="w-3 h-3 text-emerald-400" />
              <span>查驗扣款憑單</span>
            </button>
          )}
        </div>
      </div>

      {/* 音樂現場聆聽進度條 (邊聽邊演，聽完才給評) */}
      {stage === 'listening' && (
        <div className="relative z-10 mb-4 bg-slate-900/90 border border-purple-500/50 p-2.5 rounded-xl font-mono text-xs flex flex-wrap items-center justify-between gap-3 animate-in fade-in">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-ping" />
            <span className="text-purple-300 font-bold">🎵 音樂現場播放中...</span>
            <span className="text-slate-400">({currentTimeSec.toFixed(1)}s / {audioDuration.toFixed(1)}s)</span>
          </div>
          <div className="flex-1 max-w-xs bg-slate-950 h-2.5 rounded-full overflow-hidden border border-slate-700">
            <div 
              className="h-full bg-gradient-to-r from-purple-500 via-rose-500 to-amber-400 transition-all duration-300"
              style={{ width: `${Math.min(100, Math.max(0, playbackProgress))}%` }}
            />
          </div>
          <span className="text-amber-300 text-[11px] font-bold font-pixel">
            {listeningPhase === 0 && '⚡ 前奏初聽'}
            {listeningPhase === 1 && '🔥 發現音高偏移！'}
            {listeningPhase === 2 && '💥 走音高潮激辯！'}
            {listeningPhase === 3 && '🏁 演奏結束結案'}
          </span>
        </div>
      )}

      {/* 舞台中央區域：經紀人辦公區 (左) + 評審席 (中) + 市集背景 (右) */}
      <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-6 items-end min-h-[340px] pb-4 border-b border-slate-800/80">
        
        {/* 左側：雇主的專屬王牌經紀人 (Col 4) */}
        <div className="lg:col-span-4 flex flex-col items-center justify-end p-3 rounded-xl bg-slate-900/40 border border-purple-500/20 relative group">
          <div className="absolute top-2 left-2 flex items-center gap-1 text-[10px] font-pixel text-purple-300 bg-purple-950/60 px-2 py-0.5 rounded border border-purple-800">
            <ShieldCheck className="w-3 h-3 text-purple-400" />
            PRODUCER'S DESK (我的人)
          </div>

          <PixelAvatar
            character="producer"
            motion={stage === 'hired' ? 'slam' : stage === 'report' ? 'furious' : 'idle'}
            size="lg"
            showSpeech={true}
            speechText={getProducerSpeech()}
            isInspected={selectedCharacter === 'producer'}
            onClick={() => onSelectCharacter('producer')}
          />

          <div className="mt-3 text-center">
            <p className="text-xs font-semibold text-slate-200">王牌音樂製作人 (Producer Agent)</p>
            <p className="text-[11px] text-amber-400/90 font-mono">「老闆的專屬商業代工總管」</p>
          </div>
        </div>

        {/* 中央：3 位多元客觀目標 Judge 評審席 (Col 6) */}
        <div className="lg:col-span-6 flex flex-col items-center justify-end p-3 rounded-xl bg-slate-900/30 border border-slate-800/80 relative min-h-[300px]">
          <div className="absolute top-2 left-2 flex items-center gap-1 text-[10px] font-pixel text-slate-300 bg-slate-950 px-2 py-0.5 rounded border border-slate-800 z-20">
            <Building2 className="w-3 h-3 text-amber-400" />
            THE JURY BENCH (特約外包樂評席)
          </div>

          {/* 狀態 1: 一開始不顯示評審（等待發包空席位） */}
          {stage === 'idle' && (
            <div className="flex flex-col items-center justify-center w-full py-8 text-center animate-in fade-in duration-300">
              <div className="flex justify-center gap-3 sm:gap-6 mb-4 opacity-35">
                {[1, 2, 3].map((seat) => (
                  <div key={seat} className="w-24 h-32 border-2 border-dashed border-slate-600 rounded-xl flex flex-col items-center justify-center font-pixel text-[9px] text-slate-400 bg-slate-950/30">
                    <UserX className="w-7 h-7 mb-2 text-slate-500" />
                    <span>空席位 #{seat}</span>
                  </div>
                ))}
              </div>
              <p className="font-pixel text-[11px] text-slate-300 mb-1">【 待外包招募評審席 】</p>
              <p className="text-xs text-slate-500 max-w-sm">
                目前評審席位空置。請於上方設定指示並點擊「💼 委託王牌經紀人」，經紀人將親自前往 0G 市集搜尋並聘請評審。
              </p>
            </div>
          )}

          {/* 狀態 2: 按下委託後顯示搜尋中動畫（大約 3 秒） */}
          {(stage === 'hired' || stage === 'scouting') && (
            <div className="flex flex-col items-center justify-center w-full py-6 px-4 relative overflow-hidden animate-in fade-in duration-300">
              {/* 雷達掃描特效 */}
              <div className="relative mb-3 flex items-center justify-center">
                <div className="w-28 h-28 rounded-full border border-purple-500/30 animate-ping absolute opacity-40 pointer-events-none" />
                <div className="w-20 h-20 rounded-full border border-purple-400/60 animate-pulse absolute pointer-events-none" />
                <div className="w-12 h-12 rounded-full bg-purple-950 border-2 border-purple-400 flex items-center justify-center text-amber-300 shadow-xl shadow-purple-600/40 animate-spin">
                  <Radar className="w-6 h-6 text-purple-300" />
                </div>
              </div>

              <h4 className="font-pixel text-xs text-amber-300 mb-2.5 animate-pulse flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
                經紀人深入 0G MARKETPLACE 檢索外包中... (約 3 秒)
              </h4>

              {/* 終端狀態滾動檢索記錄 */}
              <div className="w-full max-w-md bg-slate-950 border border-purple-900/60 rounded-lg p-2.5 font-mono text-[10px] space-y-1.5 text-slate-300 shadow-inner">
                <div className="text-purple-300 flex items-center gap-1.5">
                  <span className="text-emerald-400 font-bold">›</span> 連線 0G Galileo ERC-8004 註冊表 (0x8004A818...)
                </div>
                <div className="text-slate-400 flex items-center gap-1.5">
                  <span className="text-amber-400 font-bold">›</span> 檢索匹配風格：古典樂理、地下龐克、微距強迫症...
                </div>
                <div className="text-emerald-300 flex items-center gap-1.5">
                  <span className="text-emerald-400 font-bold">›</span> 發現候選人：Professor #014, Anti-Social #207, Near-Miss #031
                </div>
                <div className="text-cyan-300 flex items-center gap-1.5 animate-pulse">
                  <span className="text-cyan-400 font-bold">›</span> 正在核驗 0G TEE 安全硬體隔離區與聲譽評分...
                </div>
              </div>
            </div>
          )}

          {/* 狀態 3: 搜尋完畢後（3秒後），三位評審正式入座現身！ */}
          {stage !== 'idle' && stage !== 'hired' && stage !== 'scouting' && (
            <div className="flex items-end justify-center gap-2 sm:gap-4 w-full pt-8 animate-pop-squish">
              {/* Judge 1: Professor */}
              <div className="flex flex-col items-center">
                <PixelAvatar
                  character="professor"
                  motion={getJudgeMotion('professor')}
                  size="md"
                  showSpeech={true}
                  speechText={getJudgeSpeech('professor')}
                  score={stage === 'stamping' || stage === 'report' || stage === 'reviewed' ? reviews.find(r => r.judgeId === 'professor')?.score : undefined}
                  hasStamp={stage === 'stamping' || stage === 'report' || stage === 'reviewed'}
                  isInspected={selectedCharacter === 'professor'}
                  onClick={() => onSelectCharacter('professor')}
                />
                <span className="text-[10px] font-mono text-sky-400 mt-1">報價 0.010 0G</span>
              </div>

              {/* Judge 2: Anti-Social */}
              <div className="flex flex-col items-center">
                <PixelAvatar
                  character="antisocial"
                  motion={getJudgeMotion('antisocial')}
                  size="md"
                  showSpeech={true}
                  speechText={getJudgeSpeech('antisocial')}
                  score={stage === 'stamping' || stage === 'report' || stage === 'reviewed' ? reviews.find(r => r.judgeId === 'antisocial')?.score : undefined}
                  hasStamp={stage === 'stamping' || stage === 'report' || stage === 'reviewed'}
                  isInspected={selectedCharacter === 'antisocial'}
                  onClick={() => onSelectCharacter('antisocial')}
                />
                <span className="text-[10px] font-mono text-emerald-400 mt-1">報價 0.006 0G</span>
              </div>

              {/* Judge 3: Near-Miss */}
              <div className="flex flex-col items-center">
                <PixelAvatar
                  character="nearmiss"
                  motion={getJudgeMotion('nearmiss')}
                  size="md"
                  showSpeech={true}
                  speechText={getJudgeSpeech('nearmiss')}
                  score={stage === 'stamping' || stage === 'report' || stage === 'reviewed' ? reviews.find(r => r.judgeId === 'nearmiss')?.score : undefined}
                  hasStamp={stage === 'stamping' || stage === 'report' || stage === 'reviewed'}
                  isInspected={selectedCharacter === 'nearmiss'}
                  onClick={() => onSelectCharacter('nearmiss')}
                />
                <span className="text-[10px] font-mono text-rose-400 mt-1">報價 0.008 0G</span>
              </div>
            </div>
          )}
        </div>

        {/* 右側：Agent Marketplace 候選攤位 (Col 2) */}
        <div className="lg:col-span-2 hidden lg:flex flex-col items-center justify-end p-3 rounded-xl bg-slate-900/20 border border-slate-800/40 opacity-70 hover:opacity-100 transition-opacity">
          <div className="text-[9px] font-pixel text-slate-400 mb-2 text-center">
            MARKETPLACE<br />候選攤位
          </div>
          <PixelAvatar
            character="candidate"
            size="sm"
            motion="idle"
            onClick={() => onSelectCharacter('candidate')}
          />
          <span className="text-[9px] text-slate-500 font-mono mt-1">未被選中候補</span>
        </div>
      </div>

      {/* 底部操作提示 */}
      <div className="relative z-10 pt-3 flex items-center justify-between text-xs text-slate-500">
        <span className="flex items-center gap-1">
          <Sparkles className="w-3.5 h-3.5 text-amber-400" />
          點擊任一角色立繪，可隨時展開右側「0G TEE 防偽證明抽屜」查驗鏈上簽章。
        </span>
        <span className="font-mono text-[11px] text-slate-400">
          Intel TDX Enclave Active · Multi-Hop Verifiable
        </span>
      </div>
    </div>
  );
};
