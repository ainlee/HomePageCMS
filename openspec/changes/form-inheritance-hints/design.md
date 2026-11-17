# Design: form-inheritance-hints
 
## 背景
 
上游 Homepage 的 layout／service 欄位有一批「未設定時繼承或等同另一選項」的隱形
行為。本 change 的改動全部是顯示層與一道存檔驗證：
 
- 顯示層（A、B、C、E 類）：不寫入或移除任何 YAML 值，純前端 computed。
- 存檔驗證（D 類）：`applyLayoutSettings` 的 int 驗證加 5–8 範圍；這是唯一改到
  檔案內容的行為。
 
上游依據（docs/tmp/upstream/homepage-2.7.0/src）：
 
- `services/list.jsx`、`bookmarks/list.jsx`：`style === "row"` 才讀 `columns`。
- `services/group.jsx`：`header !== false` 顯示標題；`initiallyCollapsed ??
  groupsInitiallyCollapsed`；`layout?.useEqualHeights ?? useEqualHeights`（全域）。
- `services/item.jsx`：`service.showStats === false ? false : settings.showStats`；
  `service.statusStyle ?? settings.statusStyle`。
- tab 規則：任何群組有 tab 時，無 tab 群組顯示於所有分頁。
 
## 資料流
 
動態提示需要的三個輸入都在前端已載入狀態：
 
1. `layoutValues`（全域開關，版面分頁首次開啟才載入）＋`layoutReady`。
2. `layoutGroups`（layout 群組條目，同 1 載入）。
3. `groups`／`bookmarkGroups`（服務／書籤群組，啟動即載入）。
 
群組對話框在服務／書籤分頁就會打開，但全域值只在版面分頁載入。解法：把
`loadLayoutSettings()` 提前到啟動載入（照 `layoutLib` 的 GET 端點，與版面分頁
共用同一份）；載入前 `layoutReady` 為 false，提示只顯示「未設定」，不算繼承值，
避免顯示錯誤結果。版面分頁開啟時照舊重新載入一次（hash 併用不變）。
 
提示一律做成共用的 computed（app.js 內一個 `inheritHint(field, value)` 函式，
回傳文案 key 與插值），三個群組對話框與項目標共用，避免三份實作漂移。
 
## 防呆的呈現方式
 
- 禁用狀態（columns 在非 row 時 disabled）是主體；提示文字是次級說明，放在既有
  標籤行右側（照 `.select-hint` 的 `sh-trigger-hint` 模式：同一行、寬度不足
  時 ellipsis，不另起一行、不拉高表單）。
- 置灰沿用 `public/style.css` 既有的 `.form-group input:disabled` 樣式，不新增
  顏色 token。
- 群組卡片／版面分頁列的覆寫圖示用既有 MDI 圖示（mdi-alert-outline），不用新圖示
  集；摘要文字照 `.layout-group-row` 既有排版加一個 span，窄螢幕隨既有換行規則
  掉行，不新增斷點。
 
## showStats 兩選化的存檔影響
 
現有三選（未設／true／false）。上游只有明確 false 生效，true 與未設同義。改成
兩選後：
 
- 舊檔案已寫 `showStats: true` 的項目，載入時映射到「跟隨全域」（顯示提示），
  存檔時不寫回（從檔案移除該鍵）——這是本 change 唯一會「順手清檔」的欄位，
  行為上無差（上游結果相同），spec 已明訂。
- `statusStyle` 維持三選，只加提示，不改選項。
 
## maxGroupColumns 範圍驗證
 
`lib/homepage-layout.js` 的 `applyLayoutSettings` 目前對 int 型只驗 `^\d+$`。
改成：`maxGroupColumns`／`maxBookmarkGroupColumns` 驗 5–8，不合則該鍵不寫入並
回錯誤（走 `lib/i18n.js` 的 ERROR_KEYS 既有模式，訊息經翻譯）；前端載入時照實
顯示超範圍值並加「超出範圍」小字，存檔後該值被移除。
 
## 不做的
 
- 不改 `applyLayoutSettings` 對群組欄位的寫入邏輯（header 改二元開關只改前端
  選項與預設寫法：「顯示」不寫鍵、「隱藏」寫 false）。
- 不改未建模欄位的保留規則。
- 外觀面板（theme、font、background）的禁用邏輯已有現成範例，不動。
- 書籤 item 的 weight 只做 placeholder 加註（0），不建提示。
 
## 測試
 
無頭 Chrome（tests/verify-*.mjs 既有模式）加斷言：
 
1. columns 輸入框在 style 非 row 時 disabled、row 時可用；
2. 全域未設時「跟隨全域：不折疊／不展開」提示出現；全域設關時顯示「跟隨全域：關」；
3. 明確值與全域相反時「覆寫全域」提示出現；
4. 其他群組有 tab、本群組無 tab 時「顯示於所有分頁」提示出現；
5. maxGroupColumns 填 3 存檔被擋、回應含錯誤、檔案值未變；填 10（既有）存檔後被移除。
