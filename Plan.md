# stvisual — 改善建議與路線圖

> 最後更新：2026-05-13（F-A3/A4 Lab 模式已完成，新增 G 節探索路線圖）

---

## 現況（已完成功能）

### 互動式 Explorer（20 個）

| Explorer | 主要功能 | Quiz |
|----------|----------|------|
| TestingMethodTree | 測試方法分類樹狀圖 | — |
| TestingFlow + TestingTypesTable | 測試流程 & 測試金字塔 | — |
| GraphCoverageExplorer | CFG 建構、Node/Edge/Prime-path 準則、DFG 資料流準則 | ✓ |
| LogicCoverageExplorer | 14 項 Logic Coverage 準則、K-map、clause binding | ✓ |
| SyntaxCoverageExplorer | Program Mutation（6 operators）、Grammar Mutation | ✓ |
| SpecMutationExplorer | FSM Safety Monitor、SMV-style 規格突變 | — |
| FuzzTestingExplorer | mutation-based fuzzing + CFG 覆蓋熱度圖 | ✓ |
| SymbolicExecutionExplorer | 符號執行路徑樹 + CFG 映射 + 縮放 | ✓ |
| ConcolicExecutionExplorer | DART/CUTE-style concolic + CFG 映射 + 縮放 | ✓ |
| TestGenerationExplorer | 從 Graph / DFG 準則自動產生具體測試輸入 + JS 匯出 | — |
| CloudStoragePanel | Firebase / Google Drive 雲端同步 | — |
| BoundaryValueExplorer | 5-point BVA + Robustness BVA、多參數 | ✓ |
| EquivalenceClassExplorer | WECT / SECT、分割條件編輯器 | ✓ |
| DecisionTableExplorer | 條件/動作矩陣、T/F/– 儲存格、覆蓋率徽章 | ✓ |
| StateTransitionExplorer | SVG 狀態圖、轉移覆蓋 + BFS 序列覆蓋 | ✓ |
| MetamorphicTestingExplorer | 5 個程式 × 2–3 個 MR、產生 8 對測試、通過/失敗表 | ✓ |
| ExploratoryTestingExplorer | 任務書、SFDIPOT 清單、HICCUPPS 參考、計時器、觀察日誌 | — |
| TestDoublesExplorer | Dummy/Stub/Fake/Mock/Spy、2 個可執行情境/類型、呼叫記錄 | ✓ |
| 全站 i18n | ZH-TW / EN 切換 | — |

### 投影片（13 講，雙語，含 speaker notes）

01 課程概觀、02 測試流程、03 Graph Coverage、04 Data Flow、05 Logic Coverage、
06 Program Mutation、07 Grammar & String、08 Spec Mutation、09 Fuzz Testing、
10 Symbolic Execution、11 Concolic Execution、12 Test Generation、13 Logic Binding

### 測試

- 346 個 unit tests（Vitest + jsdom），34 個測試檔案
- Playwright E2E：GraphCoverage、LogicCoverage、SyntaxCoverage、TestingFlow 等

### CI / 佈署

- GitHub Actions：Node.js 24、兩個 workflow（`test.yml` + `deploy-pages.yml`）
- GitHub Pages 自動部署：push to main → test → inject-env → build:standalone → site/

---

## 待辦事項

### D1. 為所有尚未有 Quiz 模式的 Explorer 增加 self-test（已完成 2026-05-12）

| PR | Explorer | 出題形式 | 完成日 |
|----|----------|---------|--------|
| #120 | LogicCoverageExplorer | 給定謂詞+準則，輸入不重複測試案例數 | 2026-05-12 |
| #120 | DecisionTableExplorer | 輸入已覆蓋規則數 + 重複規則數 | 2026-05-12 |
| #120 | StateTransitionExplorer | 輸入目前覆蓋模式所需測試數 | 2026-05-12 |
| #122 | SyntaxCoverageExplorer | 輸入測試套件可殺死的突變體數 | 2026-05-12 |
| #122 | MetamorphicTestingExplorer | 輸入 8 對測試中成立的對數（自動生成） | 2026-05-12 |
| #122 | TestDoublesExplorer | 多選題：選出最適合的替身類型 | 2026-05-12 |
| #124 | SymbolicExecutionExplorer | 輸入可行路徑數 | 2026-05-12 |
| #124 | ConcolicExecutionExplorer | 輸入不重複路徑數 | 2026-05-12 |
| #124 | FuzzTestingExplorer | 輸入節點覆蓋率 % | 2026-05-12 |

