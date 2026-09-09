import { useEffect, useRef, useState } from 'react';
import { Interface, formatEther, getAddress } from 'ethers';
import { ExternalLink, Wallet, Check, Download } from 'lucide-react';
import { deploymentData, inspectManager, publicProvider, quoteTransaction, receipt, type ChainManifest, type ChainState, type RpcProvider } from '../services/onchain';

type Saved = { manager?: string; deploymentHash?: string; settlementHash?: string; pending?: { operation: 'deploy' | 'settle'; hash?: string; data: string; to?: string; value: string; from: string } };
const explorer = (value: string, type = 'tx') => `https://chainscan-galileo.0g.ai/${type}/${value}`;
const short = (value: string) => `${value.slice(0, 8)}…${value.slice(-6)}`;
const storageKey = (address: string, job: string) => `career-erc8004:${address.toLowerCase()}:${job}`;
export function ERC8004Panel({ readOnly, onVerified }: { readOnly: boolean; onVerified: (state: ChainState | null) => void }) {
  const [provider, setProvider] = useState<RpcProvider | null>(null);
  const [account, setAccount] = useState('');
  const [balance, setBalance] = useState('');
  const [manifest, setManifest] = useState<ChainManifest | null>(null);
  const [state, setState] = useState<ChainState | null>(null);
  const [saved, setSaved] = useState<Saved>({});
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const [message, setMessage] = useState('');
  const [managerInput, setManagerInput] = useState('');
  const [hashInput, setHashInput] = useState('');
  const [plan, setPlan] = useState<{ operation: 'deploy' | 'settle'; quote: Awaited<ReturnType<typeof quoteTransaction>> } | null>(null);
  const modal = useRef<HTMLDivElement>(null);
  const update = (value: ChainState | null) => { setState(value); onVerified(value); };
  useEffect(() => {
    const injected = (window as unknown as { ethereum?: RpcProvider }).ethereum;
    if (injected) setProvider(injected.providers?.find(p => p.isMetaMask) || injected);
    const discover = (event: Event) => { const value = (event as CustomEvent).detail; if (value?.info?.rdns === 'io.metamask') setProvider(value.provider); };
    window.addEventListener('eip6963:announceProvider', discover); window.dispatchEvent(new Event('eip6963:requestProvider'));
    return () => window.removeEventListener('eip6963:announceProvider', discover);
  }, []);
  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const response = await fetch(readOnly ? `${import.meta.env.BASE_URL}chain/manifest.json` : '/api/chain/manifest');
        const data = await response.json();
        if (active && data.schema === 'jury-erc8004-manifest-v1') {
          setManifest(data);
          if (data.manager) {
            try { update(await inspectManager(publicProvider, data.manager, data)); }
            catch (err) { if (active) setMessage('鏈上查驗失敗：' + ((err as { shortMessage?: string }).shortMessage || (err as Error).message)); }
          }
        }
      } catch { if (active) setMessage('請重新載入鏈上工作資料'); }
    };
    void load(); const timer = readOnly ? null : setInterval(() => void load(), 5000);
    return () => { active = false; if (timer) clearInterval(timer); };
  }, [readOnly]);
  useEffect(() => {
    if (!provider) return;
    const changed = () => { setAccount(''); setBalance(''); setPlan(null); setSaved({}); };
    provider.on?.('accountsChanged', changed); provider.on?.('chainChanged', changed);
    return () => { provider.removeListener?.('accountsChanged', changed); provider.removeListener?.('chainChanged', changed); };
  }, [provider]);
  useEffect(() => {
    if (!manifest) return;
    const manager = new URLSearchParams(window.location.search).get('manager');
    if (manager) { setManagerInput(manager); void inspectManager(publicProvider, manager, manifest).then(update).catch(() => setMessage('請按查驗，取得此合約的最新鏈上紀錄')); }
  }, [manifest?.jobHash]);
  useEffect(() => {
    if (!plan) return;
    const previous = document.activeElement as HTMLElement;
    const controls = () => Array.from(modal.current?.querySelectorAll<HTMLElement>('button:not(:disabled)') || []);
    controls()[0]?.focus();
    const key = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !busy) setPlan(null);
      if (event.key === 'Tab') {
        const items = controls(), first = items[0], last = items[items.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
      }
    };
    document.addEventListener('keydown', key);
    return () => { document.removeEventListener('keydown', key); previous?.focus(); };
  }, [plan, busy]);
  const run = async (fn: () => Promise<void>) => {
    if (lock.current) return;
    lock.current = true; setBusy(true); setMessage('');
    try { await fn(); }
    catch (error) { setMessage((error as { code?: number }).code === 4001 ? '操作已取消，可隨時重新確認' : ((error as { shortMessage?: string }).shortMessage || (error as Error).message)); }
    finally { lock.current = false; setBusy(false); }
  };
  const persist = (value: Saved) => {
    if (!manifest || !account) throw new Error('請先連接帳戶');
    localStorage.setItem(storageKey(account, manifest.jobHash), JSON.stringify(value)); setSaved(value);
  };
  const connect = () => run(async () => {
    if (!provider) throw new Error('請在已安裝 MetaMask 的 Chrome 開啟此頁');
    if (BigInt(await provider.request({ method: 'eth_chainId' })) !== 16602n) {
      try { await provider.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: '0x40da' }] }); }
      catch (error) {
        if ((error as { code?: number }).code !== 4902) throw error;
        await provider.request({ method: 'wallet_addEthereumChain', params: [{ chainId: '0x40da', chainName: '0G Galileo Testnet', nativeCurrency: { name: '0G', symbol: '0G', decimals: 18 }, rpcUrls: ['https://evmrpc-testnet.0g.ai'], blockExplorerUrls: ['https://chainscan-galileo.0g.ai'] }] });
        await provider.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: '0x40da' }] });
      }
    }
    const accounts = await provider.request({ method: 'eth_requestAccounts' });
    const address = getAddress(accounts[0]); setAccount(address);
    setBalance(formatEther(BigInt(await provider.request({ method: 'eth_getBalance', params: [address, 'latest'] }))));
    if (manifest) {
      const previous = JSON.parse(localStorage.getItem(storageKey(address, manifest.jobHash)) || '{}') as Saved;
      setSaved(previous);
      if (previous.manager) { setManagerInput(previous.manager); update(await inspectManager(provider, previous.manager, manifest)); }
    }
  });
  const prepare = (operation: 'deploy' | 'settle') => run(async () => {
    if (!provider || !account || !manifest) throw new Error('請先連接 MetaMask 並載入工作');
    if (saved.pending) throw new Error('請先查驗既有交易，沿用原本的操作紀錄');
    if (operation === 'deploy' && (saved.manager || state)) throw new Error('請使用現有 Agent 身分完成工作');
    const origin = import.meta.env.PUBLIC_SITE_URL || new URL(import.meta.env.BASE_URL, window.location.href).href;
    if (operation === 'deploy' && new URL(origin, window.location.href).protocol !== 'https:') throw new Error('請透過已發布的 HTTPS 網站建立可攜身分');
    let to: string | undefined, value = 0n, data: string;
    if (operation === 'deploy') data = deploymentData(manifest, origin);
    else {
      if (!state) throw new Error('請先建立或載入 Music Manager');
      const current = await inspectManager(provider, state.manager, manifest);
      if (current.owner.toLowerCase() !== account.toLowerCase()) throw new Error('請切換至控制此 Music Manager 的帳戶');
      if (current.settled) { update(current); setMessage('工作已結算，可直接重播與查驗'); return; }
      to = current.manager; value = BigInt(manifest.totalRewardWei); data = new Interface(manifest.contracts.CareerJury.abi).encodeFunctionData('settle');
    }
    setPlan({ operation, quote: await quoteTransaction(provider, account, data, to, value) });
  });
  const reconcile = async (record: Saved, hash: string) => {
    if (!provider || !manifest) throw new Error('請先連接 MetaMask');
    const mined = await receipt(provider, hash);
    if (!mined) { setMessage('交易確認中，可稍後再次查驗'); return; }
    const transaction = await provider.request({ method: 'eth_getTransactionByHash', params: [hash] });
    const pending = record.pending;
    if (!pending || transaction.from.toLowerCase() !== pending.from.toLowerCase() || transaction.input !== pending.data || BigInt(transaction.value) !== BigInt(pending.value)) throw new Error('請核對此筆交易與原始簽署內容');
    if (pending.to && transaction.to?.toLowerCase() !== pending.to.toLowerCase()) throw new Error('請核對交易的 Music Manager 地址');
    const manager = pending.operation === 'deploy' ? mined.contractAddress : record.manager;
    const verified = await inspectManager(provider, manager, manifest);
    if (verified.owner.toLowerCase() !== pending.from.toLowerCase()) throw new Error('請核對部署控制帳戶');
    const next: Saved = { ...record, manager, pending: undefined, ...(pending.operation === 'deploy' ? { deploymentHash: hash } : { settlementHash: hash }) };
    persist(next); update(verified); setManagerInput(manager); setPlan(null); setHashInput('');
    const url = new URL(window.location.href); url.searchParams.set('manager', manager); window.history.replaceState({}, '', url);
    setBalance(formatEther(BigInt(await provider.request({ method: 'eth_getBalance', params: [account, 'latest'] }))));
    setMessage(verified.settled ? '三筆評價與三筆報酬已由 Galileo 確認' : '三位 Agent ID 已登記，可提交評價與報酬');
  };
  const confirm = () => run(async () => {
    if (!plan || !provider || !account || !manifest) return;
    const accounts = await provider.request({ method: 'eth_accounts' });
    if (accounts[0]?.toLowerCase() !== account.toLowerCase() || BigInt(await provider.request({ method: 'eth_chainId' })) !== 16602n) throw new Error('請重新確認目前帳戶與 Galileo 網路');
    const record: Saved = { ...saved, pending: { operation: plan.operation, data: plan.quote.request.data, to: 'to' in plan.quote.request ? plan.quote.request.to : undefined, value: plan.quote.valueWei, from: account } };
    persist(record);
    let hash: string;
    try { hash = await provider.request({ method: 'eth_sendTransaction', params: [plan.quote.request] }); }
    catch (error) { if ((error as { code?: number }).code === 4001) persist({ ...saved, pending: undefined }); throw error; }
    record.pending!.hash = hash; persist(record); setPlan(null); setMessage('交易已送出，正在查驗 Galileo 收據');
    for (let i = 0; i < 40; i++) {
      const mined = await receipt(provider, hash);
      if (mined) { await reconcile(record, hash); return; }
      await new Promise(resolve => setTimeout(resolve, 3000));
    }
    setMessage('請保留交易 Hash，稍後按查驗繼續');
  });
  const verify = () => run(async () => {
    if (!manifest) throw new Error('請先載入工作資料');
    const verified = await inspectManager(provider || publicProvider, managerInput, manifest); update(verified);
    setMessage('Agent 身分、模型與成果雜湊已核對');
  });
  const exportRecord = () => {
    if (!state) return;
    const blob = new Blob([JSON.stringify({ schema: 'jury-erc8004-record-v1', chainId: 16602, ...state, ...saved }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob), link = document.createElement('a'); link.href = url; link.download = 'music-jury-chain-record.json'; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  return <section className="wallet-panel onchain-panel" id="onchain"><div className="section-heading"><h2><Wallet size={20} /> 0G 鏈上職涯</h2><span className="career-status">ERC-8004 · Galileo</span></div><div className="chain-actions"><button disabled={busy} onClick={connect}>{account ? '更新錢包餘額' : '連接 MetaMask'}</button><button disabled={busy || !account || !manifest || Boolean(state || saved.manager || saved.pending)} onClick={() => void prepare('deploy')}>建立三位 Agent ID</button><button disabled={busy || !account || !state || state.settled || Boolean(saved.pending)} onClick={() => void prepare('settle')}>評價與付款 · 0.003 0G</button></div>{account && <div className="wallet-address"><code>{account}</code><strong>{balance} 0G</strong></div>}{message && <p className="chain-message" role="status">{message}</p>}{saved.pending && <div className="pending-transaction"><strong>查驗簽署進度</strong><input aria-label="交易 Hash" placeholder="貼上 MetaMask 交易 Hash" value={hashInput || saved.pending.hash || ''} onChange={event => setHashInput(event.target.value)} /><button disabled={busy} onClick={() => void run(() => reconcile(saved, hashInput || saved.pending?.hash || ''))}>查驗原交易</button></div>}<details className="chain-lookup"><summary>載入與查驗既有工作</summary><input aria-label="Music Manager 合約地址" placeholder="Music Manager 合約地址" value={managerInput} onChange={event => setManagerInput(event.target.value)} /><button disabled={busy || !manifest} onClick={verify}>查驗鏈上紀錄</button></details>{state && <div className="chain-results"><a href={explorer(state.manager, 'address')} target="_blank" rel="noopener noreferrer">Music Manager <span>{short(state.manager)} <ExternalLink size={13} /></span></a>{state.workers.map(worker => <div className="chain-worker" key={worker.key}><strong>{worker.name} <span>Agent #{worker.agentId}</span></strong><a href={explorer(worker.wallet, 'address')} target="_blank" rel="noopener noreferrer">Agent Wallet {short(worker.wallet)} <ExternalLink size={12} /></a><span className="chain-proof"><Check size={13} />{worker.feedbackVerified ? `Feedback #${worker.feedbackIndex} · Reward 0.001 0G` : '身分與交付版本已核對'}</span></div>)}{saved.deploymentHash && <a href={explorer(saved.deploymentHash)} target="_blank" rel="noopener noreferrer">身分登記交易 <ExternalLink size={13} /></a>}{saved.settlementHash && <a href={explorer(saved.settlementHash)} target="_blank" rel="noopener noreferrer">評價與付款交易 <ExternalLink size={13} /></a>}<button className="export-reviews" onClick={exportRecord}><Download size={15} />匯出鏈上工作紀錄</button></div>}{plan && <div className="dialog-backdrop"><div ref={modal} className="consent-dialog" role="dialog" aria-modal="true" aria-labelledby="chain-plan-title"><h2 id="chain-plan-title">{plan.operation === 'deploy' ? '建立 Music Manager 與三位 Agent' : '提交三筆評價與三筆報酬'}</h2><dl className="transaction-quote"><dt>網路</dt><dd>0G Galileo · 16602</dd><dt>報酬</dt><dd>{formatEther(plan.quote.valueWei)} 0G</dd><dt>Gas 預留</dt><dd>{formatEther(plan.quote.feeWei)} 0G</dd><dt>合計上限估算</dt><dd>{formatEther(plan.quote.totalWei)} 0G</dd></dl><p>請在 MetaMask 核對本次簽署。每次操作上限 0.01 0G；評價與報酬由同一筆交易完成。</p><div className="evidence-actions"><button disabled={busy} onClick={() => setPlan(null)}>返回</button><button disabled={busy} onClick={confirm}>開啟 MetaMask 確認</button></div></div></div>}</section>;
}
