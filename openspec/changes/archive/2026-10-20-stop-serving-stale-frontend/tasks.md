# Tasks

## 1. 不快取

- [x] 1.1 編輯器的靜態檔案以 `Cache-Control: no-store` 提供
- [x] 1.2 確認 index.html、app.js、style.css 都帶上該標頭

## 2. 錯誤面板

- [x] 2.1 `index.html` 提供全域錯誤處理與面板樣式
- [x] 2.2 `app.js` 註冊 `app.config.errorHandler`，接住 Vue 的渲染錯誤

## 3. 驗證

- [x] 3.1 人為製造版本不一致，畫面顯示錯誤面板而不是白屏
- [x] 3.2 `npm test` 三組版面測試通過（20/20、42/42、14/14）

