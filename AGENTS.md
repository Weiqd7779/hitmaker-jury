# 0G 專案接入技術規範、元件比較分析與實施議程 (AGENTS.md)

> **事實資料來源**：[0G Integration 互動原型 (繁體中文)](https://0g-integration-tw.vercel.app/#p=A&i=a&d=d&c=a)  
> **基準狀態日**：2026-09-07  
> **深層連結路徑**：`#p=A&i=a&d=d&c=a`

---

## 1. 專案背景與需求畫像 (Profile Analysis)

依據接入路徑問卷的回答分析，本專案的定位與技術路徑如下：

* **Q1：你在做的是什麼？**
  * 選項：`A` —— **一個 AI agent 或 AI 驅動的應用**（聊天機器人、自主 agent、為產品加上 AI 功能）。
  * 目標：建構具備鏈上智慧合約邏輯與鏈下/去中心化 AI 推論能力的 Web3 AI Agent。
* **Q2：你需要 AI 推論（跑模型）嗎？**
  * 選項：`a` —— **需要 —— 走簡單的 HTTPS API**（OpenAI 相容，伺服器端呼叫，不用安裝額外 SDK）。
* **Q3：你的專案需要保存哪類資料？**
  * 選項：`d` —— **不需要儲存**（專案不需要額外上傳巨量不可變檔案或維護專門的鏈下 KV 狀態）。
* **Q4：你會在 0G Chain 上部署智慧合約嗎？**
  * 選項：`a` —— **會**（部署新合約，或遷移現有的 EVM 智慧合約）。
* **評估整體工作量**：**小時級**。

---

## 2. 0G 全元件對比分析 (做專案前的比較依據)

在正式進行專案實作之前，先就 0G 官方目前提供的四大核心元件進行橫向與縱向的深度比較：

### 2.1 四大核心元件綜合比較表

| 項目 | 0G Compute | 0G Storage | 0G Chain | Agentic ID |
| :--- | :--- | :--- | :--- | :--- |
| **當前狀態** | **已上線**（訓練即將推出） | **已上線** | **已上線**（主網自 2025 年 9 月起） | **🔵 測試網**（ERC-8004 已部署） |
| **解決什麼** | 去中心化 GPU 推論與微調；提供 OpenAI 相容 API（Router）或錢包簽章 SDK（Direct） | 巨量不可變檔案（Log 層）+ 可原地更新的鍵值狀態（KV 層） | EVM 相容 L1；次秒級最終性；單分片 11,000 TPS（官方宣稱） | 可獨立驗證的 agent 身分：ERC-7857 加密 iData + TEE 內 AgentSeal 簽章 + 附服務證明的鏈上信譽；ERC-8004 可發現性 |
| **不解決什麼** | 從零開始訓練；模型自動改用備援；供應商側內容稽核紀錄（不留存） | Rollup / 應用鏈的資料可用性（DA） | 非 EVM 虛擬機（在藍圖上）；單純使用 Compute/Storage 並不需要強制依賴 0G Chain | **目前無任何主網部署**；無法防範一人多錢包女巫刷評價；穩定 API（SDK 仍在 0.1.x 階段） |
| **接入方式** | `https://router-api.0g.ai/v1` + `Bearer sk-...`；或 npm `@0gfoundation/0g-compute-ts-sdk` | npm `@0gfoundation/0g-storage-ts-sdk` + ethers；Go 用戶端；CLI；索引器端點 | Hardhat / Foundry / Remix 搭配 RPC；編譯目標需指定 `--evm-version cancun` | npm `@0gfoundation/0g-agenticid-sdk 0.1.2` + viem (Node ≥ 18)；attestor 服務 |
| **工作量預估** | **小時級** (Router) / 約 1 天 (Direct) / 數天 (微調) | **小時級** (檔案) / 約 1 天 (KV) | **小時級** | **約 1 天**（僅測試網） |
| **計費模式** | 依 token 計費，單位為 neuron（$10^{18}$ neuron = 1 0G）；無月費、不加價；微調每百萬 token 0.5 或 4 0G + 儲存預付金 | Gas + 儲存費（只公布計算公式，輸入參數未定義） | 以 0G 支付鏈上 Gas（官方稱僅為主網成本零頭） | 鏈上 gas + 預付 sandbox 餘額 (`ag.deposit()`)；ERC-8004 註冊僅消耗普通 Gas |
| **官方文件入口**| [compute-network/overview](https://docs.0g.ai/developer-hub/building-on-0g/compute-network/overview) | [storage/sdk](https://docs.0g.ai/developer-hub/building-on-0g/storage/sdk) | [deploy-contracts](https://docs.0g.ai/developer-hub/building-on-0g/contracts-on-0g/deploy-contracts) | [0gfoundation/0g-agentic-id](https://github.com/0gfoundation/0g-agentic-id) |

---

### 2.2 關鍵子模組細部比較

#### ① 0G Compute：Router 模式 vs Direct 模式
* **Router 模式（推薦採用）**：
  * **準備工作**：在 [pc.0g.ai](https://pc.0g.ai) 申請一把 `sk-` API Key 並儲值 0G。
  * **計費方式**：單一統一餘額（Unified Balance），免去多方拆分。
  * **通訊標準**：完全相容 OpenAI SDK (`base_url = "https://router-api.0g.ai/v1"`)。
  * **適用場景**：伺服器端應用、AI Agent 後端、原型驗證。
  * **安全強化選項**：支援 `verify_tee: true`（驗證硬體 TEE 推論防偽）、`X-0G-Provider-Trust-Mode: private`（零資料保留 ZDR）、價格上限請求標頭。
* **Direct 模式（暫不採用）**：
  * **準備工作**：安裝專用 SDK，自行管理錢包私鑰，環境需 Node ≥ 22。
  * **計費方式**：需依供應商劃分子帳戶，主帳本最低需 3 0G + 每個供應商 1 0G。
  * **注意限制**：兩個餘額池完全獨立 —— 往 Router 儲值不會給 Direct 子帳戶注資；微調任務僅限 Direct 模式。

#### ② 0G Chain：測試網 (Galileo) vs 主網
* **測試網 (Galileo)**：Chain ID `16602` (`0x40DA`)，RPC `https://evmrpc-testnet.0g.ai`，水龍頭 `https://faucet.0g.ai`（每日 0.1 0G），瀏覽器 `https://chainscan-galileo.0g.ai`。
* **主網**：Chain ID `16661` (`0x4115`)，RPC `https://evmrpc.0g.ai`，瀏覽器 `https://chainscan.0g.ai`，代幣獲取 `https://get.0g.ai`。

#### ③ 0G Storage：Log 層（檔案）vs KV 層（狀態）
* **Log 層**：巨量不可變檔案儲存（模型權重、訓練資料集、媒體），一次寫入多次讀取，產生 Root Hash 索引。
* **KV 層**：可原地更新的鍵值對資料庫，需要額外的 KV 節點 URL。

#### ④ Agent 身分機制：Agentic ID vs ERC-8004 單獨註冊
* **Agentic ID 完整套件**：包含 Intel TDX TEE 沙盒（0g-Tapp）、AgentSeal 簽章與服務證明信譽，但**目前無主網部署**（常數明寫 `testnet-only today`），治理仍為單一 EOA 權限。
* **ERC-8004 註冊表**：已在主網（`16661`）與測試網（`16602`）同步部署，若僅需 Agent 具有鏈上可被發現性與公開評價，直接註冊至 ERC-8004 即可。

---

## 3. 本專案功能選型決策 (用哪些功能 vs 不用哪些功能)

根據前述分析與 `#p=A&i=a&d=d&c=a` 的業務目標，專案功能邊界界定如下：

### ✅ 採用的功能
1. **0G Chain 基礎網路與合約部署 (`chain-setup` & `chain-deploy`)**
   * **原因**：專案需要部署智慧合約（業務邏輯、Agent 控制權限或代幣化機制），0G Chain 為標準 EVM L1，遷移零成本、速度快且 Gas 成本低。
   * **技術規格**：編譯目標設定為 `cancun`，支援 Hardhat / Foundry，利用 `chainscan` API 驗證合約。
2. **0G Compute - Router 模式 (`compute-router`)**
   * **原因**：AI Agent 需要模型推論能力。選擇 Router 模式無需在用戶端管理複雜的私鑰與質押子帳戶，使用一把 `sk-` 金鑰即可透過 OpenAI 相容協議呼叫最新開源模型（如 DeepSeek、GLM、Llama 等）。
   * **特色啟用**：啟用 `verify_tee: true` 確保去中心化推論節點之模型真實性，並可設定 `Allow-Fallbacks: true` 確保容錯移轉。

### ⛔ 不採用的功能與理由
1. **0G Storage (檔案 Log 層 / 鍵值 KV 層)**
   * **不採用理由**：專案目前不需要保存大體積鏈下資料或外部動態 KV 狀態；合約狀態直接存放於 0G Chain 狀態樹中，推論直接走記憶體串接，可避免引入 Storage SDK、節省額外儲存費用及避免維護 KV 節點。
2. **0G Compute Direct 模式 & 模型微調**
   * **不採用理由**：專案目前使用預訓練基礎模型進行推論，暫無自有資料集 LoRA 微調需求；Direct 模式需要管理每個供應商的子帳戶（最低 3+1 0G 鎖定）並要求 Node ≥ 22，複雜度高於架構需求。
3. **Agentic ID 全套 TEE 沙盒驗證系統**
   * **不採用理由**：Agentic ID 目前僅在 Galileo 測試網運行且無主網合約部署，API 處於 0.1.x 變動期，無法作為生產級主網依賴。若專案後續需要讓 Agent 能被發現，可獨立註冊至已在主線上線的 ERC-8004 註冊表。

---

## 4. 專案實施議程與落地步驟 (Action Agenda)

本專案整體工作量為**小時級**，建議依下列三階段循序推展：

```
[Phase 0: 錢包與網路環境配置] (5-10 分鐘)
       │
       ▼
[Phase 1: 0G Chain 智慧合約開發與上鏈] (30-60 分鐘)
       │
       ▼
[Phase 2: 0G Compute Router 推論串接與 TEE 加固] (15-30 分鐘)
       │
       ▼
[Phase 3: 整合測試與端到端聯調] (15-30 分鐘)
```

### Phase 0：錢包與網路環境配置 (小時級 / 5-10 分鐘)
1. 準備 EVM 錢包（MetaMask / OKX / 私鑰帳戶）。
2. 配置網路參數：
   * 測試網：RPC `https://evmrpc-testnet.0g.ai`，Chain ID `16602`。
   * 主網：RPC `https://evmrpc.0g.ai`，Chain ID `16661`。
3. 領取代幣：
   * 測試網至 [faucet.0g.ai](https://faucet.0g.ai) 領取每日 0.1 0G 測試幣。
   * 主網透過交易所或跨鏈橋 [get.0g.ai](https://get.0g.ai) 取得 0G 原生 Gas 代幣。

### Phase 1：0G Chain 智慧合約開發與部署 (小時級)
1. 建立合約工程（Hardhat 或 Foundry）。
2. **關鍵設定**：在編譯設定中明確宣告 EVM 版本為 `cancun`：
   ```javascript
   // hardhat.config.js
   module.exports = {
     solidity: {
       version: "0.8.20",
       settings: { evmVersion: "cancun" }
     },
     networks: {
       galileo: {
         url: "https://evmrpc-testnet.0g.ai",
         chainId: 16602,
         accounts: [process.env.PRIVATE_KEY]
       },
       mainnet: {
         url: "https://evmrpc.0g.ai",
         chainId: 16661,
         accounts: [process.env.PRIVATE_KEY]
       }
     }
   };
   ```
3. 執行部署指令：
   ```bash
   npx hardhat run scripts/deploy.js --network galileo
   ```
4. 使用 `@nomicfoundation/hardhat-verify` 配合區塊瀏覽器 API 進行鏈上源碼開源驗證。

### Phase 2：0G Compute Router 整合 (小時級 / 15-30 分鐘)
1. 登入 [pc.0g.ai](https://pc.0g.ai) 建立 `sk-` API Key 並使用 0G 代幣完成帳戶餘額儲值（妥善保存 Key，只展示一次）。
2. 在後端環境中直接以現有 OpenAI SDK 串接：
   ```typescript
   import OpenAI from "openai";

   const client = new OpenAI({
     baseURL: "https://router-api.0g.ai/v1",
     apiKey: process.env.ZG_ROUTER_API_KEY // sk-...
   });

   async function runAgentInference(prompt: string) {
     const response = await client.chat.completions.create({
       model: "zai-org/GLM-5-FP8", // 可由 GET /v1/models 獲取最新模型清單
       messages: [{ role: "user", content: prompt }],
       // 0G 特色擴充標頭與安全參數：
       // verify_tee: true (若需要可信硬體證明)
     });
     return response.choices[0].message.content;
   }
   ```
3. 透過 `GET https://router-api.0g.ai/v1/models`（無需驗證）即時獲取網路中線上 GPU 節點支援的模型清單。

### Phase 3：系統整合與安全上線
1. 將智慧合約位址與 Router 推論邏輯串接於 Agent 核心業務循環中。
2. 針對生產環境將 RPC 切換為高可用第三方供應商（如 QuickNode / ThirdWeb / Ankr / dRPC）。

---

## 5. 文件記載之核心避坑指南 (Critical Pitfalls)

在實作開發過程中，務必遵循官方文件記載的以下關鍵避坑點：

| 類別 | 已知的坑 (Issue / Bug) | 解決方案與最佳實踐 |
| :--- | :--- | :--- |
| **0G Chain** | 部署合約時回報 `invalid opcode` | 編譯時必須明確指定 `--evm-version cancun`，或將 Solidity 編譯器降級至 `0.8.19`。 |
| **0G Chain** | 測試網 RPC 回傳 `tip cap below minimum 2 gwei` | 測試網 RPC 的 `eth_maxPriorityFeePerGas` 預設回傳 1 wei，會被 mempool 攔截；使用 Foundry/cast 必須**手動寫死 gas price (≥ 2 gwei)**；viem/Hardhat 需注意手動估算。 |
| **0G Chain** | 測試網 RPC 不穩定 / 交易收據 404 | 公共測試網 RPC 僅供開發；正式環境應切換第三方 RPC；合約交易收據查詢建議設定適當重試與延長逾時時間。 |
| **0G Compute** | `sk-` 金鑰呼叫 `/v1/account/*` 回傳 403 | `sk-` 僅供伺服器端推論；管理帳戶餘額或子帳戶必須改用 `mk-` 管理金鑰。 |
| **0G Compute** | 指定單一供應商導致請求失敗 | 指定固定供應商時會預設靜默關閉容錯，需在請求標頭加上 `Allow-Fallbacks: true`。 |
| **0G Compute** | 圖像生成輪詢扣費問題 | 圖像生成必須指定 `response_format: "b64_json"`；中途放棄輪詢仍會計費。 |
| **0G Compute** | 速率限制（Rate Limits） | Router 門檻未公布具體上限，請嚴格遵守回傳的 `Retry-After` 標頭以進行退避重試。 |

---

## 6. 核心端點與官方資源索引

* **0G Compute Router**：`https://router-api.0g.ai/v1`（已實測模型目錄 GET /v1/models 正常回應）
* **0G Private Computer (金鑰與儲值)**：[pc.0g.ai](https://pc.0g.ai)
* **0G Galileo 測試網 RPC**：`https://evmrpc-testnet.0g.ai` (Chain ID: `16602` / `0x40da`，已實測即時區塊高度突破 5,350 萬)
* **0G 主網 RPC**：`https://evmrpc.0g.ai` (Chain ID: `16661`)
* **ERC-8004 Galileo 測試網合約**：
  * Identity 註冊表：`0x8004A818BFB912233c491871b3d84c89A494BD9e`（已實測字節碼存在）
  * Reputation 聲譽：`0x8004B663056A597Dffe9eCcC1965A193B7388713`（已實測字節碼存在）
* **測試網水龍頭**：[faucet.0g.ai](https://faucet.0g.ai)
* **區塊瀏覽器**：[chainscan-galileo.0g.ai](https://chainscan-galileo.0g.ai)（測試網）/ [chainscan.0g.ai](https://chainscan.0g.ai)（主網）
* **0G 官方文檔中心**：[docs.0g.ai](https://docs.0g.ai)
* **0G 開發者問答機器人**：[build.0g.ai/ask](https://build.0g.ai/ask)

### 7. 0G 原生連通性即時檢測指南 (Zero-Mock Verification)
可在專案根目錄下直接執行以下指令進行真實連線檢測：
```bash
# 1. 檢驗 0G Galileo 測試網 RPC 連線與最新區塊高度
node -e "fetch('https://evmrpc-testnet.0g.ai', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({jsonrpc:'2.0', method:'eth_blockNumber', params:[], id:1})}).then(r=>r.json()).then(d=>console.log('0G Testnet Block:', parseInt(d.result, 16)))"

# 2. 檢驗 0G Compute Router 線上模型服務狀態
node -e "fetch('https://router-api.0g.ai/v1/models').then(r=>r.json()).then(d=>console.log('0G Router Online Models:', d.data.map(m=>m.id)))"

# 3. 檢驗 ERC-8004 測試網鏈上合約
node -e "fetch('https://evmrpc-testnet.0g.ai', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({jsonrpc:'2.0', method:'eth_getCode', params:['0x8004A818BFB912233c491871b3d84c89A494BD9e', 'latest'], id:1})}).then(r=>r.json()).then(d=>console.log('ERC-8004 Contract Exists:', d.result.length > 2))"
```

## 8. Career v3 實作決策與驗證方式（2026-09-09）

本節為使用者討論後的新決策，優先於前文舊 PoC 的「不使用 Storage／Agentic ID」選型。

- 保留音樂評審展示：固定 15 秒合成小星星、預先準備的公開分析資料，文字模型不宣稱直接聽音訊。三位錄取 Worker 全部要求真實整合；第四位候選、Manager 選人及接受成果為明確標示的展示腳本。平台不評估評論品質。
- 先完成一位主角的模型 A 真實種子工作，再讓三位 Worker 使用模型 B。主角必須維持同一 Agent ID。此處的版本指「此次工作的推論模型」，不代表 sealed framework 自身的控制模型或完整能力快照。提示詞／工具／資料的完整版本化是未來展望。
- 第一階段公開非敏感成果，機密試工與端到端硬體 attestation 為後續階段。服務簽章、Compute provider 回應簽章與硬體 attestation 不得混稱。
- 前端入口為 `src/PresentationApp.tsx`，預設為免錢包簡報；`?mode=chain` 才進入 `src/CareerApp.tsx` 的鏈上工作台。舊 `src/App.tsx` 與展示用 proof 元件保留但不再進入應用程式入口。禁止重新接回舊版隨機 proof、假 SETTLED 或前端 Router Key 邏輯。
- 開發環境 Node >= 24（使用內建 `node:sqlite`）。`npm run dev` 同時啟動 Vite 5173 與本機 API 3001；`npm run server` 可獨立啟動 API。`npm run preview` 仍需另啟 API。
- 驗證命令：`npm test`、`npm run build`、`git diff --check`。測試中的假 RPC／簽章 fixture 僅用於測試，不會載入 Demo。`npm run verify:career -- evidence.json` 使用匯出的單筆證據包直接查鏈與 Storage，不讀取平台資料庫。
- 金鑰只放伺服器／sealed runtime 環境變數；Vite 只暴露 `PUBLIC_` 前綴。不要讀取、顯示或提交 `.env`。新設定範本在 `.env.example`。使用者已同意沿用現有 `VITE_ZG_ROUTER_API_KEY`：伺服器優先讀取 `ZG_ROUTER_API_KEY`，未設定時讀取舊欄位，僅於伺服器端使用，不複製或輸出內容。Agent runtime 同樣支援此相容欄位，最後才使用其 `OPENAI_API_KEY`。後續已在此 Key 對應的測試網 Router 完成三次真實推論，詳見 8.2；不得把測試網 Key 誤送到主網 Router。
- 真實執行前需在 `.env` 安全配置 `CAREER_MANAGER_PRIVATE_KEY`、三位角色的 `CAREER_<ROLE>_AGENT_ID` 與 `CAREER_<ROLE>_URL`（HTTPS origin），並明確設定 `CAREER_ENABLE_TRANSACTIONS=1`。角色鍵為 PROFESSOR、ANTISOCIAL、NEARMISS。Manager 不得為 Worker owner／approved operator。
- API 只監聽 loopback，限制 Host／Origin，寫入需要 CSRF token 及 UI 的明確支出確認。此版本是本機展示服務，不可直接暴露為公開多租戶服務。
- 每筆 canonical feedback、proof attestation、Worker 付款都先持久化已簽署交易，才廣播。重試只重送同一 raw transaction。不可刪除 `.career-local/` 來重置失敗交易；必須先查鏈。工作同時只執行一筆，Manager 錢包不應由其他程序同時使用。
- Storage 先保存預期 rootHash 與嘗試狀態，上傳中斷後僅重查同一 rootHash；若無法確認，不自動再次付費上傳。成果取回、feedback、attestation、付款全數核對後才增加 completed work 計數。
- 歷史驗證使用紀錄的歷史區塊與鏈上 feedback 驗證事件，不把 proof 今日過期當成工作造假。需要 RPC archive state 及 Storage 可用性，不保證完全離線或永久資料可用。Compute 保存原始簽署文字及簽章，驗證時重查歷史 provider signer。
- 固定 Galileo Agentic ID：`0x34493302287308f565CF3409DAAdEDF4C8895648`；VerifiedFeedbackRegistry：`0xc0c902666078774435429d1fdeb5b1b17d95d583`（唯讀查到 1.1.0）；canonical Reputation：`0x8004B663056A597Dffe9eCcC1965A193B7388713`。它們不是應用程式自建 Jury Dispatcher。
- 簡報推論沿用原有測試網 Router（見 8.2）。鏈上工作台的獨立 Compute 驗證器目前仍固定主網合約與 RPC，不能拿測試網 provider 資料套用；其真實聯調仍待完成。不能把 Compute 計費宣稱為 Worker 報酬，也不能混淆 Router 儲值與錢包 Gas 餘額。
- `agent/review-service.mjs` 是待安裝到三個 sealed Agent 的 loopback 服務，不是在一般本機 Node 執行就有 TEE。它透過 `$SEAL_SIGN_SOCK/services` 註冊 `/api/review`，不自行簽造 X-Agent-Proof。需設定 `JURY_WORKER_KEY`、`JURY_MANAGER_ADDRESS`、`JURY_ALLOWED_MODELS`、`ZG_ROUTER_API_KEY`（或 runtime 的 `OPENAI_API_KEY`），由 runtime 提供 `AGENT_SEAL` 與 `SEAL_SIGN_SOCK`。執行 `node agent/review-service.mjs`。程式和 `JURY_CACHE_DIR` 必須部署於框架允許的持久化路徑，並在 runtime 重啟時重新啟動／註冊。請勿覆蓋現有 Agent 的其他服務。
- Agent 只接受 Manager 對固定任務的簽章授權，使用兩個允許的工作模型；同一 task 的結果快取避免重試時重複推論。不接受任意 prompt、任意 URL、任意簽章或交易代理服務。
- 已完成三次帶金鑰的 Router 評論推論，但尚未完成三個真實 sealed runtime 的部署、Storage 上傳、feedback 或付款實測。部署、儲值、付費推論與鏈上交易需對具體操作取得使用者確認後才執行。
- Storage SDK 固定 `1.2.11`，其 peer dependency 要求 ethers `6.13.1`。`npm audit` 仍有上游已知弱點；不可用 `--force`、略過 peer 檢查或放寬安全政策掩蓋。正式上線前必須處理／重新評估。完整 Compute SDK 已移除，Compute 驗證使用唯讀合約 ABI 與 ethers。

### 8.1 反覆排練與真實配置保護

- 使用者要求由開發代理自行驗證排版與 console，不能把驗證交給使用者。`npm run test:browser` 使用已安裝 Chrome 與 Playwright，覆蓋 1440／834／390／320px、音訊播放、抽屜、版本篩選、支出取消與每種尺寸三次唯讀重播。截圖保存於命令輸出的暫存目錄；瀏覽器專用 fixture 不寫入平台資料庫、不呼叫真實 Agent 或交易 API。`npm run test:browser -- --headed --live-only` 會開啟可見的 Chrome，只操作真實頁面、不攔截或模擬 API，完整播放音樂並檢查三位角色；若工作按鈕受配置限制，報告明確列出 fullWorkflow blocked，不當作端到端成功。
- `npm run preflight:agents` 只檢查指定配置是否存在、公鑰地址、鏈上餘額、Agent 身分與 sandbox 報價，不輸出金鑰、不部署、不花費。不在對話中貼入 Owner／Manager 私鑰或 Router Key。
- 真實 Agent 應部署一次並保存 agentId／sealId；暫停使用 stop，恢復使用 start；不要為了重新排練而 reset、重新 mint 或刪除履歷。停止 runtime 不會取消歷史鏈上紀錄。實際停止後的計費狀態仍須查 provider。
- 工作建立請求使用持久 requestId 去重，瀏覽器 sessionStorage 保留尚未確定的建立意圖；重送不產生新工作。預設 `CAREER_MAX_LIVE_JOBS=1`，已有的一場三人工作可唯讀重播；新增真實工作需明確提高有限次數上限（1～10）並重新確認支出。次數上限不是 sandbox 持續租用費或 Router 帳戶的總金額上限。
- 工作固定 Manager、Worker ID、端點與角色設定摘要；更换帳戶／身分／端點後禁止接續舊工作。資料庫預設路徑錨定專案，不隨 cwd 變動。已簽署交易不可覆寫，已確認狀態不可回退。第二個 API 實例必須先取得監聽埠，才可處理重啟恢復。
- Worker 以 jobId＋角色＋Manager＋AgentSeal 識別同一任務，原子建立推論 claim 並保存 requestHash。同一 job 改模型／內容不能藉由不同 body hash 再扣一次。推論結果未保存就失敗／重啟時，保留未知狀態並回報 409，不自動重送付費推論。
- Manager 在發出推論前保存嘗試與原始請求；恢復只允許讀取 Worker 已有快取（X-Jury-Cache-Only），即使容器快取遺失也不自動重新花錢。`JURY_CACHE_DIR` 必須明確指定已驗證持久化的絕對路徑。不能保證跨外部供應商的任意故障都可完全自動恢復；未知狀態需先查帳與既有回應，禁止以清除 claim／資料庫掩蓋。
- 2026-09-09 唯讀查得 sandbox 建立費每個 0.06 Galileo 0G；每 CPU 每分鐘 0.001、每 GB RAM 每分鐘 0.0005。若每個配置 2 CPU／4 GB，三個建立費合計 0.18、持續運行合計 0.012 0G／分鐘，另計 mint／同步 Gas、Storage、Worker 報酬與 Router 推論。部署前應重新查價，不將此數字當成總費用保證。

### 8.2 可播放簡報、真實推論與只讀部署

- 使用者的總預算為約 5 Galileo 0G，測試盡量控制在 0.01 0G 以下，不得自動反覆儲值、部署、轉帳。sandbox 固定建立費並非可任意調小的轉帳金額。
- 現有 `VITE_ZG_ROUTER_URL` 指向 `https://router-api-testnet.integratenetwork.work/v1`，可用聊天模型為 `qwen2.5-omni`（TeeTLS）。`server/presentation.mjs` 讓舊 Key 與舊 URL 成對使用；若設定新 `ZG_ROUTER_API_KEY`，則只使用對應 `ZG_ROUTER_URL` 或官方預設，避免跨環境誤送 Key。
- 已真實取得三位評論：Professor Request ID `43e9c1e0-e9bc-4dfe-a37e-39f556c3dc1f`、Anti-Social `e199da9a-66c4-49f4-b227-61240596bd19`、Near-Miss `903be06c-deaf-4f2b-886d-c650a3ab9c19`。Router 回報費用分別為 0.00062093、0.00049571、0.00065431 0G，合計 0.00177095；不得將此敘述為已驗證的 Worker 鏈上付款。
- 真實結果保存在既有 SQLite 的獨立 presentation 表，不寫入鏈上 career jobs。首次建立批次使用原子 INSERT 去重，最多三次請求，每次 400 輸出 tokens；送出前按公開 neuron 定價保守估算 ≤0.01 0G，並附 USD 單價上限標頭。任何錯誤／不明結果都停止，不能刪除紀錄後偷偷重試。若要重新生成，必須另獲明確支出授權與恢復設計。
- 預設簡報有九幕：發布、應徵、舊履歷示例、錄取、播放、評論、接受、模擬付款、展示履歷成長。來源可選保存的真實 AI 回應或清楚標示的範例；模擬資料不能進入 Verified Work 計數，不生成假 tx hash、rootHash 或 AgentSeal。
- `npm run test:presentation -- --headed` 使用可見 Chrome 測試目前已保存的真實資料、完整九幕、下載、手機抽屜和兩次無新增請求的重播。不加 `--allow-paid` 不會取得新評論。`--allow-paid` 只限明確授權的首次取得；已有保存紀錄時仍不會再付費。這不是三個真實 sealed Agent 的鏈上端到端測試。
- MetaMask 元件可連接／切換 Galileo、查餘額、完成兩分鐘有效的一次性 personal_sign challenge。此簽署只證明帳戶控制權，不授權支付，也不是 Agent 部署流程。仍需實作／聯調正式的瀏覽器部署與交易簽署入口；不能因使用者裝好 MetaMask 就宣稱已具備伺服器簽署帳戶。
- `npm run build:demo` 產生 `dist-demo/`：只有編譯過的只讀前端、三份公開回應 JSON 與自行合成音樂，不含 API Key、私鑰、資料庫或後端，不複製舊 public 目錄裡的其他音樂。必須已有三份真實評論才可建置。公開版不呼叫付費 API，錢包只可連接／查餘額。
- `npm run preview:demo` 在 4174 啟動只讀產物。以 `CAREER_BROWSER_URL=http://127.0.0.1:4174` 搭配 `npm run test:presentation -- --headed --static` 驗證部署產物；`--static` 從 presentation.json 讀取，不依賴本機 API。
- 公開託管目前選擇準備 Vercel 靜態部署，但 CLI 登入失效，已請使用者執行 `vercel login`；未登入前不可宣稱已有公開服務網址。只部署 dist-demo，不要上傳根目錄或任何秘密檔案。完整後端與鏈上部署仍是另外的待辦，不得被只讀網站部署掩蓋。
