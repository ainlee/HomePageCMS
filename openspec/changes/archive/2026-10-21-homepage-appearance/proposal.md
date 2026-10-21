# Change: homepage-appearance

## Why

Homepage 沒有佈景檔：它的配色是程式內建的 23 條 Tailwind 色階，使用者能改的是
`settings.yaml` 裡的視覺欄位（配色、深淺色、背景圖與濾鏡、卡片模糊、標題／卡片／
區塊樣式、圖示樣式、字型）。要調這些，`settings.yaml` 只能手改——而
HomePageCMS 連 `settings.yaml` 都還沒碰過，所以使用者得離開編輯器、SSH 進 NAS
去改檔，改完也看不到即時預覽。

編輯器自己的配色方案（`themes/*.ini`）是另一套東西，跟 Homepage 的外觀無關，
兩邊目前各自為政。

## What Changes

- 編輯器多一個「首頁外觀」分頁，編輯 Homepage `settings.yaml` 的視覺欄位。
- 提供配色色票（23 色，含淺色與深色兩種色階預覽）與各樣式的下拉選單。
- 背景圖可填網址或容器內路徑，並可設定模糊、飽和度、亮度與不透明度。
- 外觀分頁有獨立的儲存鈕；頂端的儲存鈕也會一併存檔外觀設定。
- 存檔時只覆蓋被編輯過的欄位，`settings.yaml` 裡其他欄位（`allowedHosts`、
  `providers`、`layout` 等）原封不動保留。
- 存檔前先備份 `settings.yaml`；檔案在載入後被其他程式改動過時拒絕覆寫。
- 存檔後重新載入預覽，Homepage 下次請求就會讀到新的設定，不需重啟容器。

## Impact

- Affected specs: `homepage-appearance`（新增）
- Affected code: `lib/homepage-appearance.js`、`server.js`、`public/index.html`、
  `public/app.js`、`public/style.css`、`locales/*.ini`、
  `tests/verify-appearance.mjs`
- 不包含 `custom.css` / `custom.js` 編輯器與自訂色階換算（另案處理）。
