# Spec Delta

## MODIFIED Requirements

### Requirement: 執行期設定可由環境變數指定

系統 SHALL 以環境變數讀取執行期設定，且 MUST NOT 在程式碼中固定任何特定
部署環境的值。系統 SHALL 提供下列環境變數：`HOST`（監聽位址）、`PORT`
（編輯器連接埠）、`HOMEPAGE_CONFIG_PATH`（Homepage 設定檔目錄）、
`HOMEPAGE_BACKUP_PATH`（備份目錄）、`HOMEPAGE_CMS_SETTINGS`（編輯器
設定檔）、`HOMEPAGE_PREVIEW_URL`（預覽目標）、`HOMEPAGE_CMS_PASSWORD`
（存取密碼）、`HOMEPAGE_CMS_BASE_PATH`（後台掛載的子路徑前綴，預設空）、
`HOMEPAGE_CMS_REVALIDATE_URL`（存檔後重讀 Homepage 的目標，預設沿用預覽
網址）。

路徑類的設定（Homepage 設定檔目錄、備份目錄、編輯器設定檔）之優先序
SHALL 為 環境變數 > 編輯器設定檔 > 內建預設值；使用者偏好類的設定
（預覽目標、監聽位址）之優先序 SHALL 為 編輯器設定檔 > 環境變數 >
內建預設值。

`HOMEPAGE_CMS_BASE_PATH` 與 `HOMEPAGE_CMS_REVALIDATE_URL` 是部署接線類
設定，SHALL 只由環境變數提供，SHALL NOT 寫進編輯器設定檔。

監聽位址的內建預設值 SHALL 為 `127.0.0.1`：這個工具能改寫 Homepage 的
設定，預設 MUST NOT 對整個網路敞開。對外開放 SHALL 由使用者明確設定。

#### Scenario: 未設定環境變數時使用專案相對的預設值

- **WHEN** 環境中沒有任何上述環境變數
- **THEN** 設定檔目錄為專案目錄下的 `config`、備份目錄為專案目錄下的
  `backups`、編輯器設定檔為專案目錄下的 `cms-settings.yaml`、監聽位址為
  `127.0.0.1`、連接埠為 3456、前綴與重讀目標皆為空（沿用預覽網址）

#### Scenario: 環境變數優先於介面設定的路徑

- **WHEN** 設定了 `HOMEPAGE_CONFIG_PATH`，且介面上把設定檔位置改成別的目錄
- **THEN** 實際使用的仍是環境變數指定的位置，介面顯示該值來自環境變數

#### Scenario: 設定檔與備份分別指向不同位置

- **WHEN** 同時設定 `HOMEPAGE_CONFIG_PATH` 與 `HOMEPAGE_BACKUP_PATH`
- **THEN** 讀寫的設定檔位於前者產生的目錄，備份檔位於後者產生的目錄

#### Scenario: 前綴與重讀目標只走環境變數

- **WHEN** 設定 `HOMEPAGE_CMS_BASE_PATH` 與 `HOMEPAGE_CMS_REVALIDATE_URL`
- **THEN** 兩者由環境變數生效，不寫進編輯器設定檔，介面的路徑偏好設定
  不影響這兩個值
