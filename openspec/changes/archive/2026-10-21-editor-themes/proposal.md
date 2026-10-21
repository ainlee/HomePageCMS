# Change: editor-themes

## Why

編輯器現在只有一種配色：深色。配色集中在 `public/style.css` 的 `:root` 變數
（`--bg`、`--bg-card`、`--bg-hover`、`--border`、`--text`、`--text-dim`、`--accent`、
`--accent-hover`、`--danger`、`--success`、`--radius`、`--shadow` 共 12 個 token），
寫死在樣式表裡。

想要換配色只有兩種笨方法：改 `style.css`（然後每次更新都被覆蓋），或是在瀏覽器
開發者工具手動改變數（重整就沒了）。使用者不能自己配一個順手的方案，也沒有辦法
在多台機器上帶著走。

## What Changes

- 主題（配色方案）改以 INI 檔案定義，放在編輯器自己的 `themes/` 目錄：
  `[meta]` 記錄 id、名稱、是否內建，`[colors]` 放 12 個色票 token，
  `[options]` 放圓角與陰影。與語系檔共用同一個格式與同一個解析器。
- 內建七套配色：
  - 深空（`midnight`，預設，沿用現有深色）
  - 深海（`abyss`，藍黑）
  - 松林（`forest`，墨綠）
  - 琥珀（`amber`，暖褐）
  - 石墨（`graphite`，淺色中性灰）
  - 象牙（`ivory`，淺色暖白）
  - 薰衣草（`lavender`，淺色淡紫）
- 淺色主題不只換背景：次要文字、邊框、輸入框、徽章、focus ring 都跟著換，
  並以對比測試（正文／次要文字對背景至少 4.5:1）擋下太淡的配色。
- 套用主題不重新載入頁面；伺服器在回傳 `index.html` 時把目前主題的變數注進
  `<style>`，所以重新整理時不會先閃一下預設深色再換成淺色。
- 設定介面新增「外觀」區塊：主題清單（每個附色票預覽）、套用、以及自訂主題
  編輯器——以目前主題為基底調整每個 token、命名、儲存。可複製、可刪除、可匯出
  /匯入 `.ini`。內建主題不能刪，只能複製成自訂主題。
- 自訂主題寫成 `themes/<id>.ini`（使用者可自行編輯或分享）；目前選用的主題記在
  編輯器設定檔的 `theme` 欄位。

## Impact

- Affected specs: `editor-themes`（ADDED）、`runtime-settings`（ADDED）
- Affected code: `lib/ini.js`（共用）、`server.js`、`public/index.html`、
  `public/app.js`、`public/style.css`、`themes/*.ini`（新增）
- Risk: 現有 token 名稱不變，版面測試不受影響；真正的風險在淺色主題的對比與
  MDI 圖示在淺底上的可見度，需要逐一檢查

