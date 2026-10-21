# Change: editor-i18n

## Why

編輯器介面目前是「只有繁體中文」：所有使用者看得到的文字都硬編在
`public/index.html`（475 行的範本）與 `public/app.js`（提示訊息、欄位標籤、錯誤
處理）裡。要換語系就得改程式，而且沒有地方可以放翻譯——使用者想自己加一種語言，
連要動哪個檔案都不知道。

編輯器只拿來改 Homepage 的設定，本身的文字量不大（介面可見字串約兩百出頭），
是時候把「文字」從「程式」裡拆出來。

## What Changes

- 新增 `lib/ini.js`：一個小的 INI 解析器（section、`key=value`、`#`/`;` 註解、
  引號值、UTF-8 BOM），語系檔與主題檔共用同一個格式與同一個解析器。
- 語系檔放在編輯器自己的 `locales/` 目錄，格式為 INI：`[meta]` 放語言代碼與名稱，
  其餘 section 放 `key = 文字`。使用者自己放一個檔案（例如 `locales/fr.ini`），
  語言選單就會多出來，不必改任何程式碼。
- 內建四種語系：`zh-TW`（把現有繁中字串原樣抽出）、`zh-CN`、`ja`、`en`。
- 前端改用 `t('key')` 取字串；切換語系不重新載入頁面，直接換字並更新
  `<html lang>`。
- 缺漏的翻譯退回繁中，再缺就顯示 key 本身，並在 console 警告——寧可少翻一段，
  也不要整個介面壞掉。
- 伺服器回傳的錯誤訊息（例如「預覽網址格式不正確」）也跟著語系翻譯：API 以
  `?locale=` 參數或 `Accept-Language` 標頭決定語言，回應格式維持原本的字串
  `message`，既有契約不變。
- 語系選擇存進編輯器設定檔（`cms-settings.yaml`）的 `locale` 欄位，重啟後保留。

## Impact

- Affected specs: `editor-i18n`（ADDED）、`runtime-settings`（ADDED）
- Affected code: `lib/ini.js`（新增）、`server.js`、`public/index.html`、
  `public/app.js`、`locales/*.ini`（新增）、`public/style.css`（語言選擇器）
- Risk: 抽字串會動到整份範本。Vue 範本與 `setup()` 回傳必須同步改，否則會出現
  白屏（既有 `window.__fatal` 錯誤面板會顯示原因）

