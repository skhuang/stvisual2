# stvisual — 改善建議與路線圖

> 最後更新：2026-05-14（F-B TeacherDashboard 完成；G1–G6、H1–H6 全數完成）

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
| CloudStoragePanel | Firebase / Google Drive 雲端同步；班級代碼輸入、結果自動上傳 | — |
| TeacherDashboard | 全班成績儀表板（Firestore 載入）、學生列表、Explorer 篩選 | — |
| BoundaryValueExplorer | 5-point BVA + Robustness BVA、多參數 | ✓ |
| EquivalenceClassExplorer | WECT / SECT、分割條件編輯器 | ✓ |
| DecisionTableExplorer | 條件/動作矩陣、T/F/– 儲存格、覆蓋率徽章 | ✓ |
| StateTransitionExplorer | SVG 狀態圖、轉移覆蓋 + BFS 序列覆蓋 | ✓ |
| MetamorphicTestingExplorer | 5 個程式 × 2–3 個 MR、產生 8 對測試、通過/失敗表 | ✓ |
| ExploratoryTestingExplorer | 任務書、SFDIPOT 清單、HICCUPPS 參考、計時器、觀察日誌 | — |
| TestDoublesExplorer | Dummy/Stub/Fake/Mock/Spy、2 個可執行情境/類型、呼叫記錄 | ✓ |
| PairwiseExplorer | IPO greedy 演算法、覆蓋矩陣視覺化、vs 全配對比較 | ✓ |
| CauseEffectExplorer | 因果圖（SVG）、AND/OR/NOT 連接、自動推導決策表 | ✓ |
| CodeCoverageExplorer | Statement/Branch/Condition/MC-DC 覆蓋、逐行高亮 | ✓ |
| IntegrationTestingExplorer | Big Bang/Top-down/Bottom-up/Sandwich 動畫、Stub/Driver 計數 | ✓ |
| PropertyBasedTestingExplorer | QuickCheck-style、隨機生成器、Shrinking、反例視覺化 | ✓ |
| RiskBasedTestingExplorer | 風險矩陣熱圖、模組優先排序、Lab Metric | ✓ |
| GroupTheoryExplorer | Orbit Explorer（Tab 1）、CACC Bridge（Tab 2）、Covering Array（Tab 3）；理論橋接 Logic & MT | ✓ |
| 全站 i18n | ZH-TW / EN 切換 | — |

### 投影片（13 講，雙語，含 speaker notes）

01 課程概觀、02 測試流程、03 Graph Coverage、04 Data Flow、05 Logic Coverage、
06 Program Mutation、07 Grammar & String、08 Spec Mutation、09 Fuzz Testing、
10 Symbolic Execution、11 Concolic Execution、12 Test Generation、13 Logic Binding

### 測試

- 415 個 unit tests（Vitest + jsdom），37 個測試檔案
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

**子任務**（全部完成 2026-05-13，PR #133 / #135）

- [x] F-A1：`resultExporter.js` + `ResultViewer` 元件 + i18n + 測試（#133）
- [x] F-A2：所有現有 Quiz Explorer 加「分享成績」按鈕（#133）
- [x] F-A3：Lab — Reflection：為 Graph / Logic / Fuzz / Symbex 加反思問題 + 匯出（#135）
- [x] F-A4：Lab — Metric：Graph（覆蓋率）、Syntax（殺死突變體 %）、Fuzz（節點覆蓋 %）加達標匯出（#135）
- [x] F-A5：`ResultViewer` 整合進 app 首頁（URL 有 `?result=` 時自動彈出）（#133）

---

#### F-B — Phase B：Firebase Auth + Firestore 成績儀表板（已完成 2026-05-14）

**目標**：Google Sign-In（Firebase Auth）+ Firestore 存分數；老師 dashboard 頁面看全班成績。Classroom 作業仍手動建（連結到工具特定 section），但成績追蹤自動化。

**架構決策**：不需 Firebase Functions — Firestore 直接寫入 + Security Rules 即可；省去冷啟動費用與 CI 複雜度。

**子任務**

| PR | 功能 | 完成日 |
|----|------|--------|
| #162 | F-B1：`cloudIntegration.js` 新增 `saveResult` / `loadCourseResults`；Firestore schema `courses/{classCode}/results/{uid}_{ts}`；`firestore.rules` | 2026-05-14 |
| #164 | F-B2：`CloudStoragePanel` 班級代碼輸入（localStorage 持久化）、Upload Count 徽章、document-level `[data-share-payload]` 自動攔截上傳 | 2026-05-14 |
| #166 | F-B3：`TeacherDashboard` 元件；全班成績表格（學生/Explorer/分數/時間）；Explorer 篩選；Summary 徽章；`stvisual:open-teacher-dashboard` 事件整合 | 2026-05-14 |

**Firestore 資料結構**
```
courses/{classCode}/results/{uid}_{ts}
  uid, displayName, email, explorer, explorerLabel,
  mode, score, total, ts, lang, items[], savedAt
```

**Security Rules**：學生只能寫入自己的 uid 記錄；任何已登入用戶可讀（老師查詢全班）；禁止更新與刪除。

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

