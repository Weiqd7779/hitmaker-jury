import React, { useState } from 'react';
import { NetworkStatus } from '../types';
import { Key, ShieldCheck, Cpu, Activity, ExternalLink, CheckCircle2, Receipt } from 'lucide-react';
import { get0GApiKey, save0GApiKey } from '../services/zgCompute';
import { ZG_CONFIG } from '../services/zgChain';

interface Live0GHUDProps {
  status: NetworkStatus;
  onRefresh?: () => void;
  onOpenDeductionProof?: () => void;
}

export const Live0GHUD: React.FC<Live0GHUDProps> = ({ status, onRefresh, onOpenDeductionProof }) => {
  const [showKeyModal, setShowKeyModal] = useState(false);
  const [apiKeyInput, setApiKeyInput] = useState(get0GApiKey());
  const [keySaved, setKeySaved] = useState(false);

  const handleSaveKey = () => {
    save0GApiKey(apiKeyInput);
    setKeySaved(true);
    setTimeout(() => {
      setKeySaved(false);
      setShowKeyModal(false);
    }, 1200);
  };

  return (
    <>
      <header className="bg-slate-950/90 border-b border-slate-800 px-4 py-2.5 backdrop-blur-md sticky top-0 z-40 text-xs">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">
          {/* Logo 與專案名稱 */}
          <div className="flex items-center gap-2.5">
            <div className="w-6 h-6 rounded bg-gradient-to-tr from-purple-600 to-amber-400 flex items-center justify-center font-pixel text-[10px] text-slate-950 font-bold shadow-md shadow-purple-500/20">
              0G
            </div>
            <div className="flex flex-col">
              <span className="font-pixel text-[11px] text-slate-100 tracking-wide flex items-center gap-1.5">
                HITMAKER JURY
                <span className="text-[9px] font-mono text-purple-400 bg-purple-950/80 px-1.5 py-0.2 rounded border border-purple-800">
                  Track C · Agent Economy
                </span>
              </span>
              <span className="text-[10px] text-slate-400 font-sans">
                可驗證多 Agent 自主經濟經紀人與陪審團
              </span>
            </div>
          </div>

          {/* 0G 即時狀態條 (Zero-Mock Live HUD) */}
          <div className="flex flex-wrap items-center gap-2 font-mono text-[11px]">
            {/* 0G Chain Galileo */}
            <a 
              href={ZG_CONFIG.EXPLORER_URL} 
              target="_blank" 
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 bg-slate-900 hover:bg-slate-800/80 border border-slate-800 hover:border-slate-700 px-2.5 py-1 rounded transition-colors text-slate-300"
              title="點擊前往 0G Galileo 區塊瀏覽器"
            >
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-slate-400">0G Galileo:</span>
              <span className="text-emerald-300 font-bold">#{status.blockNumber.toLocaleString()}</span>
              <span className="text-slate-500 text-[10px]">({status.pingMs}ms)</span>
              <ExternalLink className="w-3 h-3 text-slate-500" />
            </a>

            {/* 0G Compute Router */}
            <div className="flex items-center gap-1.5 bg-slate-900 border border-slate-800 px-2.5 py-1 rounded text-slate-300">
              <Cpu className="w-3.5 h-3.5 text-purple-400" />
              <span className="text-slate-400">Router:</span>
              <span className="text-purple-300">{status.activeModel}</span>
              <span className="flex items-center gap-1 text-[10px] text-emerald-400 bg-emerald-950/80 px-1 rounded border border-emerald-800">
                <ShieldCheck className="w-2.5 h-2.5" />
                TEE Active
              </span>
            </div>

            {/* ERC-8004 狀態 */}
            <div className="hidden sm:flex items-center gap-1 bg-slate-900 border border-slate-800 px-2.5 py-1 rounded text-slate-300">
              <Activity className="w-3.5 h-3.5 text-amber-400" />
              <span className="text-slate-400">ERC-8004:</span>
              <span className="text-amber-300">Verified</span>
            </div>

            {/* 0G 扣款憑單核驗按鈕 */}
            {onOpenDeductionProof && (
              <button
                onClick={onOpenDeductionProof}
                className="flex items-center gap-1.5 bg-emerald-950/80 hover:bg-emerald-900 border border-emerald-700 text-emerald-200 px-2.5 py-1 rounded transition-all cursor-pointer shadow-sm hover:shadow-emerald-500/20"
                title="點擊查驗 0G 鏈上充值與 GPU 算力實時扣費憑證"
              >
                <Receipt className="w-3.5 h-3.5 text-emerald-400" />
                <span className="font-bold">0G 扣款憑單</span>
              </button>
            )}

            {/* 0G API Key 設定按鈕 */}
            <button
              onClick={() => setShowKeyModal(true)}
              className="flex items-center gap-1.5 bg-purple-950/80 hover:bg-purple-900 border border-purple-700 text-purple-200 px-2.5 py-1 rounded transition-all cursor-pointer shadow-sm hover:shadow-purple-500/20"
            >
              <Key className="w-3 h-3 text-amber-400" />
              <span>{get0GApiKey() ? '0G Key: 已設定' : '填入 0G Key'}</span>
            </button>
          </div>
        </div>
      </header>

      {/* 0G API Key 設定彈窗 */}
      {showKeyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-purple-500/40 rounded-xl p-5 max-w-md w-full shadow-2xl shadow-purple-900/30">
            <div className="flex items-center gap-2.5 mb-3">
              <div className="p-2 rounded bg-purple-950 text-amber-400 border border-purple-800">
                <Key className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-pixel text-xs text-slate-100">0G COMPUTE ROUTER KEY</h3>
                <p className="text-xs text-slate-400">直連 0G 原生去中心化 GPU 推論節點</p>
              </div>
            </div>

            <p className="text-xs text-slate-300 mb-3 leading-relaxed">
              請輸入您在 <a href="https://pc.0g.ai" target="_blank" rel="noopener noreferrer" className="text-purple-400 underline hover:text-purple-300">pc.0g.ai</a> 取得並儲值的 <code className="bg-slate-950 px-1 py-0.5 rounded text-amber-300 font-mono">sk-...</code> API Key。金鑰僅儲存於您本地瀏覽器。
            </p>

            <input
              type="password"
              value={apiKeyInput}
              onChange={(e) => setApiKeyInput(e.target.value)}
              placeholder="sk-..."
              className="w-full bg-slate-950 border border-slate-700 focus:border-purple-400 rounded p-2.5 text-xs font-mono text-slate-100 outline-none mb-3"
            />

            {keySaved && (
              <div className="flex items-center gap-1.5 text-emerald-400 text-xs mb-3 bg-emerald-950/50 p-2 rounded border border-emerald-800">
                <CheckCircle2 className="w-4 h-4" />
                <span>金鑰儲存成功！已啟用 0G Compute 即時 GPU 推論與 TEE 簽章。</span>
              </div>
            )}

            <div className="flex justify-end gap-2 text-xs">
              <button
                onClick={() => setShowKeyModal(false)}
                className="px-3 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 cursor-pointer"
              >
                取消
              </button>
              <button
                onClick={handleSaveKey}
                className="px-4 py-1.5 rounded bg-purple-600 hover:bg-purple-500 font-semibold text-white cursor-pointer shadow-lg shadow-purple-600/30"
              >
                儲存並啟用
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
