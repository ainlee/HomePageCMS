# Change: editor-local-settings-and-bind-address

## Why

編輯器自己的設定檔目前預設落在 `HOMEPAGE_CONFIG_PATH` 底下，也就是 Homepage 的
設定目錄。那個目錄的擁有者是 Homepage：可能是容器裡的掛載點、NAS 共用資料夾，
甚至會被其他實例共用。把編輯器的設定放進去，語意不對，也讓「編輯器設定」跟
「Homepage 設定」混在同一個檔案樹裡。

另外，監聽位址目前只能用 `HOST` 環境變數指定。使用者明確表示對外開放
`0.0.0.0` 是常見需求，應該做成可設定的選項；但同一個選項也可能被誤開而讓
任何能連到的人都能改寫 Homepage 設定，所以必須在選項旁邊把風險講清楚。

## What Changes

- 編輯器設定檔預設改為專案目錄下的 `cms-settings.yaml`；`HOMEPAGE_CMS_SETTINGS`
  仍可指向別處（例如容器裡的掛載點）。
- 啟動時若新位置沒有設定檔、而舊位置（Homepage 設定目錄）有，一律搬過去，
  既有設定不會因為改預設而消失。
- 監聽位址變成可在介面上設定的項目（`bindAddress`），與其他設定同一套優先序：
  設定檔 > 環境變數 > 內建預設。
- 設定對話框的監聽位址欄位旁加上醒目顏色的小字風險提示，說明對外開放後
  任何能連到的人都能改寫設定。
- 監聽位址變更需要重新啟動才會生效，介面要說明这一点。

## Impact

- Affected specs: `runtime-settings`（MODIFIED）
- Affected code: `server.js`、`public/app.js`、`public/index.html`、`public/style.css`、
  `README.md`、`AGENTS.md`、`.gitignore`
- 遷移：既有的 `config/.homepage-cms.yaml` 會在首次啟動時自動搬到新位置。

