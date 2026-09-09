export type WorkerKey = 'professor' | 'antisocial' | 'nearmiss';
export type Check = { key: string; status: 'passed' | 'failed' | 'unavailable'; detail: string };
export type Verification = { ok: boolean; checkedAt: string; checks: Check[]; limitations?: string[] };
export type WorkRecord = {
  jobId: string; kind: 'seed' | 'live'; manager: string;
  worker: { key: WorkerKey; name: string; agentId: string; model: string; amount: string; payee: string };
  response: { body: string; proofHeader: string };
  observedBlock: { number: number; hash: string };
};
export type Work = {
  key: WorkerKey; agentId: string; status: string; record?: WorkRecord;
  storage?: { rootHash: string; stored: boolean; txHash?: string };
  feedback?: { txHash: string; attestTxHash?: string; index: string };
  payment?: { txHash: string }; verification?: Verification;
};
export type Job = {
  id: string; kind: 'seed' | 'live'; model: string; status: string; createdAt: string; error?: string;
  events: { id: string; at: string; key: string; status: string; message: string }[]; works: Work[];
};
export type CareerState = {
  ready: boolean; missing: string[]; token: string; manager: string | null; running: boolean;
  paidJobLimit: number; paidJobsCreated: number;
  modelA: string; modelB: string;
  workers: { key: WorkerKey; name: string; title: string; pitch: string; amount: string; agentId: string }[];
  music: { name: string; duration: number; audioHash: string; notes: string; analysisSource: string };
  domain: { chainId: number; identity: string; canonical: string; verified: string };
  jobs: Job[];
};
export async function api<T>(path: string, token?: string, body?: unknown): Promise<T> {
  const response = await fetch(path, body === undefined ? { cache: 'no-store' } : {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Career-Token': token || '' }, body: JSON.stringify(body),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`);
  return data as T;
}
export function reviewOf(work?: Work): { score: number; headline: string; critique: string } | null {
  if (!work?.record) return null;
  try { return JSON.parse(work.record.response.body).review || null; } catch { return null; }
}
export function careerCounts(jobs: Job[], agentId: string, model: string) {
  const works = new Map<string, Work>();
  for (const job of jobs) for (const work of job.works) {
    if (work.record && work.record.worker.agentId === agentId && work.status === 'completed' && work.verification?.ok) works.set(`${job.id}:${agentId}`, work);
  }
  return { lifetime: works.size, current: [...works.values()].filter(w => w.record?.worker.model === model).length };
}