不適合 quiz（工具型）：TestingMethodTree、TestingFlow、TestingTypesTable、
ExploratoryTestingExplorer、CloudStoragePanel。

---

### E. Testing Flow 新增視覺化功能（已完成 2026-05-13）

| PR | 功能 | 說明 | 完成日 |
|----|------|------|--------|
| #126 | E1 — DefectCostExplorer | 6 階段缺陷修復成本曲線；hover/click 顯示倍數、技術建議 | 2026-05-13 |
| #128 | E2 — VModelExplorer | 互動式 V-model；點擊開發階段高亮對應測試階段 | 2026-05-13 |
| #130 | E3 — PyramidAdjusterExplorer | 三滑桿金字塔比例調整器；速度/維護/信心衍生指標 | 2026-05-13 |

---

### F. Google Classroom 整合 + Self-Test 強化（進行中）

#### 背景與目標

讓老師可以透過 Google Classroom 出作業，學生在工具中完成 **Quiz 模式**（有正確答案、自動批改）或 **Lab 模式**（互動探索 + 反思問題 / 量化指標），再將成績回報給老師。

#### Self-Test 模式定義

| 模式 | 說明 | 批改方式 |
|------|------|---------|
| **Quiz** | 給定場景，輸入正確答案（數字、選擇題） | 自動批改，有確定正解 |
| **Lab — Reflection** | 探索互動後回答 2–3 個反思問題（開放式文字） | 榮譽制，老師閱覽 |
| **Lab — Metric** | 達成量化指標（如覆蓋率 ≥ 80%、消滅突變體 ≥ N 個） | 自動判定通過/未通過 |

---

#### F-A — Phase A：純前端成績匯出（進行中）

**目標**：不需後端，學生完成 quiz/lab → 產生可分享的結果連結 → 貼到 Classroom 作業留言 → 老師點連結驗證。

**元件**

- `src/utils/resultExporter.js` — 將答題記錄序列化為 Base64 URL 參數
- `src/components/ResultViewer.js` + CSS — 讀取 URL `?result=` 參數，呈現唯讀成績單
- 各 Explorer quiz panel 加「📋 分享成績」按鈕（複製連結到剪貼板）
- Lab — Reflection：在數個 Explorer 加「反思問題」（open-ended 文字輸入），同樣可匯出
- Lab — Metric：在支援量化指標的 Explorer（Graph/Syntax/Fuzz 等）加「達標紀錄」匯出

**URL 格式**（無後端簽章，榮譽制）

```
https://site/?result=<base64(JSON)>
JSON = { v:1, explorer, mode:"quiz"|"lab-reflect"|"lab-metric",
         ts, lang, items:[{q,a,correct?,score?}], total, passed? }
```

**限制**：純榮譽制，學生可自行修改連結；Phase B 才加簽章與身份驗證。

**子任務**

- [ ] F-A1：`resultExporter.js` + `ResultViewer` 元件 + i18n + 測試
- [ ] F-A2：所有現有 Quiz Explorer 加「分享成績」按鈕
- [ ] F-A3：Lab — Reflection：為 Graph / Logic / Fuzz / Symbex 加反思問題 + 匯出
- [ ] F-A4：Lab — Metric：Graph（覆蓋率）、Syntax（殺死突變體 %）、Fuzz（節點覆蓋 %）加達標匯出
- [ ] F-A5：`ResultViewer` 整合進 app 首頁（URL 有 `?result=` 時自動彈出）

---

#### F-B — Phase B：Firebase Auth + Firestore 成績儀表板（待規劃）

**目標**：Google Sign-In（Firebase Auth）+ Firestore 存分數；老師 dashboard 頁面看全班成績。Classroom 作業仍手動建（連結到工具特定 section），但成績追蹤自動化。

**需要新增**
- Firebase Functions（Node.js）作 OAuth token 管理
- Firestore 資料結構：`courses/{courseId}/students/{uid}/results/{resultId}`
- 老師 dashboard：班級成績總覽、個別學生答題明細
- 學生端：登入後成績自動上傳，不需手動複製連結

**前置條件**：F-A 完成；確認 Firebase Functions 費用與 CI 部署流程

---

#### F-C — Phase C：完整 Google Classroom API 整合（待規劃）

**目標**：老師在工具內一鍵建 Classroom 作業，學生完成後成績自動回寫 Classroom。

**需要新增**
- Firebase Functions 作 Classroom API OAuth proxy（避免 client secret 暴露）
- Classroom API scopes：`classroom.coursework.students`、`classroom.rosters.readonly`
- 作業類型：
  - Quiz → Google Forms（FormItems API）或 Classroom Link 作業
  - Lab-Reflect → Classroom 附件（學生填寫後提交）
  - Lab-Metric → Classroom Link + 工具端自動 POST 成績
