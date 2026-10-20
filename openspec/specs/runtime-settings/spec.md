# runtime-settings Specification

## Purpose
TBD - created by archiving change decouple-runtime-settings. Update Purpose after archive.

## Requirements

### Requirement: 執行期設定可由環境變數指定

系統 SHALL 以環境變數讀取執行期設定，且 MUST NOT 在程式碼中固定任何特定部署
環境的值。系統 SHALL 提供下列環境變數：`PORT`（編輯器連接埠）、
`HOMEPAGE_CONFIG_PATH`（Homepage 設定檔目錄）、`HOMEPAGE_BACKUP_PATH`
（備份目錄）、`HOMEPAGE_CMS_SETTINGS`（編輯器自身設定檔）、
`HOMEPAGE_PREVIEW_URL`（預覽目標）。

#### Scenario: 未設定環境變數時使用專案相對的預設值

- **WHEN** 環境中沒有任何上述環境變數
- **THEN** 設定檔目錄為專案目錄下的 `config`、備份目錄為專案目錄下的
  `backups`、編輯器設定檔位於設定檔目錄下、連接埠為 3456

#### Scenario: 設定檔與備份分別指向不同位置

- **WHEN** 同時設定 `HOMEPAGE_CONFIG_PATH` 與 `HOMEPAGE_BACKUP_PATH`
- **THEN** 讀寫的設定檔位於前者產生的目錄，備份檔位於後者產生的目錄

### Requirement: 預覽網址由執行期設定決定

系統 SHALL 依「編輯器設定檔 > `HOMEPAGE_PREVIEW_URL`」的順序決定預覽網址，兩者
皆未提供時視為尚未設定，並 SHALL 提供介面讓使用者修改，修改後寫回編輯器設定檔。

#### Scenario: 首次載入取得預覽網址

- **WHEN** 使用者開啟編輯器
- **THEN** 預覽面板載入執行期設定的預覽網址，而非程式碼中固定的值

#### Scenario: 介面修改預覽網址

- **WHEN** 使用者在設定介面輸入新的預覽網址並儲存
- **THEN** 設定寫入編輯器設定檔，預覽面板重新載入新網址

#### Scenario: 顯示設定來源

- **WHEN** 使用者開啟設定介面
- **THEN** 介面顯示預覽網址目前的來源（設定檔、環境變數或尚未設定），
  以及設定檔位置與備份位置

#### Scenario: 預覽網址尚未設定

- **WHEN** 執行期設定沒有可用的預覽網址
- **THEN** 預覽面板不載入任何網址，顯示提示使用者設定，而不是載入空白頁

#### Scenario: 拒絕不合法網址

- **WHEN** 使用者輸入的預覽網址不是 http 或 https 開頭的網址
- **THEN** 系統拒絕儲存並顯示錯誤訊息

### Requirement: 備份目錄可指定

系統 SHALL 將備份寫入 `HOMEPAGE_BACKUP_PATH` 指定的目錄，未設定時使用專案
目錄下的 `backups`。備份 MUST NOT 覆寫既有備份。

#### Scenario: 備份寫入自訂目錄

- **WHEN** 設定 `HOMEPAGE_BACKUP_PATH` 為容器內的掛載點並儲存設定
- **THEN** 備份檔出現在該目錄，而非專案目錄下的 `backups`

### Requirement: 執行期設定可查詢與修改

系統 SHALL 提供 `GET /api/settings` 回傳目前的預覽網址、其來源、設定檔位置與
備份位置，並提供 `PUT /api/settings` 寫入預覽網址。寫入前 MUST 先備份既有的
編輯器設定檔。

#### Scenario: 查詢目前設定

- **WHEN** 用戶端呼叫 `GET /api/settings`
- **THEN** 回應包含預覽網址、預覽網址來源、設定檔目錄、備份目錄與編輯器
  設定檔路徑

#### Scenario: 寫入前備份編輯器設定檔

- **WHEN** 編輯器設定檔已存在且使用者儲存新的預覽網址
- **THEN** 覆寫前先在備份目錄產生一份帶時間戳的設定檔備份
