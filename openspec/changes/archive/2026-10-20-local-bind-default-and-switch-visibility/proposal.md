# Change: local-bind-default-and-switch-visibility

## Why

兩件事：

1. **監聽位址預設對外開放。** 編輯器能改寫 Homepage 的設定，預設卻綁 `0.0.0.0`，
   等同對整個網路敞開。一般情境沒有區網访问需求，預設只留本機比較合理；要對外
   開放是使用者自己決定的事。
2. **開關看起來是壞的。** `.form-group label { display: block }` 的優先度比 `.switch`
   高，開關的 `<label>` 被蓋成 block，裡面的滑軌（`width/height: 100%` 的 span）塌成
   0×0——所以畫面上只剩一顆白色圓圈，滑軌底色從來沒畫出來，開啟時的綠色也看不
   到。密碼欄位鎖住時也沒有明顯的樣式，眼睛圖示的圖示表達的是「接下來會做什麼」
   而不是「現在是什麼狀態」，看起來像預設開啟。

## What Changes

- 監聽位址的內建預設改為 `127.0.0.1`；`HOST` 或設定檔可以改成 `0.0.0.0` 對外開放。
- `start-editor.bat` 明確設定 `HOST=0.0.0.0`（它本來就在畫面上印區網網址），並在
  視窗中提醒對外開放的風險。
- 開關的滑軌修好（`display` 與尺寸），並在旁邊加上「已啟用／未啟用」文字。
- 密碼欄位鎖住時改用明顯的停用樣式。
- 眼睛圖示改成表達「目前狀態」：遮罩時是打叉的眼睛，明文時是睁開的眼睛。
- 保護已啟用時，密碼欄位的提示文字說明「密碼已設定」，不再是一片空白。

## Impact

- Affected specs: `runtime-settings`（MODIFIED）、`access-control`（MODIFIED）
- Affected code: `server.js`、`public/style.css`、`public/index.html`、`start-editor.bat`