## G. 新測試方法 Explorer（全部完成 2026-05-13/14）

| PR | Explorer | 主要功能 | 完成日 |
|----|----------|---------|--------|
| #137 | G1 — PairwiseExplorer | IPO greedy 演算法、覆蓋矩陣視覺化、vs 全配對比較、Quiz | 2026-05-13 |
| #139 | G2 — CauseEffectExplorer | 因果圖（SVG）、AND/OR/NOT 連接、自動推導決策表、Quiz | 2026-05-13 |
| #141 | G3 — CodeCoverageExplorer | Statement/Branch/Condition/MC-DC 覆蓋、逐行高亮、Quiz + Lab Reflect | 2026-05-13 |
| #143 | G4 — IntegrationTestingExplorer | Big Bang/Top-down/Bottom-up/Sandwich 動畫、Stub/Driver 計數、Quiz | 2026-05-13 |
| #145 | G5 — PropertyBasedTestingExplorer | QuickCheck-style、隨機生成器、Shrinking、反例視覺化、Lab Reflect | 2026-05-13 |
| #147 | G6 — RiskBasedTestingExplorer | 風險矩陣熱圖、模組優先排序、Lab Metric | 2026-05-14 |

---

## H. Group Theory Explorer（全部完成 2026-05-14）

> 以群論為核心，連結 Logic Coverage（CACC）與 Metamorphic Testing（對稱性），具備理論橋接按鈕。

| PR | 子任務 | 說明 | 完成日 |
|----|--------|------|--------|
| #149 | H1 — 群論工具函式庫 | `computeAutGroupFromTable`、`determinationPairsFromTable`、35 個單元測試 | 2026-05-14 |
| #151 | H2 — Orbit Explorer（Tab 1） | 運算表格輸入 → 自動計算自同構群、軌道分割、視覺化 | 2026-05-14 |
| #153 | H3 — CACC Bridge（Tab 2） | 用群論 determination pairs 橋接 Logic Coverage；高亮對稱對 | 2026-05-14 |
| #155 | H4 — Covering Array（Tab 3） | GF(p) 有限域 covering array 生成器；strength 滑桿 | 2026-05-14 |
| #157 | H5 — Theory Bridge 按鈕 | GroupTheory → Metamorphic Testing（點擊 MT tab + 滾動至 section-blackbox）；Logic → GroupTheory | 2026-05-14 |
| #159 + #160 | H6 — Per-tab Quiz & Lab Reflect | 每個 tab 獨立出題（動態計算正解）；Lab Reflect 雙 textarea；bridge 按鈕 bug 修復 | 2026-05-14 |

**架構特點**
- Quiz 正解依當前 tab 動態計算（`_quizCorrect()`），不用硬編碼
- Bridge 按鈕：MT 是 `section-blackbox` 的子 tab，需 `.click()` 先切換再 `scrollIntoView`

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
| F-A1/A2/A5 — ResultExporter + ResultViewer + 分享按鈕 | #133 | 2026-05-13 |
| F-A3/A4 — Lab Reflect + Lab Metric 模式 | #135 | 2026-05-13 |
| G1 — PairwiseExplorer | #137 | 2026-05-13 |
| G2 — CauseEffectExplorer | #139 | 2026-05-13 |
| G3 — CodeCoverageExplorer | #141 | 2026-05-13 |
| G4 — IntegrationTestingExplorer | #143 | 2026-05-13 |
| G5 — PropertyBasedTestingExplorer | #145 | 2026-05-13 |
| G6 — RiskBasedTestingExplorer | #147 | 2026-05-14 |
| H1 — 群論工具函式庫 | #149 | 2026-05-14 |
| H2 — GroupTheoryExplorer Tab 1 Orbit | #151 | 2026-05-14 |
| H3 — GroupTheoryExplorer Tab 2 CACC Bridge | #153 | 2026-05-14 |
| H4 — GroupTheoryExplorer Tab 3 Covering Array | #155 | 2026-05-14 |
| H5 — Theory Bridge 按鈕（GroupTheory ↔ Logic ↔ MT） | #157 | 2026-05-14 |
| H6 — Per-tab Quiz & Lab Reflect；bridge bug fix | #159 / #160 | 2026-05-14 |
| F-B1 — Firestore saveResult / loadCourseResults + Security Rules | #162 | 2026-05-14 |
| F-B2 — CloudStoragePanel 班級代碼 UI + 自動上傳攔截 | #164 | 2026-05-14 |
| F-B3 — TeacherDashboard 全班成績儀表板 | #166 | 2026-05-14 |

---

## 技術棧備忘

| 工具 | 用途 |
|------|------|
| Vite + 原生 JS | 前端，無框架 |
| Vitest + jsdom | Unit tests（415 個，37 檔） |
| Playwright | E2E / screenshot capture |
| Marp CLI | Markdown → PPTX |
| Firebase / Google Drive | 雲端同步 |
| esbuild | standalone.js 打包（file:// 模式） |
| Node.js 24 | CI / GitHub Actions |
