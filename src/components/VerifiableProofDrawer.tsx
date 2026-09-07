import React from 'react';
import { SingleJudgeReview, JudgeProfile } from '../types';
import { JUDGES_DATA } from '../services/zgCompute';
import { ZG_CONFIG } from '../services/zgChain';
import { X, ShieldCheck, Cpu, Coins, ExternalLink, CheckCircle2, Hash, FileCode2 } from 'lucide-react';

interface VerifiableProofDrawerProps {
  selectedCharacter: string | null;
  onClose: () => void;
  reviews: SingleJudgeReview[];
  budget: number;
  producerCommission: number;
}

export const VerifiableProofDrawer: React.FC<VerifiableProofDrawerProps> = ({
  selectedCharacter,
  onClose,
  reviews,
  budget,
  producerCommission
}) => {
  if (!selectedCharacter) return null;

  const isProducer = selectedCharacter === 'producer';
  const judge = JUDGES_DATA[selectedCharacter];
  const review = reviews.find(r => r.judgeId === selectedCharacter);

  return (
    <div className="fixed inset-y-0 right-0 z-50 w-full max-w-md bg-slate-950/95 border-l border-slate-800 shadow-2xl backdrop-blur-xl p-6 overflow-y-auto animate-in slide-in-from-right duration-300">
      {/* 頂部標題與關閉按鈕 */}
      <div className="flex items-center justify-between pb-4 border-b border-slate-800 mb-5">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded bg-purple-950/80 border border-purple-800 text-purple-300">
            <ShieldCheck className="w-5 h-5 text-emerald-400" />
          </div>
          <div>
            <h3 className="font-pixel text-xs text-slate-100">0G VERIFIABLE PROOF DRAWER</h3>
            <p className="text-[11px] text-slate-400">每一跳可驗證硬體證明與鏈上指紋</p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* 經紀人 (Producer) 的專屬帳本抽屜 */}
      {isProducer && (
        <div className="space-y-4 text-xs">
          <div className="p-4 rounded-xl bg-purple-950/40 border border-purple-500/30">
            <span className="text-[10px] font-pixel text-amber-300 uppercase block mb-1">PRODUCER AGENT (我的人)</span>
            <h4 className="font-bold text-sm text-slate-100">王牌音樂製作人 / 商業外包總代理</h4>
            <p className="text-slate-400 mt-1 text-[11px] leading-relaxed">
              完全代表雇主（您）的利益行事。負責接收您的預算，替您在 0G Agent Marketplace 殺價、挑選、驗證樂評身分並管理金流。
            </p>
          </div>

          {/* 經濟帳本 (Economic Ledger) 與 Agent 交易收據 */}
          <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 space-y-3 font-mono">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <span className="text-slate-400 flex items-center gap-1.5">
                <Coins className="w-3.5 h-3.5 text-amber-400" />
                雇主注入專案總預算
              </span>
              <span className="font-bold text-amber-300">{budget.toFixed(3)} 0G</span>
            </div>

            {/* 三筆 Agent-to-Agent 交易明細收據 */}
            <div className="space-y-2 pt-1 text-[11px]">
              <div className="p-2.5 rounded bg-slate-950 border border-slate-800 flex flex-col gap-1">
                <div className="flex justify-between items-center text-slate-300">
                  <span className="font-bold text-sky-400">#TX-01 ➔ Professor #014</span>
                  <span className="text-rose-400 font-bold">-0.010 0G</span>
                </div>
                <div className="flex justify-between text-[10px] text-slate-500">
                  <span>To: 0xa48f...7836 (0G GPU Provider)</span>
                  <span className="text-emerald-400">狀態: SETTLED (已結算)</span>
                </div>
              </div>

              <div className="p-2.5 rounded bg-slate-950 border border-slate-800 flex flex-col gap-1">
                <div className="flex justify-between items-center text-slate-300">
                  <span className="font-bold text-emerald-400">#TX-02 ➔ Anti-Social #207</span>
                  <span className="text-rose-400 font-bold">-0.006 0G</span>
                </div>
                <div className="flex justify-between text-[10px] text-slate-500">
                  <span>To: 0xa48f...7836 (0G GPU Provider)</span>
                  <span className="text-emerald-400">狀態: SETTLED (已結算)</span>
                </div>
              </div>

              <div className="p-2.5 rounded bg-slate-950 border border-slate-800 flex flex-col gap-1">
                <div className="flex justify-between items-center text-slate-300">
                  <span className="font-bold text-rose-400">#TX-03 ➔ Near-Miss #031</span>
                  <span className="text-rose-400 font-bold">-0.008 0G</span>
                </div>
                <div className="flex justify-between text-[10px] text-slate-500">
                  <span>To: 0xa48f...7836 (0G GPU Provider)</span>
                  <span className="text-emerald-400">狀態: SETTLED (已結算)</span>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-slate-800 text-emerald-300 font-bold text-xs">
              <span>經紀人為老闆省下佣金</span>
              <span>+{producerCommission.toFixed(3)} 0G</span>
            </div>
          </div>

          {/* 鏈上調用憑證 */}
          <div className="p-3.5 rounded-lg bg-slate-900 border border-slate-800 text-[11px] space-y-2 font-mono">
            <div className="flex justify-between items-center">
              <span className="text-slate-500">Jury Dispatcher 合約</span>
              <span className="text-slate-300 truncate max-w-[200px]">0x34493302...5648</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-500">網路環境</span>
              <span className="text-purple-300">0G Galileo (Chain ID 16602)</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-500">編譯目標</span>
              <span className="text-emerald-400">cancun EVM Target</span>
            </div>
          </div>
        </div>
      )}

      {/* 獨立評審 (Judge) 的 TEE 證明抽屜 */}
      {judge && (
        <div className="space-y-4 text-xs">
          {/* 基本資料卡 */}
          <div className="p-4 rounded-xl bg-slate-900 border border-slate-800">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] font-pixel text-slate-400">{judge.badge}</span>
              <span className="text-xs text-amber-300 font-bold">★ {judge.reputation}</span>
            </div>
            <h4 className="font-bold text-base text-slate-100">{judge.name}</h4>
            <p className="text-slate-400 text-[11px] italic mt-0.5">{judge.tagline}</p>
            <div className="mt-3 flex items-center gap-2">
              <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-mono text-[10px]">
                {judge.erc8004Id}
              </span>
              <span className="px-2 py-0.5 rounded bg-amber-950/60 text-amber-300 border border-amber-800 font-mono text-[10px]">
                單次服務: {judge.price0G} 0G
              </span>
            </div>
          </div>

          {/* 專屬評判目標 (System Objective) */}
          <div className="p-3.5 rounded-lg bg-slate-900/60 border border-slate-800 text-[11px]">
            <span className="text-slate-400 font-semibold block mb-1 flex items-center gap-1">
              <FileCode2 className="w-3.5 h-3.5 text-purple-400" />
              0G Compute 專屬 Objective 提示詞：
            </span>
            <p className="text-slate-300 leading-relaxed bg-slate-950 p-2.5 rounded border border-slate-800 font-mono text-[10.5px]">
              {judge.systemObjective}
            </p>
          </div>

          {/* 0G Compute TEE 硬體簽章 (X-Agent-Proof) */}
          <div className="p-4 rounded-xl bg-emerald-950/30 border border-emerald-500/40 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-pixel text-emerald-400 flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                X-AGENT-PROOF (TEE VERIFIED)
              </span>
              <span className="text-[10px] bg-emerald-950 text-emerald-300 px-1.5 py-0.5 rounded border border-emerald-800 font-mono">
                Intel TDX
              </span>
            </div>

            <p className="text-[11px] text-slate-300">
              該評判推論由 0G Compute 去中心化安全隔離硬體（TEE Enclave）封裝產出，確認模型未被偷換且回應附帶硬體私鑰簽章。
            </p>

            {review?.proof ? (
              <div className="space-y-1.5 font-mono text-[10.5px] bg-slate-950 p-2.5 rounded border border-emerald-900/50">
                <div className="flex justify-between text-slate-400">
                  <span>Enclave ID:</span>
                  <span className="text-emerald-300">{review.proof.teeEnclaveId}</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Inference Model:</span>
                  <span className="text-purple-300">{review.proof.model}</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Signature:</span>
                  <span className="text-slate-300 truncate max-w-[160px]">{review.proof.signature}</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>推論延遲:</span>
                  <span className="text-amber-300">{review.proof.latencyMs} ms</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Token 消耗:</span>
                  <span className="text-slate-200">{review.proof.tokensUsed} tokens</span>
                </div>
              </div>
            ) : (
              <div className="text-[11px] text-slate-400 italic">
                等待經紀人下單並啟動推論後出具...
              </div>
            )}
          </div>

          {/* 區塊鏈瀏覽器核驗 */}
          <a
            href={`${ZG_CONFIG.EXPLORER_URL}/address/${ZG_CONFIG.CONTRACTS.ERC8004_IDENTITY}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 w-full py-2.5 rounded-lg bg-slate-900 hover:bg-slate-850 border border-slate-800 text-slate-300 hover:text-white transition-colors font-mono text-xs"
          >
            <ExternalLink className="w-3.5 h-3.5 text-purple-400" />
            在 0G 區塊瀏覽器查驗此 Agent 身分
          </a>
        </div>
      )}
    </div>
  );
};
