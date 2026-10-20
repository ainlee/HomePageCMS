# Change: vendor-frontend-assets

## Why

編輯器的 Vue 與 Material Design Icons 圖示字型都從 CDN 載入（unpkg 與
jsdelivr）。在只有內網、沒有外網，或 CDN 被擋的環境裡，編輯器會開天窗：Vue 沒
載到，整個畫面是空的。這對開源後的使用者是實際會遇到的情況。

## What Changes

- `vue` 與 `@mdi/font` 改為 npm 相依，由伺服器從 `node_modules` 提供，
  頁面不再發出任何外部請求。
- 圖示字型沿用套件本身的 CSS（相對路徑指向同包的 fonts 目錄），
  `/vendor/mdi` 直接對應套件根目錄即可。
- README 的第三方元件表改成說明這些資產隨 npm 安裝提供。
- 順帶把 `js-yaml` 升到修掉高危公告的版本（原型污染與 DoS）。

## Impact

- Affected specs: `frontend-assets`（新增能力）
- Affected code: `package.json`、`package-lock.json`、`server.js`、`public/index.html`、
  `README.md`

