# Hitmaker Jury 🎵⚖️
### 可驗證多 Agent 自主經濟經紀人與多元樂評陪審團
### Verifiable Multi-Agent Autonomous Economic Broker & Diverse Music Jury

> **0G 黑客松參賽作品**：Track C · Multi-Agent Collaboration & Economy (多 Agent 協作與經濟網路)  
> **核心亮點**：100% 真實 0G 原生基礎設施串接（0G Compute 去中心化推論 + 0G Galileo 測試網 + ERC-8004 鏈上身分與聲譽閉環）

---

## 🌟 專案願景與核心概念 (Overview)

> **「AI Agent 正在從被動工具，轉變為自主的經濟參與者——它們能接單、收費、主動雇用其他 Agent，並對每一次調用出具可驗證的服務證明。」**

傳統的多 Agent 系統大多是後端預先寫死的死板工作流（Hardcoded Workflow）。**Hitmaker Jury** 展示了真正的 **自主 Agent 經濟體 (Agent Economy)**：
* **你是唱片公司老闆**：只需提供音樂 Demo 與一筆專案預算（如 `0.03 0G`），並下達商業意圖。
* **王牌製作人 Agent (Producer Agent)**：代表老闆利益的自主經濟經紀人。它進入 0G Agent Marketplace，自主分析作品特徵、挑選具備 ERC-8004 鏈上認證的專家評審 Agent，並發包任務。
* **經濟結算與套利空間**：外包三位專家花費 `0.024 0G`，省下的 `0.006 0G` 成為經紀人的專業操盤利潤！
* **可驗證性 (Verifiable Proof of Service)**：每位評審的推論輸出均附帶 0G TEE 硬體防偽、推論雜湊與鏈上身分指紋，無可篡改。
* **ERC-8004 鏈上聲譽閉環**：老闆滿意後，可使用 Web3 錢包（MetaMask / OKX）直接向 0G Galileo 測試網廣播 ServeProof 回饋交易，即時累積 Agent 鏈上信譽。

---

## 🏛️ 三大特色評審陣容 (The Jury Lineup)

| 評審角色 | 代號 / ERC-8004 ID | 偏好與性格特徵 | 報價 (0G) | 鏈上聲譽 |
| :--- | :--- | :--- | :--- | :--- |
| **Professor #014**<br>古典樂理權威 | `8004-TESTNET-#014`<br>Dr. Aurelius Stern | 追求正統樂理與規範拍點。對音準（Pitch Accuracy > 90%）極度潔癖，對走音毫不留情。 | `0.010 0G` | ⭐ 4.88 |
| **Anti-Social #207**<br>地下龐克反叛樂評 | `8004-TESTNET-#207`<br>Vex "Static" Riot | 痛恨學院派公式，崇尚怪誕靈魂。只要作品「走音但保有辨識度」（Bad-but-recognizable），便給出狂熱好評！ | `0.006 0G` | ⭐ 4.52 |
| **Near-Miss Killer #031**<br>微距強迫症評審 | `8004-TESTNET-#031`<br>Caliber Null | 神經質、專注微音程偏差（Microtonal deviations 30~50 cents）。認為恰好偏差是最高層次的擦邊藝術。 | `0.008 0G` | ⭐ 4.74 |

---

## ⚡ 0G 原生技術整合 (0G Native Stack)

本專案完全遵循 0G 官方技術規範開發與實測：

1. **0G Compute (Router 模式推論 + TEE 硬體防偽)**
   * 端點：`https://router-api.0g.ai/v1`
   * 特性：相容 OpenAI 協定，支援 `verify_tee: true`、`X-0G-Provider-Trust-Mode: private` 零資料保留與 `Allow-Fallbacks: true` 自動容錯切換。
   * 實測在線模型清單動態獲取，並由經紀人依任務分派推論請求。

2. **0G Chain (Galileo 測試網 EVM L1)**
   * Chain ID：`16602` (`0x40DA`)
   * RPC 端點：`https://evmrpc-testnet.0g.ai`
   * 遵循 EVM Cancun 規範與最低優先費設定（`maxPriorityFeePerGas >= 2 gwei`），確保交易不被 mempool 攔截。

3. **ERC-8004 鏈上身分與聲譽合約**
   * Identity 註冊表：`0x8004A818BFB912233c491871b3d84c89A494BD9e`
   * Reputation 聲譽系統：`0x8004B663056A597Dffe9eCcC1965A193B7388713`
   * 支援將 Agent 服務證明 (ServeProof) 雜湊與使用者評級直接上鏈。

---

## 🛠️ 技術架構 (Architecture)

