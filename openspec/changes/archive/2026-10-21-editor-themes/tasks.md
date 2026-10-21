# Tasks

## 1. 主題檔與伺服器

- [x] 1.1 `themes/` 目錄與 `HOMEPAGE_CMS_THEMES_PATH`（預設 `<專案>/themes`）
- [x] 1.2 `GET /api/themes`：回傳全部主題（內建 + 自訂）與其 token
- [x] 1.3 `POST /api/themes`：新增／更新自訂主題，寫入 `themes/<id>.ini`
- [x] 1.4 `DELETE /api/themes/:id`：刪除自訂主題；內建主題拒絕刪除
- [x] 1.5 `PUT /api/settings` 接受 `theme` 欄位
- [x] 1.6 伺服器回傳 `index.html` 時注入目前主題的 CSS 變數（避免重新整理時閃爍）
- [x] 1.7 `GET /api/themes/:id/export` 與 `POST /api/themes/import`：匯出／匯入 INI

## 2. 內建配色

- [x] 2.1 盤點並補齊 token（`--accent-text`、`--info`、`--api`）
- [x] 2.2 四套深色：深空、深海、松林、琥珀
- [x] 2.3 三套淺色：石墨、象牙、薰衣草（次要文字、邊框、徽章、輸入框一併調整）
- [x] 2.4 每個 token 一致套用，預設值保留在 `:root` 作為後備

## 3. 介面

- [x] 3.1 設定介面「外觀」區塊：主題清單與色票預覽、套用
- [x] 3.2 自訂主題編輯器：以目前主題為基底調整每個 token、名稱、儲存
- [x] 3.3 複製 / 刪除 / 匯出 / 匯入 `.ini`
- [x] 3.4 切換主題即時套用，不重新載入頁面

## 4. 驗證與文件

- [x] 4.1 `tests/verify-themes.mjs`：切換、token 生效、自訂主題存檔與重載後保留、
      刪除後消失、內建主題不可刪
- [x] 4.2 對比檢查：每套主題的正文與次要文字對背景至少 4.5:1
- [x] 4.3 `npm test` 既有版面測試不受影響
- [x] 4.4 README 與 AGENTS.md 說明主題檔格式與自訂方式

