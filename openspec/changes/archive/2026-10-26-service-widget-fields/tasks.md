# Tasks

## 1. 後端與資料

- [x] 1.1 由上游 src/widgets 目錄產生 public/widget-types.js 型別清單
- [x] 1.2 server.js 把型別清單注入頁面（window.__WIDGET_TYPES__）

## 2. 前端

- [x] 2.1 widget 型別下拉換成完整清單；未建模型別的原值保留
- [x] 2.2 多組 widget 的讀寫（複數 widgets 陣列）與新增／刪除／排序 UI
- [x] 2.3 每組 widget 的通用欄位（url、key、container、host、fields、headers、
      highlight、hideErrors）
- [x] 2.4 服務欄位補上 siteMonitor、statusStyle、showStats
- [x] 2.5 圖示前綴（si-、sh-、自訂顏色）與 CDN 預覽
- [x] 2.6 書籤項目補上 target 欄位
- [x] 2.7 style.css 與四個語系檔

## 3. 驗證

- [x] 3.1 tests/verify-service-widget-fields.mjs：多 widget、通用欄位、未建模
      型別保留、siteMonitor、statusStyle、showStats、bookmarks target
- [x] 3.2 npm test 全數通過
