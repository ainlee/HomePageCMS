# Tasks

## 1. INI 解析器

- [x] 1.1 `lib/ini.js`：解析 section、`key=value`、`#`/`;` 註解、引號值、UTF-8 BOM
- [x] 1.2 解析錯誤時回報檔名與行號，不要整份檔案默默當空
- [x] 1.3 `tests/verify-ini.mjs`：解析器單元測試（BOM、註解、引號、重複 key、缺漏）

## 2. 語系檔與伺服器

- [x] 2.1 `locales/` 目錄與 `HOMEPAGE_CMS_LOCALES_PATH`（預設 `<專案>/locales`）
- [x] 2.2 `GET /api/i18n`：回傳可用語系清單與目前語系的字串表
- [x] 2.3 `PUT /api/settings` 接受 `locale` 欄位，寫入編輯器設定檔
- [x] 2.4 伺服器錯誤訊息依 `?locale=`／`Accept-Language` 翻譯，回應格式不變
- [x] 2.5 語系檔缺漏 key 時後備到繁中，再缺則顯示 key 並警告
- [x] 2.6 伺服器在回傳 `index.html` 時注入語系表，載入即正確、不閃爍

## 3. 前端

- [x] 3.1 `t(key)` 函式與 Vue 綁定，範本與 `setup()` 回傳同步更新
- [x] 3.2 把 `index.html` 的介面文字全部換成 `t()`
- [x] 3.3 把 `app.js` 的提示訊息、錯誤訊息換成 `t()`
- [x] 3.4 切換語系即時生效並更新 `<html lang>`，不重新載入頁面
- [x] 3.5 設定視窗加入語言選單（含自訂語系檔）

## 4. 翻譯內容

- [x] 4.1 `locales/zh-TW.ini`：把現有繁中文字原樣抽出
- [x] 4.2 `locales/zh-CN.ini`、`locales/ja.ini`、`locales/en.ini`
- [x] 4.3 缺漏 key 檢查（比較各語系 key 集合，缺漏視為失敗）

## 5. 驗證與文件

- [x] 5.1 `tests/verify-i18n.mjs`：切換語系、文字替換、`lang` 屬性、重載後保留
- [x] 5.2 `npm test` 既有版面測試不受影響
- [x] 5.3 README 與 AGENTS.md 說明語系檔格式與擴充方式