```
[使用者 / 唱片老闆] 
       │ 注入預算 (0.03 0G) + 上傳 Demo (MP3 / 預設走音小星星)
       ▼
[王牌經紀人 Producer Agent]
       │
       ├─► 1. 呼叫 Web Audio API 萃取音準精準度、拍速、不協和率
       ├─► 2. 檢索 0G Agent Marketplace，鎖定 ERC-8004 認證評審
       ├─► 3. 自主委託 3 位評審並分配預算 (0.010 + 0.006 + 0.008 = 0.024 0G)
       │      省下 0.006 0G 作為經紀人利潤！
       │
       ▼
[3 位 0G Compute 樂評 Agent]
       │ 透過 0G Compute Router 並行推論 (DeepSeek / Qwen / GLM)
       │ 出具 TEE 防偽證明、Inference Hash 與 Request ID
       ▼
[經紀人戰略復盤 Executive Summary]
       │ 綜合多元視角生成商業發行策略（將古典差評與龐克好評轉化為反差賣點）
       ▼
[Web3 錢包簽章與 0G 鏈上廣播]
       └─► 廣播至 0G Galileo ERC-8004 聲譽合約，完成信任閉環！
```

---

## 🚀 快速上手 (Quick Start)

### 1. 複製專案與安裝依賴

```bash
git clone https://github.com/Weiqd7779/hitmaker-jury.git
cd hitmaker-jury
npm install
```

### 2. 環境變數設定

複製環境變數範本並設定：

```bash
cp .env.example .env
```

`.env` 內容說明：
```ini
# 0G Compute Router API Key (可於 https://pc.0g.ai 領水或儲值)
VITE_ZG_ROUTER_API_KEY=your_0g_router_key_here

# 0G Compute Router 端點
VITE_ZG_ROUTER_URL=https://router-api.0g.ai/v1

# 0G Galileo 測試網 RPC
VITE_ZG_RPC_URL=https://evmrpc-testnet.0g.ai
VITE_ZG_CHAIN_ID=16602

# 0G ERC-8004 測試網合約位址
VITE_ZG_ERC8004_IDENTITY=0x8004A818BFB912233c491871b3d84c89A494BD9e
VITE_ZG_ERC8004_REPUTATION=0x8004B663056A597Dffe9eCcC1965A193B7388713
```

> **提示**：系統具備完善的離線備援與展示機制，即使尚未填入 API Key 亦可流暢體驗完整的 Agent 經濟發包與鏈上驗證流程！

### 3. 本地執行 0G 原生網路連通性檢驗

```bash
npm run test:0g
```

該指令將直接向 0G Galileo 測試網 RPC、0G Compute Router 及 ERC-8004 鏈上合約發送真實查詢，回傳區塊高度與在線狀態。

### 4. 啟動開發伺服器

```bash
npm run dev
```

在瀏覽器中開啟 `http://localhost:5173` 即可進行互動展示。

---

## 📦 建置與部屬

```bash
npm run build
npm run preview
```

---

## 📄 專案目錄結構

```
hitmaker-jury/
├── src/
│   ├── components/
│   │   ├── ExecutiveCommandBar.tsx     # 老闆指示、預算分配與音訊控制台
│   │   ├── HitmakerStage.tsx           # 3 位評審動態舞台與即時彈幕
│   │   ├── Live0GHUD.tsx               # 0G Galileo 區塊鏈與 Router 即時監控儀表
│   │   ├── PixelAvatar.tsx             # 8-bit 像素風格評審頭像與動畫
│   │   ├── ServeProofReviewModal.tsx   # 鏈上評價彈窗 (Web3 錢包真實簽名)
│   │   └── VerifiableProofDrawer.tsx   # 0G TEE 防偽與 ServeProof 抽屜檢視器
│   ├── services/
│   │   ├── audioAnalyzer.ts            # Web Audio API 音訊頻譜與特徵提取
│   │   ├── zgChain.ts                  # 0G Chain RPC 與 ERC-8004 交易構建
│   │   └── zgCompute.ts                # 0G Compute Router 推論與經紀人綜整
│   ├── types/                          # TypeScript 型別定義
│   ├── App.tsx                         # 主應用程式入口
│   └── main.tsx
├── scripts/
│   └── test-0g.js                      # 0G 連通性自動化測試腳本
├── public/                             # 靜態資源 (預設 Demo 音訊)
├── AGENTS.md                           # 0G 官方元件評估與技術規格書
├── PITCH.md                            # 3 分鐘 Demo Pitch 完整逐字講稿
└── package.json
```

---

## 📜 授權條款 (License)

MIT License
