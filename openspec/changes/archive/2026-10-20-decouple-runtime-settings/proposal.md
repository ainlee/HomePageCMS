# Change: decouple-runtime-settings

## Why

編輯器目前把部署環境的值寫死在程式碼裡：預覽目標固定為某個特定網域
（`public/app.js`），備份目錄固定在專案目錄下（`server.js`）。這些值在
開發者自己的環境才正確，其他使用者拿到程式碼後無法改成自己的 Homepage
位置，也無法把備份導到別的磁碟或掛載點。

開源前必須讓「框架」與「環境配置」分開：框架只認得相對路徑與環境變數，
環境值一律由使用者提供。

## What Changes

- 移除程式碼中寫死的預覽網址，改由後端提供目前設定。
- 新增 `HOMEPAGE_PREVIEW_URL`：預覽目標的部署層級預設值。
- 新增 `HOMEPAGE_BACKUP_PATH`：備份目錄，不再固定在專案目錄下。
- 新增 `HOMEPAGE_CMS_SETTINGS`：編輯器自身設定檔（目前存放預覽網址）的位置。
- 新增 `GET /api/settings` 與 `PUT /api/settings`，讓使用者能在介面上設定預覽
  網址並立即套用，且能查詢目前的設定檔、備份位置。
- 設定值來源有序：CMS 設定檔 > 環境變數 > 內建預設值，介面會顯示目前來源。
- README、AGENTS.md、CLAUDE.md 補上完整的環境變數說明；`.gitignore` 排除
  編輯器自身的設定檔。

## Impact

- Affected specs: `runtime-settings`（新增能力）
- Affected code: `server.js`、`public/app.js`、`public/index.html`、
  `public/style.css`、`README.md`、`AGENTS.md`、`CLAUDE.md`、`.gitignore`
- 不在本次範圍：存取權限（認證）、YAML 往返保真（未知欄位保留）、
  第三方資產改為本機供應。

