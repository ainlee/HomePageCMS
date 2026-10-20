# Tasks

## 1. 資產

- [x] 1.1 `vue`、`@mdi/font` 改為 npm 相依
- [x] 1.2 伺服器提供 `/vendor/vue`、`/vendor/mdi`、`/vendor/js-yaml`
- [x] 1.3 頁面改用本機路徑，不留外部網址

## 2. 相依

- [x] 2.1 `js-yaml` 升到修掉高危公告的版本（4.3.2）
- [x] 2.2 `npm audit` 沒有高危公告

## 3. 文件

- [x] 3.1 README 第三方元件表改成說明資產來自 npm

## 4. 驗證

- [x] 4.1 無頭 Chrome 確認頁面沒有任何外部請求，圖示字型可用
- [x] 4.2 `npm test` 三組版面測試通過（20/20、42/42、14/14）

