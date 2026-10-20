# runtime-settings Specification

## Purpose

執行期設定指編輯器啟動時決定「自己在哪裡、預覽什麼」的設定。把它們放進環境變數
與編輯器自己的設定檔，框架就只認得相對路徑，任何環境的值都由使用者提供，
程式碼裡不會出現特定部署的網域或路徑。

## Requirements

### Requirement: 執行期設定可由環境變數指定

系統 SHALL 以環境變數讀取執行期設定，且 MUST NOT 在程式碼中固定任何特定部署
環境的值。系統 SHALL 提供下列環境變數：`HOST`（監聽位址）、`PORT`（編輯器
連接埠）、`HOMEPAGE_CONFIG_PATH`（Homepage 設定檔目錄）、`HOMEPAGE_BACKUP_PATH`
（備份目錄）、`HOMEPAGE_CMS_SETTINGS`（編輯器設定檔）、`HOMEPAGE_PREVIEW_URL`
（預覽目標）、`HOMEPAGE_CMS_PASSWORD`（存取密碼）。

路徑類的設定（Homepage 設定檔目錄、備份目錄、編輯器設定檔）之優先序 SHALL 為
環境變數 > 編輯器設定檔 > 內建預設值；使用者偏好類的設定（預覽目標、監聽位址）
之優先序 SHALL 為編輯器設定檔 > 環境變數 > 內建預設值。

#### Scenario: 未設定環境變數時使用專案相對的預設值

- **WHEN** 環境中沒有任何上述環境變數
- **THEN** 設定檔目錄為專案目錄下的 `config`、備份目錄為專案目錄下的
  `backups`、編輯器設定檔為專案目錄下的 `cms-settings.yaml`、監聽位址為
  `0.0.0.0`、連接埠為 3456

#### Scenario: 環境變數優先於介面設定的路徑

- **WHEN** 設定了 `HOMEPAGE_CONFIG_PATH`，且介面上把設定檔位置改成別的目錄
- **THEN** 實際使用的仍是環境變數指定的位置，介面顯示該值來自環境變數

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

### Requirement: 編輯器設定檔放在編輯器自己的目錄

系統 SHALL 將編輯器自身的設定檔放在編輯器目錄，預設為 `cms-settings.yaml`，
而非 Homepage 的設定目錄。系統 MUST NOT 在未經設定的情況下，把編輯器設定寫入
Homepage 的設定目錄。設定檔的位置可由介面指定，指定後重新啟動仍須讀得到。

#### Scenario: 設定檔預設位置

- **WHEN** 未設定 `HOMEPAGE_CMS_SETTINGS`
- **THEN** 編輯器設定檔為專案目錄下的 `cms-settings.yaml`

#### Scenario: 舊位置的設定會被搬遷

- **WHEN** 新的設定檔不存在，但 Homepage 設定目錄下有舊的 `.homepage-cms.yaml`
- **THEN** 伺服器把舊檔搬到新位置，既有設定值不因改預設而消失

#### Scenario: 設定檔位置改變後仍找得到

- **WHEN** 使用者把編輯器設定檔的位置改到別的路徑
- **THEN** 伺服器在預設位置留下指向新路徑的記錄，重新啟動後仍從新路徑讀取

#### Scenario: 設定檔不存在時不建立空檔

- **WHEN** 新舊位置都沒有設定檔
- **THEN** 伺服器不建立空設定檔，直到使用者第一次儲存設定

### Requirement: 監聽位址可設定且附風險提示

系統 SHALL 讓使用者在設定介面選擇監聽位址，並 SHALL 在該選項旁以醒目顏色的
小字標示風險：對外開放時，任何能連到該位址的人都能改寫 Homepage 設定。
系統 SHALL 說明監聽位址的變更需要重新啟動才會生效。

#### Scenario: 設定介面顯示風險提示

- **WHEN** 使用者開啟設定對話框
- **THEN** 監聽位址欄位旁顯示醒目顏色的風險提示文字，說明對外開放的後果

#### Scenario: 設定監聽位址

- **WHEN** 使用者把監聽位址改為 `127.0.0.1` 並儲存
- **THEN** 設定寫入編輯器設定檔，介面說明需重新啟動才會生效

#### Scenario: 顯示目前生效的監聽位址與來源

- **WHEN** 使用者開啟設定對話框
- **THEN** 介面顯示目前實際生效的監聽位址，以及它來自設定檔、環境變數或內建
  預設值
