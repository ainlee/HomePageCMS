# Change: appearance-hints-and-revalidate

## Why

首頁外觀分頁有兩個會讓人卡住的問題，都是實際測出來的：

**一、存檔後預覽不會更新。** Homepage 的 `getDashboardData()` 把整份 dashboard 資料
（包含 `settings.yaml` 的內容）放在行程記憶體快取裡，只有 `/api/revalidate` 會清掉它。
所以改了配色、深淺色、背景圖之後，預覽仍是舊的——服務與書籤因為前端會重新抓取而
會更新，但外觀設定只來自伺服器端產生的頁面，所以不會。

**二、快取的坑沒有提示。** 儀表板若放在快取代理（CDN）之後，`/api/config/custom.css`
會被快取數小時，改完樣式看不到變化。介面上沒有任何說明，使用者只會覺得功能壞了。

另外，`settings.yaml` 的 `color:` 只能是 Homepage 內建的 23 個配色之一：填入自訂名稱
會讓整頁崩潰（`themes[color][theme]` 讀取不存在���物件）。介面目前不會產生這種值，但
使用者若手改過設定檔，編輯器應該說明後果。

## What Changes

- 存檔後，編輯器對預覽來源呼叫 `/api/revalidate`，讓外觀設定立刻反映在預覽上。
- 外觀分頁在「設定檔欄位」與「自訂 CSS」之間加上分隔線。
- 「自訂 CSS」標題旁加上驚嘆號，滑鼠停留（或鍵盤聚焦）時浮出提示，說明快取的坑。
- `settings.yaml` 的配色若不在官方 23 色之內，介面明確警告它會讓儀表板崩潰。
- README 增加一節，說明 CDN 快取這個坑與對應措施。

## Impact

- Affected specs: `homepage-appearance`（MODIFIED）
- Affected code: `public/index.html`、`public/app.js`、`public/style.css`、
  `locales/*.ini`、`README.md`、`tests/verify-custom-css.mjs`
- `/api/revalidate` 需要 Homepage 沒有開啟存取驗證；開啟時編輯器會略過這一步，
  並提示使用者按儀表板頁腳的重新整理按鈕。
