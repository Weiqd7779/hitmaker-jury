import React, { useRef, useState } from 'react';
import { AudioAnalysis } from '../types';
import { PRESET_OFF_PITCH_STAR, PRESET_PERFECT_PRACTICE, PRESET_CRUEL_ANGEL, analyzeUploadedAudio, playTrack, stopAudio } from '../services/audioAnalyzer';
import { Upload, Play, Square, Music, Sparkles, Coins, HelpCircle } from 'lucide-react';

interface ExecutiveCommandBarProps {
  currentAudio: AudioAnalysis;
  onAudioChange: (audio: AudioAnalysis) => void;
  bossDirective: string;
  onDirectiveChange: (directive: string) => void;
  budget: number;
  onBudgetChange: (budget: number) => void;
  isProcessing: boolean;
  onHireProducer: () => void;
  isAnalyzed?: boolean;
}

export const ExecutiveCommandBar: React.FC<ExecutiveCommandBarProps> = ({
  currentAudio,
  onAudioChange,
  bossDirective,
  onDirectiveChange,
  budget,
  onBudgetChange,
  isProcessing,
  onHireProducer,
  isAnalyzed = false
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const stopFnRef = useRef<(() => void) | null>(null);

  const handleTogglePlay = () => {
    if (isPlaying) {
      if (stopFnRef.current) stopFnRef.current();
      stopAudio();
      setIsPlaying(false);
    } else {
      setIsPlaying(true);
      stopFnRef.current = playTrack(currentAudio, () => setIsPlaying(false));
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        const analysis = await analyzeUploadedAudio(file);
        onAudioChange(analysis);
      } catch (err) {
        alert('解析音訊失敗，請使用一般 MP3 或 WAV 格式。');
      }
    }
  };

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 shadow-xl backdrop-blur-md">
      <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-800 text-xs">
        <div className="flex items-center gap-2">
          <span className="font-pixel text-amber-400 text-[11px] flex items-center gap-1.5">
            <span className="w-2 h-2 bg-amber-400 rounded-full animate-ping" />
            BOSS DESK
          </span>
          <span className="text-slate-400">老闆專屬發包控制台（由您指示輸入，經紀人自主跑腿）</span>
        </div>
        <div className="flex items-center gap-1 text-[11px] text-slate-400 bg-slate-950 px-2.5 py-1 rounded border border-slate-800">
          <Coins className="w-3.5 h-3.5 text-amber-400" />
          <span>專案預算:</span>
          <span className="font-bold text-amber-300 font-mono">{budget.toFixed(3)} 0G</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* 左側：音樂證據選擇與特徵儀表 (Col 5) */}
        <div className="lg:col-span-5 flex flex-col gap-2.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
              <Music className="w-3.5 h-3.5 text-purple-400" />
              1. 選擇或上傳音樂證據 (Audio Evidence)
            </span>
            <button
              onClick={handleTogglePlay}
              className={`flex items-center gap-1 text-[11px] px-2 py-0.5 rounded transition-all cursor-pointer font-mono ${
                isPlaying 
                  ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40 animate-pulse'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700'
              }`}
            >
              {isPlaying ? <Square className="w-3 h-3 fill-current" /> : <Play className="w-3 h-3 fill-current" />}
              <span>{isPlaying ? '停止試聽' : '試聽原聲'}</span>
            </button>
          </div>

          {/* 案例按鈕組 */}
          <div className="grid grid-cols-3 gap-1.5 text-xs">
            <button
              onClick={() => {
                stopAudio();
                setIsPlaying(false);
                onAudioChange(PRESET_OFF_PITCH_STAR);
              }}
              className={`p-1.5 rounded border text-left transition-all cursor-pointer flex flex-col gap-0.5 ${
                currentAudio.name.includes('走音小星星')
                  ? 'bg-purple-950/80 border-purple-500 text-purple-100 shadow-lg shadow-purple-900/30'
                  : 'bg-slate-950 hover:bg-slate-800/80 border-slate-800 text-slate-400'
              }`}
            >
              <span className="font-bold text-amber-300 text-[10.5px] truncate">
                ⭐ 走音小星星
              </span>
              <span className="text-[9.5px] text-slate-400 truncate">
                走音反差案例
              </span>
            </button>

            <button
              onClick={() => {
                stopAudio();
                setIsPlaying(false);
                onAudioChange(PRESET_CRUEL_ANGEL);
              }}
              className={`p-1.5 rounded border text-left transition-all cursor-pointer flex flex-col gap-0.5 ${
                currentAudio.name.includes('殘酷天使')
                  ? 'bg-purple-950/80 border-purple-500 text-purple-100 shadow-lg shadow-purple-900/30'
                  : 'bg-slate-950 hover:bg-slate-800/80 border-slate-800 text-slate-400'
              }`}
            >
              <span className="font-bold text-emerald-300 text-[10.5px] truncate">
                🔥 殘酷天使 (EVA)
              </span>
              <span className="text-[9.5px] text-slate-400 truncate">
                您電腦的 30s MP3
              </span>
            </button>

            <button
              onClick={() => {
                stopAudio();
                setIsPlaying(false);
                onAudioChange(PRESET_PERFECT_PRACTICE);
              }}
              className={`p-1.5 rounded border text-left transition-all cursor-pointer flex flex-col gap-0.5 ${
                currentAudio.name.includes('機械曲')
                  ? 'bg-purple-950/80 border-purple-500 text-purple-100 shadow-lg shadow-purple-900/30'
                  : 'bg-slate-950 hover:bg-slate-800/80 border-slate-800 text-slate-400'
              }`}
            >
              <span className="font-bold text-sky-300 text-[10.5px] truncate">
                🤖 機械練習曲
              </span>
              <span className="text-[9.5px] text-slate-400 truncate">
                極致精準對比
              </span>
            </button>
          </div>

          {/* 自訂上傳區域 */}
          <div 
            onClick={() => fileInputRef.current?.click()}
            className="border border-dashed border-slate-700 hover:border-purple-400 bg-slate-950/50 hover:bg-slate-900/50 rounded-lg p-2.5 text-center cursor-pointer transition-colors flex items-center justify-center gap-2 group"
          >
            <Upload className="w-4 h-4 text-slate-400 group-hover:text-purple-400 transition-colors" />
            <span className="text-xs text-slate-300 group-hover:text-white">
              {currentAudio.isPreset ? '拖放或點擊上傳自訂 MP3 / WAV 歌曲' : `已載入待審: ${currentAudio.name}`}
            </span>
            <input 
              ref={fileInputRef} 
              type="file" 
              accept="audio/*" 
              className="hidden" 
              onChange={handleFileUpload} 
            />
          </div>

          {/* 音訊狀態指標（未聆聽前不劇透，等待評審團聽完才揭曉） */}
          <div className="bg-slate-950 rounded p-2.5 border border-slate-800/80 text-[11px] grid grid-cols-3 gap-2 text-center font-mono">
            <div>
              <span className="text-slate-500 text-[10px] block">音準率判定</span>
              <span className={`font-bold ${isAnalyzed ? (currentAudio.pitchAccuracy < 60 ? 'text-rose-400' : 'text-emerald-400') : 'text-slate-400'}`}>
                {isAnalyzed ? `${currentAudio.pitchAccuracy}%` : '待評審聆聽'}
              </span>
            </div>
            <div>
              <span className="text-slate-500 text-[10px] block">旋律辨識度</span>
              <span className={`font-bold ${isAnalyzed ? 'text-purple-300' : 'text-slate-400'}`}>
                {isAnalyzed ? `${currentAudio.melodyRecognition}%` : '待比對輪廓'}
              </span>
            </div>
            <div>
              <span className="text-slate-500 text-[10px] block">節奏分析</span>
              <span className={`font-bold ${isAnalyzed ? 'text-amber-300' : 'text-slate-400'}`}>
                {isAnalyzed ? `${currentAudio.tempoBpm} BPM` : '待量測'}
              </span>
            </div>
          </div>
        </div>

        {/* 右側：老闆指示與發包按鈕 (Col 7) */}
        <div className="lg:col-span-7 flex flex-col justify-between gap-3">
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                2. 給王牌經紀人的策略指示 (Boss Directive)
              </label>
              <div className="flex gap-1 text-[10px]">
                <button
                  type="button"
                  onClick={() => onDirectiveChange('這首走地下龐克風，幫我找最挑剔的耳朵來審！')}
                  className="bg-slate-800 hover:bg-slate-700 text-slate-300 px-2 py-0.5 rounded cursor-pointer"
                >
                  龐克標籤
                </button>
                <button
                  type="button"
                  onClick={() => onDirectiveChange('古典學院與龐克反差兼備，風格越多元越好。')}
                  className="bg-slate-800 hover:bg-slate-700 text-slate-300 px-2 py-0.5 rounded cursor-pointer"
                >
                  多元平衡
                </button>
              </div>
            </div>

            <textarea
              value={bossDirective}
              onChange={(e) => onDirectiveChange(e.target.value)}
              placeholder="例：這首想走地下龐克風，幫我找業界最具性格、最挑剔的 3 位專家來檢驗！"
              rows={2}
              className="w-full bg-slate-950 border border-slate-700 focus:border-amber-400 rounded-lg p-2.5 text-xs text-slate-100 placeholder:text-slate-600 outline-none resize-none transition-colors"
            />
          </div>

          {/* 預算微調與正式簽約發包 */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
            <div className="flex items-center gap-3">
              <span className="text-xs text-slate-400">專案預算：</span>
              <input 
                type="range" 
                min="0.02" 
                max="0.05" 
                step="0.005" 
                value={budget} 
                onChange={(e) => onBudgetChange(parseFloat(e.target.value))}
                className="w-28 accent-amber-400 cursor-pointer" 
              />
              <span className="font-mono text-xs text-amber-300 font-bold">{budget} 0G</span>
            </div>

            <button
              onClick={onHireProducer}
              disabled={isProcessing}
              className={`flex-1 sm:flex-initial px-6 py-3 rounded-xl font-pixel text-xs transition-all duration-300 cursor-pointer flex items-center justify-center gap-2 shadow-xl ${
                isProcessing
                  ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'
                  : 'bg-gradient-to-r from-amber-500 via-purple-600 to-indigo-600 hover:from-amber-400 hover:via-purple-500 hover:to-indigo-500 text-slate-950 font-bold hover:scale-[1.02] shadow-purple-600/30'
              }`}
            >
              <Coins className="w-4 h-4 text-slate-950 fill-current" />
              <span>{isProcessing ? '經紀人執行任務中...' : `💼 委託王牌經紀人 (${budget} 0G)`}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
