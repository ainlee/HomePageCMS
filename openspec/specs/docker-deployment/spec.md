# docker-deployment Specification

## Purpose
TBD - created by archiving change docker-deployment. Update Purpose after archive.

## Requirements

### Requirement: 後台可容器化部署

系統 SHALL 提供容器化部署：一個 Dockerfile 與一個 compose 範例，把後台
映像建構並與 Homepage 容器放在同一個 stack，共用 Homepage 的設定目錄。
映像 SHALL 以非 root 執行並提供健康檢查。deployed 的映像與 compose
MUST NOT 包含特定部署的網域、路徑或密碼；這些值 SHALL 由環境變數提供。

#### Scenario: 從倉庫建構映像
- **WHEN** 使用者在倉庫執行 docker build
- **THEN** 映像只含執行期需要的檔案（server.js、lib/、public/、locales/、
  themes/、config/*.example.yaml 與 package*.json），不含 node_modules、
  本機設定檔、備份與開發工具產物

#### Scenario: 映像以非 root 執行
- **WHEN** 容器啟動
- **THEN** 行程以非 root 使用者執行，且對 host 屬主為 1000:1000 的設定
  檔案可讀寫

#### Scenario: 雙容器同 stack
- **WHEN** compose 定義 Homepage 與後台兩個服務並啟動
- **THEN** 兩個服務在同一 docker network，後台可經服務名直連 Homepage

### Requirement: 後台資料放在 Homepage 資料夾內的 cms 子目錄

容器部署 SHALL 以 Homepage 設定目錄的 cms/ 子目錄放置後台自身的
資料。後台的編輯器設定檔與備份 SHALL 放在該 cms/ 下；cms/ 對
Homepage 容器 MUST NOT 需要任何新的掛載或設定。

#### Scenario: 掛載設定與資料
- **WHEN** 後台容器啟動
- **THEN** Homepage 設定目錄掛到後台的 HOMEPAGE_CONFIG_PATH，
  其下的 cms/ 子目錄掛到後台，HOMEPAGE_CMS_SETTINGS 與
  HOMEPAGE_BACKUP_PATH 指進 cms/

#### Scenario: 重啟後設定仍在
- **WHEN** 後台容器重新建立或重啟
- **THEN** 編輯器設定檔與備份因掛在 host 的 cms/ 而保留

### Requirement: 後台可掛在同網域的子路徑

系統 SHALL 支援 HOMEPAGE_CMS_BASE_PATH 環境變數，讓後台的路由與前端
請求可掛在指定前綴（例如 /cms）之下。未設定時前綴 SHALL 為空，行為
與掛在根完全相同。設定前綴時，後台 MUST 自己認該前綴，MUST NOT
依賴外部反代層剝除前綴。

#### Scenario: 無前綴維持現行行為
- **WHEN** 未設定 HOMEPAGE_CMS_BASE_PATH
- **THEN** 路由與前端請求掛在根，與現行行為一致

#### Scenario: 掛在 /cms 下
- **WHEN** 設定 HOMEPAGE_CMS_BASE_PATH=/cms
- **THEN** 靜態、vendor 與 /api 路由掛在 /cms 下，前端請求相對
  /cms，直連根路的請求不被誤路由

#### Scenario: 前綴尾端斜線正規化
- **WHEN** 前端帶入 /cms 與 /cms/
- **THEN** 兩者在路由上視為同一前綴，並以統一的方式處理

### Requirement: 存檔後重讀 Homepage 的目標可指定

系統 SHALL 以 HOMEPAGE_CMS_REVALIDATE_URL 指定存檔後重讀 Homepage 的
目標，決定順序 SHALL 為 環境變數 > 預覽網址。未設定時 SHALL 沿用
預覽網址（現行行為）。

#### Scenario: 容器內直連服務名
- **WHEN** 設定 HOMEPAGE_CMS_REVALIDATE_URL 為容器網絡內的服務名網址
- **THEN** 存檔後的重讀請求送該目標，而非公開預覽網址

#### Scenario: 未設定沿用預覽
- **WHEN** 未設定 HOMEPAGE_CMS_REVALIDATE_URL
- **THEN** 重讀目標為預覽網址，行為與現行一致

### Requirement: 單機版與容器版雙模式並存

系統 SHALL 讓單機版（node 直執）與容器版同時存在且讀寫同一批 YAML，
不需資料搬遷。兩版的編輯器設定檔 SHALL 各自獨立；同一份設定檔的
同時寫入 SHALL 由既有 hash 樂觀鎖保護（後存方重載再存）。

#### Scenario: 切換模式無搬遷
- **WHEN** 使用者停止一版、啟動另一版
- **THEN** 兩版讀寫同一批設定檔，現有內容不因切換而遺失

#### Scenario: 雙版本同時寫同一檔案
- **WHEN** 兩版同時開啟並對同一設定檔按儲存
- **THEN** 後存的一方收到衝突（409），重新載入後再存

#### Scenario: 兩版設定檔互不污染
- **WHEN** 單機版與容器版各用各的編輯器設定檔
- **THEN** 一方的預覽網址、監聽位址、語系與主題改動，不影響另一方
