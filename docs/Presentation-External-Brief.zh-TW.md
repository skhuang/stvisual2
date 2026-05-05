# stvisual 對外簡報稿（中文版）

日期：2026-04-12

## 產品定位
stvisual 是一個互動式的軟體測試教學與分析平台，核心聚焦於 Graph Coverage 與 Logic Coverage：同時支援「手動編輯控制流程圖」「上傳程式碼自動產生簡化 CFG」，以及對任意布林 predicate 的邏輯覆蓋分析。

## 問題背景
測試覆蓋準則（例如 Node / Edge / Prime Path、PC / CC / ACC / IC）常常停留在概念層，學習者雖然理解定義，卻難以把理論連結到可執行的測試需求、真實程式流程或具體的真值表列。

## 解決方案
stvisual 把抽象理論變成可操作、可驗證的視覺化流程：

- 測試方法全覽：黑盒、白盒、灰盒
- Graph Coverage Explorer：Node、Edge、Prime Path、Edge-Pair、Complete Path
- 由 CFG 自動推導測試需求（requirements）
- 自動產生測試路徑，並提供最佳化前後指標
- 上傳程式碼後自動轉成簡化 CFG
- 依 requirement 顯示程式碼行號對應（source mapping）
- Logic Coverage Explorer：對任意布林 predicate 進行邏輯覆蓋分析
  - 語意系列：PC / CC / CoC / GACC / CACC / RACC / GICC / RICC
  - 語法（DNF）系列：IC / UTPC / NFPC / CUTPNFP
  - 以 Quine–McCluskey 最小化 DNF（含 ¬f 的 implicants）
  - 渲染 f 與 ¬f 的 Karnaugh map，並使用教科書式記號（相鄰=AND、+=OR、上劃線=NOT）
  - 真值表標示主／次子句、重複測試列以刪除線標記
  - 使用者自訂 predicate 以「最近使用」chip 保存，並可同步到 Firestore

## 差異化價值
- 雙入口學習模式：Graph-first 與 Code-first
- 同時涵蓋 Graph Coverage 與 Logic Coverage 兩條主線
- 可解釋性導向：需求、路徑、原始碼、真值表、K-map 同畫面可追蹤
- 工程可重現：具備單元測試、瀏覽器 E2E、CI 流程
- 佈署友善：支援 GitHub Pages 與 file protocol 場景

## 技術亮點
- 純 HTML + JavaScript 靜態架構
- 具 protocol-aware bootstrap，支援 file:// fallback
- 程式碼轉 CFG parser，支援 if、switch、巢狀 loop、break、continue
- 使用 greedy set-cover 近似法精簡測試路徑與 IC 測試列
- Predicate parser、真值表引擎與 Quine–McCluskey DNF 最小化
- Karnaugh map 視覺化（n=3 時欄為 ab、列為 c）

## 驗證證據
- Unit Tests：覆蓋演算法、資料契約、元件互動、parser 行為
- Browser E2E：覆蓋上傳流程、複雜控制流程 mapping、coverage criterion 切換一致性
- GitHub Actions：自動化測試與部署流程

## 交付狀態
- 測試方法視覺化：已完成
- Graph Coverage 進階能力：已完成
- 路徑最佳化與指標呈現：已完成
- README 與文件化：已完成
- 程式碼上傳 + 行號映射：已完成
- Logic Coverage Explorer：已完成（語意／語法準則、K-map、最近 predicate 同步）

## 典型使用情境
- 軟體測試課程教學示範
- 由控制流程圖推導測試需求的實務演練
- 比較不同 coverage criteria 的行為差異
- 展示測試路徑精簡與覆蓋率權衡
- 教授 Logic Coverage 準則（PC / CC / ACC / ICC / IC 系列）
- 展示真值表、DNF 最小化與 Karnaugh map 之間的關係

## 對外連結
- Repository：https://github.com/skhuang/stvisual
- Live Demo：https://skhuang.github.io/stvisual/

## 下一步發展方向
1. 擴充 source-to-CFG 支援語言。
2. 強化 parser 對更複雜語法的解析能力。
3. 建立雙向導航（點 code line 高亮 CFG node，反向亦然）。
4. 提供 coverage 報表與輸出格式，支援教學評量與成果留存。
