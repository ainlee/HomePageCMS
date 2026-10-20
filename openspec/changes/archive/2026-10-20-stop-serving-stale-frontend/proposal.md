# Change: stop-serving-stale-frontend

## Why

編輯器是「手寫模板 + 手寫腳本」組成的單頁應用，兩者必須版本一致。瀏覽器若留著
舊的 `index.html` 又拿到新的 `app.js`，模板會引用新版腳本裡已經不存在的綁定，
Vue 渲染時拋錯，整個應用被卸載——使用者看到的是設定視窗與密碼框閃一下，然後
一片空白，完全不知道發生了什麼事。

這不是假設：模板裡的綁定改動之後，實際就發生了。

## What Changes

- 編輯器自己的靜態檔案一律以 `Cache-Control: no-store` 提供，瀏覽器不會留著舊
  的模板或腳本。檔案很小，從本機伺服器取用不成負擔。
- Vue 的渲染錯誤改由 `app.config.errorHandler` 接住（Vue 自己會攔截渲染錯誤，
  `window.onerror` 看不到），畫面顯示錯誤訊息、可能原因與重新載入按鈕，而不是
  白屏。

## Impact

- Affected specs: `frontend-assets`（MODIFIED）
- Affected code: `server.js`、`public/app.js`、`public/index.html`、`public/style.css`

