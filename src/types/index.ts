export type AgentRole = 'producer' | 'judge';

export type JudgeId = 'professor' | 'antisocial' | 'nearmiss' | 'popcritic' | 'rhythmnerd';

export interface JudgeProfile {
  id: JudgeId;
  name: string;
  codename: string;
  title: string;
  tagline: string;
  personality: string;
  preference: string;
  price0G: number;
  reputation: number; // 4.8
  erc8004Id: string;
  badge: string;
  accentColor: string;
  bgGradient: string;
  systemObjective: string;
}

export interface AudioAnalysis {
  name: string;
  duration: number;
  pitchAccuracy: number; // 0-100 (e.g. 43)
  melodyRecognition: number; // 0-100 (e.g. 91)
  tempoBpm: number;
  dissonanceRate: number; // 0-100
  dominantKey: string;
  isPreset: boolean;
  notesSummary: string;
  audioUrl?: string; // 實際可播放之音訊 Blob URL
}

export interface XAgentProof {
  proofId: string;
  agentSeal: string;
  teeEnclaveId: string;
  model: string;
  signature: string;
  inferenceHash: string;
  latencyMs: number;
  tokensUsed: number;
  cost0G: number;
  timestamp: string;
}

export interface SingleJudgeReview {
  judgeId: JudgeId;
  judgeName: string;
  score: number; // 0-100
  headline: string;
  detailedCritique: string;
  reactionExpression: 'furious' | 'groove' | 'jitter' | 'shock' | 'neutral';
  proof: XAgentProof;
}

export interface ProducerVerdict {
  verdictId: string;
  title: string;
  overallScore: number;
  commercialVerdict: string;
  producerNote: string;
  marketingStrategy: string;
  budgetAllocated: number; // e.g. 0.03
  budgetSpent: number;     // e.g. 0.024
  producerCommission: number; // e.g. 0.006
  reviews: SingleJudgeReview[];
  serveProofVerified: boolean;
}

export type StageStep = 
  | 'idle'       // 0. 老闆辦公室待命：上傳音訊 & 下達指示
  | 'hired'      // 1. 經紀人接單彈跳，金幣入庫
  | 'scouting'   // 2. 經紀人進入市集驗證評審 Agentic ID
  | 'contracting'// 3. 經紀人下單撥款，專家入座
  | 'listening'  // 4. 音樂響起，評審生動劇烈抖動激辯
  | 'stamping'   // 5. 舉牌重砸，蓋下發光 X-Agent-Proof 印章
  | 'report'     // 6. 經紀人滑入展開戰略報告
  | 'reviewed';  // 7. 雇主憑證提交鏈上評價完成閉環

export interface NetworkStatus {
  connected: boolean;
  chainId: number;
  blockNumber: number;
  pingMs: number;
  gasPriceGwei: number;
  routerOnline: boolean;
  onlineModelsCount: number;
  activeModel: string;
}
