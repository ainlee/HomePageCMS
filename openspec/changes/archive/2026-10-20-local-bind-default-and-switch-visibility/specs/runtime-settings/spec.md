# runtime-settings

## MODIFIED Requirements

### Requirement: 執行期設定可由環境變數指定

系統 SHALL 以環境變數讀取執行期設定，且 MUST NOT 在程式碼中固定任何特定部署
環境的值。系統 SHALL 提供下列環境變數：`HOST`（監聽位址）、`PORT`（編輯器
連接埠）、`HOMEPAGE_CONFIG_PATH`（Homepage 設定檔目錄）、`HOMEPAGE_BACKUP_PATH`
（備份目錄）、`HOMEPAGE_CMS_SETTINGS`（編輯器設定檔）、`HOMEPAGE_PREVIEW_URL`
（預覽目標）、`HOMEPAGE_CMS_PASSWORD`（存取密碼）。

路徑類的設定（Homepage 設定檔目錄、備份目錄、編輯器設定檔）之優先序 SHALL 為
環境變數 > 編輯器設定檔 > 內建預設值；使用者偏好類的設定（預覽目標、監聽位址）
之優先序 SHALL 為 編輯器設定檔 > 環境變數 > 內建預設值。

監聽位址的內建預設值 SHALL 為 `127.0.0.1`：這個工具能改寫 Homepage 的設定，
預設 MUST NOT 對整個網路敞開。對外開放 SHALL 由使用者明確設定。

#### Scenario: 未設定環境變數時使用專案相對的預設值

- **WHEN** 環境中沒有任何上述環境變數
- **THEN** 設定檔目錄為專案目錄下的 `config`、備份目錄為專案目錄下的
  `backups`、編輯器設定檔為專案目錄下的 `cms-settings.yaml`、監聽位址為
  `127.0.0.1`、連接埠為 3456

#### Scenario: 環境變數優先於介面設定的路徑

- **WHEN** 設定了 `HOMEPAGE_CONFIG_PATH`，且介面上把設定檔位置改成別的目錄
- **THEN** 實際使用的仍是環境變數指定的位置，介面顯示該值來自環境變數

#### Scenario: 設定檔與備份分別指向不同位置

- **WHEN** 同時設定 `HOMEPAGE_CONFIG_PATH` 與 `HOMEPAGE_BACKUP_PATH`
- **THEN** 讀寫的設定檔位於前者產生的目錄，備份檔位於後者產生的目錄

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

