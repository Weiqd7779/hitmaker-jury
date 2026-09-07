import React, { useState } from 'react';
import { ProducerVerdict } from '../types';
import { Star, ShieldCheck, CheckCircle2, Sparkles, X, ExternalLink, AlertTriangle } from 'lucide-react';
import { ZG_CONFIG, submitRealOnChainReview } from '../services/zgChain';
import confetti from 'canvas-confetti';

interface ServeProofReviewModalProps {
  verdict: ProducerVerdict;
  isOpen: boolean;
  onClose: () => void;
  onSubmitReview: (rating: number, comment: string, txHash: string) => void;
}

export const ServeProofReviewModal: React.FC<ServeProofReviewModalProps> = ({
  verdict,
  isOpen,
  onClose,
  onSubmitReview
}) => {
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('經紀人外包陣容眼光獨到，各專家視角極具互補性，戰略建議非常實用！');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submittedTx, setSubmittedTx] = useState<string | null>(null);
  const [txError, setTxError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async () => {
    setIsSubmitting(true);
    setTxError(null);
    try {
      const proofSig = verdict.reviews[0]?.proof.signature || '0x0g-proof-serveproof';
      const result = await submitRealOnChainReview(rating, comment, proofSig);
      setSubmittedTx(result.txHash);
      confetti({
        particleCount: 120,
        spread: 80,
        origin: { y: 0.6 }
      });
      onSubmitReview(rating, comment, result.txHash);
    } catch (err: any) {
      console.error('On-chain submission error:', err);
      setTxError(err.message || '鏈上交易失敗');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className="bg-slate-900 border-2 border-amber-500/50 rounded-2xl p-6 max-w-lg w-full shadow-2xl shadow-amber-950/40 relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-white cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {/* 頂部標題 */}
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2.5 rounded-xl bg-amber-950/80 border border-amber-700 text-amber-300">
            <Sparkles className="w-6 h-6" />
          </div>
          <div>
            <span className="font-pixel text-[10px] text-amber-400">PROOF-GATED REPUTATION</span>
            <h3 className="font-bold text-base text-slate-100">憑服務證明（ServeProof）留存鏈上聲譽</h3>
          </div>
        </div>

        {/* 驗證通過標章 */}
        <div className="bg-emerald-950/40 border border-emerald-500/50 p-3 rounded-xl mb-4 flex items-center gap-2.5 text-xs text-emerald-200">
          <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0" />
          <div>
            <p className="font-bold flex items-center gap-1">
              ServeProof: VERIFIED ✅
            </p>
            <p className="text-[11px] text-emerald-300/80">
              已驗證本次 0G Compute TEE 硬體推論簽章，確認您確實獲得 3 位評審的服務，解鎖鏈上評價權限！
            </p>
          </div>
        </div>

        {!submittedTx ? (
          <div className="space-y-4">
            {/* 星級評分 */}
            <div>
              <label className="text-xs text-slate-400 block mb-1.5">為本次外包評審團與經紀人打分：</label>
              <div className="flex items-center gap-2">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setRating(star)}
                    className="cursor-pointer transition-transform hover:scale-110 p-1"
                  >
                    <Star
                      className={`w-7 h-7 ${
                        star <= rating
                          ? 'text-amber-400 fill-amber-400'
                          : 'text-slate-700'
                      }`}
                    />
                  </button>
                ))}
                <span className="text-sm font-bold text-amber-300 ml-2 font-mono">{rating}.0 / 5.0</span>
              </div>
            </div>

            {/* 評價內容 */}
            <div>
              <label className="text-xs text-slate-400 block mb-1.5">雇主評價回饋（將寫入 0G ERC-8004 聲譽合約）：</label>
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                rows={3}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-xs text-slate-200 outline-none focus:border-amber-400 resize-none"
              />
            </div>

            {/* 錯誤提示 */}
            {txError && (
              <div className="p-3 rounded-lg bg-rose-950/60 border border-rose-800 text-rose-300 text-xs flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />
                <div className="space-y-1">
                  <p className="font-bold">錢包簽署提示：</p>
                  <p className="text-[11px] leading-relaxed whitespace-pre-line">{txError}</p>
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={onClose}
                className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs cursor-pointer"
              >
                取消
              </button>
              <button
                onClick={handleSubmit}
                disabled={isSubmitting}
                className="px-5 py-2 rounded-lg bg-gradient-to-r from-amber-500 to-purple-600 hover:from-amber-400 hover:to-purple-500 text-slate-950 font-bold text-xs cursor-pointer shadow-lg shadow-purple-900/30 flex items-center gap-2"
              >
                {isSubmitting ? (
                  <span>MetaMask 簽署打包中...</span>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>連接錢包簽署評價 (0G Testnet)</span>
                  </>
                )}
              </button>
            </div>
          </div>
        ) : (
          <div className="text-center py-4 space-y-3">
            <div className="w-12 h-12 rounded-full bg-emerald-950 border border-emerald-500 flex items-center justify-center mx-auto text-emerald-400">
              <CheckCircle2 className="w-7 h-7" />
            </div>
            <h4 className="font-bold text-slate-100 text-sm">聲譽評價已成功上鏈！</h4>
            <p className="text-xs text-slate-400 max-w-sm mx-auto font-mono text-[11px] break-all bg-slate-950 p-2.5 rounded border border-slate-800">
              Tx Hash: {submittedTx}
            </p>
            <div className="pt-2 flex justify-center gap-3">
              <a
                href={`${ZG_CONFIG.EXPLORER_URL}/tx/${submittedTx}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-purple-300 text-xs font-mono"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                在 0G 區塊瀏覽器查看
              </a>
              <button
                onClick={onClose}
                className="px-5 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs cursor-pointer"
              >
                完成
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
