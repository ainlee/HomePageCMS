# Change: access-control

## Why

編輯器沒有任何存取控制，而預設綁 `0.0.0.0`：同一個網段裡的任何人只要知道
位址與連接埠，就能開啟編輯器、改寫 Homepage 設定、甚至把設定檔寫成任意內容。
「對外開放」是常見需求，所以綁定位址不該被拿掉；但寫入 API 應該要有開關。

## What Changes

- 新增 `HOMEPAGE_CMS_PASSWORD` 環境變數：設定後，所有 `/api/*`（除了
  `/api/auth`）都需要密碼；未設定時維持目前的行為。
- 密碼以 `X-CMS-Password` 標頭送出，伺服器以定時安全的比較驗證。
- 前端在收到 401 時跳出密碼輸入框，輸入後記在瀏覽器裡並重試。
- 設定對話框顯示「存取保護」目前的狀態（未啟用／已啟用），並提示密碼只能由
  環境變數設定。

## Impact

- Affected specs: `access-control`（新增能力）
- Affected code: `server.js`、`public/app.js`、`public/index.html`、`public/style.css`、
  `README.md`、`AGENTS.md`

