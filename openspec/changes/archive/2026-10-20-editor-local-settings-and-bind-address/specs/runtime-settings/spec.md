# runtime-settings

## MODIFIED Requirements

### Requirement: 執行期設定可由環境變數指定

系統 SHALL 以環境變數讀取執行期設定，且 MUST NOT 在程式碼中固定任何特定部署
環境的值。系統 SHALL 提供下列環境變數：`HOST`（監聽位址）、`PORT`（編輯器
連接埠）、`HOMEPAGE_CONFIG_PATH`（Homepage 設定檔目錄）、`HOMEPAGE_BACKUP_PATH`
（備份目錄）、`HOMEPAGE_CMS_SETTINGS`（編輯器自身設定檔）、`HOMEPAGE_PREVIEW_URL`
（預覽目標）。

#### Scenario: 未設定環境變數時使用專案相對的預設值

- **WHEN** 環境中沒有任何上述環境變數
- **THEN** 設定檔目錄為專案目錄下的 `config`、備份目錄為專案目錄下的
  `backups`、編輯器設定檔為專案目錄下的 `cms-settings.yaml`、監聽位址為
  `0.0.0.0`、連接埠為 3456

#### Scenario: 設定檔與備份分別指向不同位置

- **WHEN** 同時設定 `HOMEPAGE_CONFIG_PATH` 與 `HOMEPAGE_BACKUP_PATH`
- **THEN** 讀寫的設定檔位於前者產生的目錄，備份檔位於後者產生的目錄

## ADDED Requirements

### Requirement: 編輯器設定檔放在編輯器自己的目錄

系統 SHALL 將編輯器自身的設定檔放在編輯器目錄，預設為 `cms-settings.yaml`，
而非 Homepage 的設定目錄。系統 MUST NOT 在未經設定的情況下，把編輯器設定寫入
Homepage 的設定目錄。

#### Scenario: 設定檔預設位置

- **WHEN** 未設定 `HOMEPAGE_CMS_SETTINGS`
- **THEN** 編輯器設定檔為專案目錄下的 `cms-settings.yaml`

#### Scenario: 舊位置的設定會被搬遷

- **WHEN** 新的設定檔不存在，但 Homepage 設定目錄下有舊的 `.homepage-cms.yaml`
- **THEN** 伺服器把舊檔搬到新位置，既有設定值不因改預設而消失

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

