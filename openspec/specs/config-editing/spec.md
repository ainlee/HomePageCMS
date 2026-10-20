# 設定編輯

## Purpose

編輯區負責讀取與修改 Homepage 的 YAML 設定。服務與書籤分成兩個分頁，服務分組可拖曳排序、跨分組移動，並為每個服務設定狀態小工具。存檔時直接寫回 YAML，使 Homepage 立刻套用。

## Requirements

### Requirement: 以 YAML 為唯一資料來源

系統 SHALL 以 Homepage 的 YAML 格式讀寫設定檔，編輯器與 Homepage 直接共用同一份檔案。系統 MUST NOT 使用另一套私有資料格式。

#### Scenario: 載入設定

- **WHEN** 編輯器啟動
- **THEN** 從設定路徑讀取 services.yaml 與 bookmarks.yaml，並以分組與項目呈現

#### Scenario: 儲存後寫回 YAML

- **WHEN** 使用者按下儲存
- **THEN** 產生與 Homepage 相同格式的 YAML 並寫回設定檔，預覽重新載入

### Requirement: 服務分組可管理

系統 SHALL 讓使用者新增、重新命名、刪除與折疊服務分組，並支援設定分組的欄位寬度 (col-span)。

#### Scenario: 刪除分組

- **WHEN** 使用者刪除一個含有項目的分組
- **THEN** 系統先要求確認，確認後移除該分組及其所有項目

#### Scenario: 折疊分組

- **WHEN** 使用者點擊分組名稱
- **THEN** 該分組的項目清單收合，箭頭方向改變

### Requirement: 服務可跨分組拖曳

系統 SHALL 支援以拖曳重新排列服務，並將服務拖曳至其他分組。拖曳 MUST 提供視覺提示以指出放置目標。

#### Scenario: 在分組內重新排序

- **WHEN** 使用者將服務拖曳到同一分組的另一個位置
- **THEN** 該服務移到新位置，其餘服務的相對順序不變

#### Scenario: 拖曳至其他分組

- **WHEN** 使用者將服務拖曳到另一個分組並放開
- **THEN** 該服務從原分組移除並加入目標分組

### Requirement: 服務可設定狀態小工具

系統 SHALL 讓每個服務選擇一種狀態追蹤方式：無、本機 Docker 容器、遠端 ICMP ping，或遠端 HTTP API，並記錄對應的值。

#### Scenario: 設定容器追蹤

- **WHEN** 使用者將狀態追蹤設為本機 Docker 容器並填入容器名稱
- **THEN** 存檔後的 YAML 對該服務包含 container 欄位

#### Scenario: 設定 ping 追蹤

- **WHEN** 使用者將狀態追蹤設為遠端 ICMP Ping 並填入 IP 位址
- **THEN** 存檔後的 YAML 對該服務包含 ping 欄位

### Requirement: 書籤分組可管理

系統 SHALL 讓使用者新增、編輯、刪除書籤分組與其中的書籤項目，每個書籤包含名稱、縮寫與連結。

#### Scenario: 新增書籤

- **WHEN** 使用者新增書籤並提供名稱、縮寫與連結
- **THEN** 該書籤出現在所選分組中，存檔後寫入 bookmarks.yaml

### Requirement: 設定檔位置可由環境變數指定

系統 SHALL 從 HOMEPAGE_CONFIG_PATH 讀取設定檔位置，未設定時使用專案目錄下的 config。首次啟動且設定檔不存在時，系統 SHALL 由範例檔建立初始設定。

#### Scenario: 乾淨環境首次啟動

- **WHEN** 設定路徑下沒有 services.yaml，但專案中有 services.example.yaml
- **THEN** 伺服器以範例檔建立 services.yaml 與 bookmarks.yaml

#### Scenario: 已有設定不被覆寫

- **WHEN** 設定路徑下已存在 services.yaml
- **THEN** 伺服器保留原檔，不以範例檔覆寫
