# Tasks: form-inheritance-hints
 
## 1. 前端載入與共用提示邏輯
- [x] 1.1 啟動時即載入 `loadLayoutSettings()`（版面分頁開啟時照舊重載），`layoutReady` 載入前提示只顯示「未設定」
- [x] 1.2 app.js 新增共用的繼承提示函式（回傳文案 key 與插值），三個群組對話框與項目標共用
 
## 2. 群組對話框（服務／書籤／版面三處同步）
- [x] 2.1 `columns` 輸入框在樣式非 row 時 disabled 置灰，標籤行右側顯示「僅 row 樣式生效」
- [x] 2.2 樣式下拉「未設定」選項文案改為「未設定（同 columns）」
- [x] 2.3 `header` 改為二元開關（顯示／隱藏，預設顯示；隱藏寫 false、顯示不寫鍵）
- [x] 2.4 `initiallyCollapsed`／`useEqualHeights` 未設定的標籤行動態顯示繼承結果；明確覆寫時顯示「覆寫全域（全域：X）」
- [x] 2.5 `tab` 欄位：其他群組有分頁且本群組未填時，hint 顯示「此群組顯示於所有分頁」
 
## 3. 服務項目標
- [x] 3.1 `showStats` 簡化為「跟隨全域／明確關閉」兩選；舊值 true 載入時映射為跟隨全域、存檔時移除
- [x] 3.2 `statusStyle` 未設定顯示全域值、覆寫時顯示「覆寫全域」
- [x] 3.3 書籤項目的 `weight` placeholder 加註預設 0
 
## 4. 版面分頁全域開關與卡片摘要
- [x] 4.1 `maxGroupColumns`／`maxBookmarkGroupColumns` 載入時對超範圍既有值標示「超出範圍」
- [x] 4.2 群組卡片與版面分頁列的版面摘要：樣式空白顯示 columns、非 row 不顯示欄數、覆寫全域加圖示
 
## 5. 後端存檔驗證
- [x] 5.1 `lib/homepage-layout.js` 的 int 驗證對 maxGroupColumns／maxBookmarkGroupColumns 限制 5–8，不合不寫入並回錯誤
- [x] 5.2 錯誤訊息加入 `lib/i18n.js` 的 ERROR_KEYS，四個語系檔各補一鍵
 
## 6. 語系與測試
- [x] 6.1 四個內建語系檔（locales/*.ini）補所有新增提示 key（繼承、覆寫、僅 row、超出範圍）
- [x] 6.2 無頭 Chrome 測試加斷言：columns 禁用狀態、繼承提示、覆寫提示、tab 全分頁提示、maxGroupColumns 範圍擋下
- [x] 6.3 跑 `npm test` 全綠後存檔驗證：改一個群組的 columns 存檔，確認 backup 與檔案 diff 符合預期
