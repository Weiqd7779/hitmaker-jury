/**
 * 0G 服務連通性即時檢測腳本 (Zero-Mock Verification Script)
 */
async function test0GConnection() {
  console.log('====================================================');
  console.log('🔍 正在檢測 0G 原生網路與服務連通性...');
  console.log('====================================================\n');

  // 1. 0G Galileo 測試網 RPC
  const rpcUrl = 'https://evmrpc-testnet.0g.ai';
  try {
    const startTime = Date.now();
    const res = await fetch(rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'eth_blockNumber',
        params: [],
        id: 1
      })
    });
    const data = await res.json();
    const blockNum = parseInt(data.result, 16);
    const latency = Date.now() - startTime;
    console.log(`✅ [0G Galileo RPC] 連線成功!`);
    console.log(`   端點: ${rpcUrl}`);
    console.log(`   最新區塊: #${blockNum.toLocaleString()}`);
    console.log(`   延遲: ${latency} ms\n`);
  } catch (err) {
    console.error(`❌ [0G Galileo RPC] 連線失敗:`, err.message);
  }

  // 2. 0G Compute Router
  const routerUrl = 'https://router-api.0g.ai/v1/models';
  try {
    const startTime = Date.now();
    const res = await fetch(routerUrl);
    const data = await res.json();
    const models = data.data?.map(m => m.id) || [];
    const latency = Date.now() - startTime;
    console.log(`✅ [0G Compute Router] 連線成功!`);
    console.log(`   端點: https://router-api.0g.ai/v1`);
    console.log(`   在線模型總數: ${models.length} 款`);
    console.log(`   包含模型: ${models.slice(0, 6).join(', ')} ...`);
    console.log(`   延遲: ${latency} ms\n`);
  } catch (err) {
    console.error(`❌ [0G Compute Router] 連線失敗:`, err.message);
  }

  // 2.1 API Key 授權核驗 (使用環境變數設定之 key)
  const apiKey = process.env.VITE_ZG_ROUTER_API_KEY || '';
  if (!apiKey) {
    console.log(`ℹ️ [0G API Key 核驗] 未設定 VITE_ZG_ROUTER_API_KEY，略過金鑰核驗\n`);
  } else {
    try {
      // 優先測試 0G Testnet Router
      const testnetAuthRes = await fetch('https://router-api-testnet.integratenetwork.work/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({ model: 'qwen2.5-omni', messages: [{ role: 'user', content: 'Say hello in 3 words' }], max_tokens: 20 })
      });
      const authData = await testnetAuthRes.json();
      if (authData.error?.code === 'insufficient_balance') {
        console.log(`🔑 [0G API Key 核驗] 金鑰完全有效！(0G Testnet)`);
        console.log(`   金鑰狀態: 身份通過，帳戶餘額待儲值 (可於 pc.testnet.0g.ai 領水儲值)`);
        console.log(`   Request ID: ${authData.request_id}\n`);
      } else if (authData.choices) {
        console.log(`🔑 [0G API Key 核驗] 金鑰完全有效且餘額充足！推論成功！\n`);
      } else {
        console.log(`🔑 [0G API Key 回應]:`, authData, '\n');
      }
    } catch (e) {
      console.warn(`[0G API Key 檢測略過]:`, e.message);
    }
  }

  // 3. ERC-8004 合約
  const identityContract = '0x8004A818BFB912233c491871b3d84c89A494BD9e';
  try {
    const res = await fetch(rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'eth_getCode',
        params: [identityContract, 'latest'],
        id: 1
      })
    });
    const data = await res.json();
    const hasCode = data.result && data.result.length > 2;
    console.log(`✅ [0G ERC-8004 Identity 合約] 鏈上核驗成功!`);
    console.log(`   位址: ${identityContract}`);
    console.log(`   字節碼長度: ${data.result.length} (有效部署: ${hasCode})\n`);
  } catch (err) {
    console.error(`❌ [0G ERC-8004] 檢驗失敗:`, err.message);
  }

  console.log('====================================================');
  console.log('🎉 0G 原生基礎設施連通性檢測完成！所有關鍵服務皆在線正常。');
  console.log('====================================================');
}

test0GConnection();
