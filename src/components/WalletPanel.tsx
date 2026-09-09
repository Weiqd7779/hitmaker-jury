import { useEffect, useState } from 'react';
import { Wallet, ShieldCheck } from 'lucide-react';
import { api } from '../services/career';

type Provider = { isMetaMask?: boolean; providers?: Provider[]; request: (input: { method: string; params?: unknown[] }) => Promise<unknown>; on?: (name: string, fn: (...args: unknown[]) => void) => void; removeListener?: (name: string, fn: (...args: unknown[]) => void) => void };
function ether(hex: string) { const value = BigInt(hex); return `${value / 10n ** 18n}.${(value % (10n ** 18n)).toString().padStart(18, '0').slice(0, 6)}`.replace(/0+$/, '').replace(/\.$/, ''); }
export function WalletPanel({ token, readOnly = false }: { token: string; readOnly?: boolean }) {
  const [provider, setProvider] = useState<Provider | null>(null);
  const [address, setAddress] = useState('');
  const [balance, setBalance] = useState('');
  const [verified, setVerified] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    const injected = (window as unknown as { ethereum?: Provider }).ethereum;
    const selected = injected?.providers?.find(item => item.isMetaMask) || injected;
    if (selected) setProvider(selected);
    const discover = (event: Event) => {
      const detail = (event as CustomEvent<{ info: { rdns: string }; provider: Provider }>).detail;
      if (detail?.info?.rdns === 'io.metamask') setProvider(detail.provider);
    };
    window.addEventListener('eip6963:announceProvider', discover); window.dispatchEvent(new Event('eip6963:requestProvider'));
    return () => window.removeEventListener('eip6963:announceProvider', discover);
  }, []);
  useEffect(() => {
    if (!provider) return;
    const clear = () => { setAddress(''); setBalance(''); setVerified(false); };
    provider.on?.('accountsChanged', clear); provider.on?.('chainChanged', clear); provider.on?.('disconnect', clear);
    return () => { provider.removeListener?.('accountsChanged', clear); provider.removeListener?.('chainChanged', clear); provider.removeListener?.('disconnect', clear); };
  }, [provider]);
  const connect = async () => {
    if (!provider) { setError('請在你已安裝 MetaMask 的 Chrome 開啟這個網站；不需要提供私鑰。'); return; }
    setBusy(true); setError(''); setVerified(false);
    try {
      if (await provider.request({ method: 'eth_chainId' }) !== '0x40da') {
        try { await provider.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: '0x40da' }] }); }
        catch (e) {
          if ((e as { code?: number }).code !== 4902) throw e;
          await provider.request({ method: 'wallet_addEthereumChain', params: [{ chainId: '0x40da', chainName: '0G Galileo Testnet', nativeCurrency: { name: '0G', symbol: '0G', decimals: 18 }, rpcUrls: ['https://evmrpc-testnet.0g.ai'], blockExplorerUrls: ['https://chainscan-galileo.0g.ai'] }] });
          await provider.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: '0x40da' }] });
        }
      }
      const accounts = await provider.request({ method: 'eth_requestAccounts' }) as string[];
      if (!accounts[0] || await provider.request({ method: 'eth_chainId' }) !== '0x40da') throw new Error('請選擇 Galileo 帳戶');
      const funds = await provider.request({ method: 'eth_getBalance', params: [accounts[0], 'latest'] }) as string;
      setAddress(accounts[0]); setBalance(ether(funds));
    } catch (e) { setError((e as { code?: number }).code === 4001 ? '你已取消錢包操作，沒有交易或費用。' : '無法連接 Galileo，請在 MetaMask 確認帳戶與網路。'); }
    finally { setBusy(false); }
  };
  const sign = async () => {
    if (!provider || !address) return;
    setBusy(true); setError(''); setVerified(false);
    try {
      if (await provider.request({ method: 'eth_chainId' }) !== '0x40da') throw new Error('請先重新連接 Galileo');
      const challenge = await api<{ id: string; message: string }>('/api/wallet/challenge', token, { address, chainId: 16602 });
      const hex = `0x${Array.from(new TextEncoder().encode(challenge.message), b => b.toString(16).padStart(2, '0')).join('')}`;
      const signature = await provider.request({ method: 'personal_sign', params: [hex, address] });
      const result = await api<{ verified: boolean; address: string }>('/api/wallet/verify', token, { id: challenge.id, signature });
      const accounts = await provider.request({ method: 'eth_accounts' }) as string[];
      setVerified(result.verified && accounts[0]?.toLowerCase() === result.address.toLowerCase() && await provider.request({ method: 'eth_chainId' }) === '0x40da');
    } catch { setError('簽署未完成或已取消，沒有發送交易。'); } finally { setBusy(false); }
  };
  return <section className="wallet-panel"><div className="section-heading"><h2><Wallet size={18} /> MetaMask · 小額預算</h2><span className="career-status">總預算 5 測試網 0G</span></div><p>{readOnly ? '線上只讀版僅連接錢包與查看餘額，不提供簽署或交易入口。簡報不需要連錢包。' : '連接和文字簽署不花 Gas，也不授權轉帳。簡報模式不需要先連錢包。'}</p><div className="evidence-actions"><button disabled={busy} onClick={() => void connect()}>{address ? '重新讀取餘額' : '連接 MetaMask'}</button>{address && !readOnly && <button disabled={busy || !token} onClick={() => void sign()}>測試錢包簽署（不花 Gas）</button>}</div>{address && <div className="wallet-address"><code>{address}</code><strong>{balance} 0G · Galileo</strong></div>}{verified && <p className="wallet-verified"><ShieldCheck size={16} />錢包簽署已核對，尚未發送鏈上交易。</p>}{error && <p role="alert" className="wallet-error">{error}</p>}<details><summary>部署費用與尚未完成的鏈上步驟</summary><p>最近查到 sandbox 每個建立費 0.06，三個合計 0.18 0G。以每個 2 CPU／4 GB 計，三個運行費合計約 0.012 0G／分鐘，其他費用另計；部署前需重新報價。</p><p>目前只提供連接與簽署測試。Agent 部署、Owner／Manager 角色綁定和工作付款仍未執行；不把示範付款當成真實交易。</p></details></section>;
}
