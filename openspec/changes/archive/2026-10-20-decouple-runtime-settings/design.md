# Design: decouple-runtime-settings

## 設定來源與優先序

編輯器有兩層設定：部署層（環境變數）與使用層（編輯器設定檔）。

| 設定 | 環境變數 | 內建預設 | 設定檔 |
| --- | --- | --- | --- |
| 連接埠 | `PORT` | `3456` | — |
| Homepage 設定檔目錄 | `HOMEPAGE_CONFIG_PATH` | `<專案>/config` | — |
| 備份目錄 | `HOMEPAGE_BACKUP_PATH` | `<專案>/backups` | — |
| 編輯器設定檔 | `HOMEPAGE_CMS_SETTINGS` | `<設定檔目錄>/.homepage-cms.yaml` | — |
| 預覽網址 | `HOMEPAGE_PREVIEW_URL` | 無（視為尚未設定） | `previewUrl` |

預覽網址的決定順序是**設定檔 → 環境變數 → 尚未設定**。理由是設定檔代表
「這台機器上有人明確設定過」，優先於部署時的通用預設；介面同時顯示目前來源，
避免使用者改了卻不知道為什麼沒生效。刻意不提供內建預設值：全新安裝時使用者
還沒有可指向的 Homepage，猜一個網址只會在預覽區顯示無關的錯誤頁。

## 編輯器設定檔格式

沿用專案既有的慣例：設定就是磁碟上的 YAML，沒有資料庫。

```yaml
previewUrl: https://home.example.com
```

檔名以點開頭（`.homepage-cms.yaml`）是為了不與 Homepage 自己的設定檔混淆；
Homepage 只讀取自己認得的檔名，額外的檔案會被忽略。寫入前先複製一份到備份
目錄，與 services.yaml 的備份行為一致。

## API

| Method | Path | 說明 |
| --- | --- | --- |
| GET | `/api/settings` | 回傳預覽網址、其來源、設定檔目錄、備份目錄、編輯器設定檔路徑 |
| PUT | `/api/settings` | 寫入預覽網址（驗證 http/https），寫入前備份既有設定檔 |

## 前端行為

- 啟動時呼叫 `GET /api/settings` 取得預覽網址；取得之前 iframe 指向 `about:blank`，
  避免空網址讓 iframe 載回編輯器自身。
- 設定對話框顯示預覽網址輸入框、目前來源，以及設定檔與備份位置（唯讀）。
- 儲存成功後更新 `previewUrl` 並重新載入預覽。
- 預覽網址為空時，預覽面板顯示提示與「前往設定」按鈕，維持版面高度不變。

## 環境變數命名

沿用既有的 `HOMEPAGE_` 前綴，但要注意它與 Homepage 自己的環境變數
（例如 `HOMEPAGE_ALLOWED_HOSTS`）同屬一個字首空間。編輯器專用的變數一律以
`HOMEPAGE_CMS_` 或明確語意命名，並在 README 標註兩者不同源。