- Google OAuth App 審查（需提交至 Google Cloud Console，審核約 1–4 週）

**前置條件**：F-B 完成；Google Cloud 專案已申請 Classroom API 存取

---

### D2. 關閉已完成的 GitHub Issues（已執行 2026-05-13）

下列 issue 的對應 PR 均已 merge，已手動關閉：

| Issue | 說明 | 關閉時間 |
|-------|------|---------|
| #97 | Logic Binding 投影片 | 2026-05-13 |
| #99 | JSDOM smoke tests | 2026-05-13 |
| #101 | Download-as-JS 匯出 | 2026-05-13 |
| #103 | Analytic interval solver | 2026-05-13 |
| #111 | BVA + EC explorers | 2026-05-13 |
| #113 | Quiz 模式 | 2026-05-13 |
| #115 | Decision Table + State Transition | 2026-05-13 |

目前無開放 issue。

---

### D3. CI 升級 Node.js 20 → 24（已執行 2026-05-13）

GitHub 警告 Node.js 20 將不再被支援；已更新兩個 workflow：

- `.github/workflows/test.yml` — `node-version: 24`
- `.github/workflows/deploy-pages.yml` — `node-version: 24`
- `README.md` — 文件同步更新

**待確認**：push 後觀察 CI 是否全數通過（Vite / esbuild / Playwright 與 Node.js 24 相容性）。

---

## G. 新測試方法 Explorer（待評估／實作）

> 分析現有 20 個 Explorer 後，下列方法在課程教材中常見，且適合純前端互動視覺化，值得納入規劃。

### G1（高優先）— Pairwise / All-pairs Testing Explorer

**教學動機**：學生直覺上低估多參數組合爆炸的嚴重性；視覺化 IPO 演算法能有效說明「為什麼只需 N 個測試就能覆蓋所有兩兩組合」。與現有 BVA / EC / DT 形成「黑箱三部曲」完整閉環。

**功能規劃**

- 參數編輯器：自訂參數名稱 + 每個參數的可能值（如 OS: Win/Mac/Linux，Browser: Chrome/FF/Safari）
- IPO（In-Parameter-Order）greedy 演算法在前端純 JS 實作，生成最小覆蓋矩陣
- 視覺化：覆蓋矩陣表格（高亮哪些 pair 被覆蓋）、vs 全配對數（n 個測試 vs n² 個 pair）
- 對比面板：全配對（Exhaustive）/ WECT / Pairwise 三者測試數的比較
- Quiz：「目前設定需要幾個 pairwise 測試案例？」
- Lab Metric：pairwise 覆蓋率達 100% 才算通過

**實作估計**：1 個 PR，約 400–600 行（JS + CSS + i18n）

---

### G2（高優先）— Cause-Effect Graphing Explorer

**教學動機**：BVA / EC 的「上游」——從文字需求系統化推導條件（Causes）與效果（Effects），再自動轉換為決策表。補足黑箱技術的需求分析鏈路。

**功能規劃**

- 因果編輯器：左欄 Causes（條件）、右欄 Effects（效果），以 AND / OR / NOT / NAND 連接
- SVG 互動圖：繪製因果關係圖（G-notation 符號：直線=直接、空心圓=NOT、弧=OR）
- 自動推導：從因果圖自動生成決策表（等同 DT Explorer 的輸出）
- 約束標記：E（Exclusive）、I（Inclusive）、O（One-and-only-one）、R（Requires）
- Quiz：「這張因果圖可以推導出幾條決策規則？」

**實作估計**：1–2 個 PR，較複雜（SVG 互動 + 推導演算法）

---

### G3（高優先）— Code Coverage Drill-down Explorer

**教學動機**：Statement / Branch / Condition / MC/DC 覆蓋是最貼近實務的白箱技術，學生最常使用，卻常搞混四者差異。

**功能規劃**

- 程式碼編輯器（小型 JS 函數）+ 測試案例輸入
- 執行測試案例，逐行追蹤哪些行/分支/條件被覆蓋（高亮顯示）
- 四種準則切換：Statement → Branch → Condition → MC/DC，即時更新高亮
- 覆蓋率百分比儀表板（每種準則分別顯示）
- 與 GraphCoverageExplorer 做概念對應（Node ↔ Statement，Edge ↔ Branch）
- Quiz：「目前測試套件達到哪個覆蓋準則？」
- Lab Reflect：「MC/DC 比 Branch Coverage 多要求什麼？」

