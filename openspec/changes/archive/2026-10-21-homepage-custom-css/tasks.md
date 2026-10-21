# Tasks

## 1. 後端

- [x] 1.1 `lib/homepage-appearance.js` 新增色階產生器（種子色 → 50..900 + logo 色）
- [x] 1.2 `GET /api/homepage-custom-css` 讀出 `custom.css` 內容與雜湊
- [x] 1.3 `PUT /api/homepage-custom-css` 備份後寫回，內容未變時不寫檔

## 2. 介面

- [x] 2.1 首頁外觀分頁新增自訂 CSS 文字區與儲存
- [x] 2.2 配色助手：選配色與種子色、產生片段、色票預覽

## 3. 測試

- [x] 3.1 無頭 Chrome 測試確認產生的 CSS 寫進 custom.css 且格式正確
- [x] 3.2 測試結束後把 custom.css 還原
