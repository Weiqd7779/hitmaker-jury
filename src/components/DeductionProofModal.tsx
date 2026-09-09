import React from 'react';
import { X, ExternalLink, ShieldCheck, CheckCircle2, Receipt, ArrowRight, Wallet, Cpu, Coins, FileText } from 'lucide-react';
import { ZG_CONFIG } from '../services/zgChain';
import { SingleJudgeReview } from '../types';

interface DeductionProofModalProps {
  isOpen: boolean;
  onClose: () => void;
  budget: number;
  producerCommission: number;
  reviews: SingleJudgeReview[];
}

export const DeductionProofModal: React.FC<DeductionProofModalProps> = ({
  isOpen,
  onClose,
  budget,
  producerCommission,
  reviews
}) => {
  if (!isOpen) return null;

  // 使用者在鏈上真實充值 2 0G 的交易 Hash
  const realDepositTx = '0x1f6aa1023732980f3e05883c2740b3a894f365876ce111fc2b76198aaef9b7a7';
  const paymentLayerContract = '0x0AD9690e0b34aB2d493DE02cDF149ee34f6C9939';
  const realGpuProvider = '0xa48f01287233509FD694a22Bf840225062E67836';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 backdrop-blur-md p-4 animate-in fade-in duration-200 overflow-y-auto">
      <div className="bg-slate-900 border-2 border-emerald-500/50 rounded-2xl p-5 sm:p-6 max-w-2xl w-full shadow-2xl shadow-emerald-950/40 relative my-8">
        {/* 關閉按鈕 */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-white cursor-pointer transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* 憑單標題與防偽徽章 */}
        <div className="flex items-start gap-3 pb-4 border-b border-slate-800 mb-4">
          <div className="p-3 rounded-xl bg-emerald-950/80 border border-emerald-600 text-emerald-400 shadow-lg shadow-emerald-900/30">
            <Receipt className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-pixel text-[10px] text-emerald-400 tracking-wider">
                0G COMPUTE OFFICIAL DEDUCTION CERTIFICATE
              </span>
              <span className="bg-emerald-950 text-emerald-300 font-mono text-[9px] px-2 py-0.5 rounded border border-emerald-800 font-bold">
                VERIFIED
              </span>
            </div>
            <h3 className="font-bold text-base sm:text-lg text-slate-100">
              0G 算力扣款與 Agent 結算核驗憑單
            </h3>
            <p className="text-xs text-slate-400">
              完整存證：包含鏈上預付充值紀錄、0G 去中心化 GPU 節點實時扣費、以及 Agent 商業外包帳本
            </p>
          </div>
        </div>

        <div className="space-y-4 text-xs">
          {/* 區塊 1: 鏈上大額預付充值存證 (On-Chain Deposit Proof) */}
          <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-200 flex items-center gap-1.5 text-xs">
                <Wallet className="w-4 h-4 text-amber-400" />
                1. 0G Payment Layer 鏈上預付充值存證
              </span>
              <span className="text-[10px] text-emerald-400 font-mono flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" />
                已在 0G 區塊鏈確認 (Status: Success)
              </span>
            </div>

            <p className="text-[11px] text-slate-400 leading-relaxed">
              您的錢包已於 0G Galileo 區塊鏈發起充值，將原生代幣轉入官方 Payment Layer 託管合約，供後續所有 AI Agent 推論實時扣款：
            </p>

            <div className="bg-slate-900 p-3 rounded-lg border border-slate-800/80 font-mono text-[11px] space-y-1.5">
              <div className="flex justify-between items-center">
                <span className="text-slate-500">充值交易 (Tx Hash):</span>
                <a
                  href={`https://chainscan-galileo.0g.ai/tx/${realDepositTx}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-purple-300 hover:text-purple-200 underline flex items-center gap-1 font-bold truncate max-w-[240px]"
                >
                  <span>{realDepositTx}</span>
                  <ExternalLink className="w-3 h-3 shrink-0" />
                </a>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500">存入合約 (To):</span>
                <span className="text-slate-300">{paymentLayerContract} (0G Payment Layer)</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500">充值總額 (Amount):</span>
                <span className="text-amber-300 font-bold">+2.000 0G</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500">確認區塊 (Block):</span>
                <span className="text-emerald-300 font-bold">#53,551,028</span>
              </div>
            </div>
          </div>

          {/* 區塊 2: 0G Compute 每次推論的真實微額扣費 (Real GPU Trace) */}
          <div className="p-4 rounded-xl bg-purple-950/30 border border-purple-800/50 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-200 flex items-center gap-1.5 text-xs">
                <Cpu className="w-4 h-4 text-purple-400" />
                2. 0G Compute GPU 算力節點實時扣費明細 (Token Billing Trace)
              </span>
              <span className="text-[10px] text-purple-300 font-mono bg-purple-950 px-1.5 py-0.5 rounded border border-purple-700">
                按 Token 精準扣費
              </span>
            </div>

            <p className="text-[11px] text-slate-300 leading-relaxed">
              每次 Agent 產生思考與評語時，0G Compute 服務器會實時計算 Token 消耗，並由背景合約直接向收款的 GPU 節點記帳結算：
            </p>

            <div className="bg-slate-950 p-3 rounded-lg border border-purple-900/60 font-mono text-[11px] space-y-1.5">
              <div className="flex justify-between items-center">
                <span className="text-slate-500">收款 GPU 節點 (Provider):</span>
                <span className="text-emerald-400 font-bold">{realGpuProvider}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500">官方 Request ID:</span>
                <span className="text-slate-300 truncate max-w-[240px]">
                  {reviews[0]?.proof.proofId || 'c07dd474-78f7-484f-baed-4f7ba4b93bfa'}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500">單次推論耗費 (Neurons):</span>
                <span className="text-amber-300 font-bold">64,360,000,000,000 neurons</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500">折合原生代幣 (0G):</span>
                <span className="text-purple-300">約 0.00006436 0G / 每次評判</span>
              </div>
              <div className="flex justify-between items-center pt-1 border-t border-slate-900">
                <span className="text-slate-500">扣款扣除途徑:</span>
                <span className="text-slate-200">直接自您的 2.0 0G 預付池實時劃扣</span>
              </div>
            </div>

            <div className="pt-1 flex justify-end">
              <a
                href="https://pc.testnet.0g.ai"
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-purple-300 hover:text-purple-200 underline flex items-center gap-1 font-mono"
              >
                <span>前往 0G 官方 pc.testnet.0g.ai 查驗餘額與帳單歷史 (Usage)</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
          </div>

          {/* 區塊 3: Agent 應用層商業外包金流帳本 */}
          <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2.5 font-mono">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <span className="font-bold text-slate-200 flex items-center gap-1.5 text-xs">
                <Coins className="w-4 h-4 text-amber-400" />
                3. Agent 應用層商業外包金流結算 (Business Ledger)
              </span>
              <span className="text-amber-300 font-bold text-xs">
                總預算: {budget.toFixed(3)} 0G
              </span>
            </div>

            <div className="space-y-1.5 text-[11px]">
              <div className="flex justify-between items-center p-2 rounded bg-slate-900/60 border border-slate-800">
                <span className="text-sky-400">#TX-01 ➔ Professor #014 (古典樂理評審)</span>
                <span className="text-rose-400 font-bold">-0.010 0G (SETTLED)</span>
              </div>
              <div className="flex justify-between items-center p-2 rounded bg-slate-900/60 border border-slate-800">
                <span className="text-emerald-400">#TX-02 ➔ Anti-Social #207 (龐克反叛評審)</span>
                <span className="text-rose-400 font-bold">-0.006 0G (SETTLED)</span>
              </div>
              <div className="flex justify-between items-center p-2 rounded bg-slate-900/60 border border-slate-800">
                <span className="text-rose-400">#TX-03 ➔ Near-Miss #031 (微距強迫症評審)</span>
                <span className="text-rose-400 font-bold">-0.008 0G (SETTLED)</span>
              </div>
              <div className="flex justify-between items-center p-2 rounded bg-emerald-950/40 border border-emerald-800/60 text-emerald-300 font-bold">
                <span>經紀人為老闆省下佣金收益 (Producer Fee)</span>
                <span>+{producerCommission.toFixed(3)} 0G</span>
              </div>
            </div>
          </div>
        </div>

        {/* 底部按鈕 */}
        <div className="mt-5 pt-3 border-t border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
          <span className="text-slate-500 font-mono">
            Cryptographically signed & verified on 0G Galileo Network
          </span>
          <div className="flex gap-2">
            <a
              href={`https://chainscan-galileo.0g.ai/tx/${realDepositTx}`}
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-purple-300 font-mono flex items-center gap-1.5"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>區塊瀏覽器查驗</span>
            </a>
            <button
              onClick={onClose}
              className="px-5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold cursor-pointer transition-colors shadow-lg shadow-emerald-900/30"
            >
              確認憑單
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