**實作估計**：1–2 個 PR，需要輕量執行引擎（類似 Symbolic Execution 的 JS 子集解析）

---

### G4（中優先）— Integration Testing Strategies Explorer

**教學動機**：整合測試策略（Big Bang / Top-down / Bottom-up / Sandwich）是架構課與測試課的交叉點，但缺乏互動教材。

**功能規劃**

- 元件相依圖（可自訂模組與相依邊）
- 四種策略動畫：按步驟顯示整合順序、需要哪些 Stub / Driver
- 對比面板：每種策略的優缺點、需要的替身數量
- Quiz：「Top-down 策略在第 N 步需要幾個 Stub？」

**實作估計**：1 個 PR

---

### G5（中優先）— Property-Based Testing Explorer

**教學動機**：QuickCheck-style 測試（Haskell/Scala/Python hypothesis）越來越主流，但台灣課程少有互動教材。

**功能規劃**

- 輸入：函數定義 + 性質（invariant）表達式（如 `sort(x).length === x.length`）
- 生成器：隨機整數/字串/陣列，可設定數量
- Shrinking：找到反例後自動縮小到最小失敗案例
- 視覺化：測試輸入分布圖 + 反例高亮
- Lab Reflect：「找到的反例說明什麼邊界條件？」

**實作估計**：1 個 PR

---

### G6（中優先）— Risk-Based Test Prioritization Explorer

**教學動機**：測試資源有限時，如何選擇優先執行哪些測試？風險矩陣（可能性 × 影響）是業界常用工具。

**功能規劃**

- 可自訂功能模組清單 + 估計「故障可能性」與「業務影響」（1–5 分）
- 風險熱圖（heat map）：自動著色高/中/低風險區
- 測試套件子集選擇器：選擇只跑高風險模組的測試
- Lab Metric：標記高風險模組並記錄覆蓋率

**實作估計**：1 個 PR

---

### 優先順序建議

| 排序 | 項目 | 理由 |
|------|------|------|
| ① | G1 Pairwise | 純演算法、最易實作、補足黑箱三部曲 |
| ② | G3 Code Coverage | 學生最實用、與 Graph Coverage 有清晰對應 |
| ③ | G2 Cause-Effect | 補足需求→測試鏈路，但 SVG 較複雜 |
| ④ | G4 Integration | 補足架構層次的整合測試概念 |
| ⑤ | G5 Property-Based | 進階主題，適合選修或延伸 |
| ⑥ | G6 Risk-Based | 管理層次，適合配合專案課程 |

---

## 已完成的改善項目（歸檔）

| 項目 | PR | 完成日 |
|------|----|--------|
| A1 — #13 Logic Binding 投影片 | #98 | 2026-05-12 |
| A2 — Explorer JSDOM smoke tests | #100 | 2026-05-12 |
| A3 — TestGen Download-as-JS | #102 | 2026-05-12 |
| B1 — Analytic interval solver | #104 | 2026-05-12 |
| B2 — Logic Binding 更多範例（isLeapYear/gcdStep/binarySearch） | #106 | 2026-05-12 |
| B3 — Mutation-based fuzzing engine | #108 | 2026-05-12 |
| C1 — Speaker notes（13 講） | #110 | 2026-05-12 |
| C2 — BVA + EC explorers | #112 | 2026-05-12 |
| C3 — Quiz 模式（Graph/BVA/EC） | #114 | 2026-05-12 |
| Decision Table + State Transition explorers | #116 | 2026-05-12 |
| Metamorphic Testing + Exploratory Testing + Test Doubles | #118 | 2026-05-12 |
| D1 — Quiz 高優先（Logic/DT/ST） | #120 | 2026-05-12 |
| D1 — Quiz 中優先（Syntax/MT/TD） | #122 | 2026-05-12 |
| D1 — Quiz 低優先（Symbolic/Concolic/Fuzz） | #124 | 2026-05-12 |
| E1 — DefectCostExplorer | #126 | 2026-05-13 |
| E2 — VModelExplorer | #128 | 2026-05-13 |
| E3 — PyramidAdjusterExplorer | #130 | 2026-05-13 |

---

## 技術棧備忘

| 工具 | 用途 |
|------|------|
| Vite + 原生 JS | 前端，無框架 |
| Vitest + jsdom | Unit tests（346 個） |
| Playwright | E2E / screenshot capture |
| Marp CLI | Markdown → PPTX |
| Firebase / Google Drive | 雲端同步 |
| esbuild | standalone.js 打包（file:// 模式） |
| Node.js 24 | CI / GitHub Actions |
