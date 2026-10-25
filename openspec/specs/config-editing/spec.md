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

系統 SHALL 讓使用者新增、重新命名、刪除與折疊服務分組，並支援設定分組的欄位寬度
(col-span)。col-span SHALL 實際寫入設定檔；上游 Homepage 會忽略這個欄位，但不得
因此無法解析設定檔。

#### Scenario: 刪除分組

- **WHEN** 使用者刪除一個含有項目的分組
- **THEN** 系統先要求確認，確認後移除該分組及其所有項目

#### Scenario: 折疊分組

- **WHEN** 使用者點擊分組名稱
- **THEN** 該分組的項目清單收合，箭頭方向改變

#### Scenario: 設定分組寬度會寫入檔案

- **WHEN** 使用者把某個分組的欄位寬度設為 2 並存檔
- **THEN** 設定檔中該分組帶有 `col-span: 2`，且 Homepage 仍能解析整份設定檔

### Requirement: 服務可跨分組拖曳
系統 SHALL 支援以拖曳重新排列服務，並將服務拖曳至其他分組。拖曳 MUST 提供視覺提示以指出放置目標。拖曳 SHALL 在觸控裝置上可用：把手 MUST 以 `touch-action: none` 標記，使把手區的手勢不被瀏覽器攬去做捲動；觸控按壓 SHALL 記錄原始座標，只有手指移動了一段距離之後才真正起拖，讓輕點與長按不被誤判成拖曳。

#### Scenario: 在分組內重新排序
- **WHEN** 使用者將服務拖曳到同一分組的另一個位置
- **THEN** 該服務移到新位置，其餘服務的相對順序不變

#### Scenario: 拖曳至其他分組
- **WHEN** 使用者將服務拖曳到另一個分組並放開
- **THEN** 該服務從原分組移除並加入目標分組

#### Scenario: 觸控拖曳同組排序
- **WHEN** 使用者在手機上按住項目卡把手並拖到同組另一個位置後放開
- **THEN** 該項目移到落點位置，拖曳過程顯示落點指示

#### Scenario: 觸控拖曳跨分組插入
- **WHEN** 使用者在手機上把項目從一個分組拖到另一個分組並放開
- **THEN** 該項目從原分組移除並加入目標分組的落點

#### Scenario: 把手上不發生頁面捲動
- **WHEN** 使用者在把手上按住並垂直滑動
- **THEN** 頁面不捲動，滑動改由拖曳引擎處理

### Requirement: 服務可設定狀態小工具
系統 SHALL 讓每個服務選擇一種狀態追蹤方式：無、本機 Docker 容器、遠端 ICMP ping，或遠端 HTTP API，並記錄對應的值。服務 SHALL 可設定 Docker 主機（server）、排序權重（weight）、Kubernetes 目標（namespace 加 app 或 podSelector），並可掛多個 widget（複數 widgets）。

#### Scenario: 設定容器追蹤
- **WHEN** 使用者將狀態追蹤設為本機 Docker 容器並填入容器名稱
- **THEN** 存檔後的 YAML 對該服務包含 container 欄位

#### Scenario: 設定 Docker 主機
- **WHEN** 使用者填入 Docker 主機名稱（對應 docker.yaml 的主機）
- **THEN** 存檔後的 YAML 對該服務包含 server 欄位，未填時不寫入此欄位

#### Scenario: 設定排序權重
- **WHEN** 使用者填入排序權重數值
- **THEN** 存檔後的 YAML 對該服務包含 weight 欄位，未填時不寫入此欄位

#### Scenario: 設定 Kubernetes 目標
- **WHEN** 使用者填入 namespace 與 app（或自訂 podSelector）
- **THEN** 存檔後的 YAML 對該服務包含對應的 namespace、app 或 podSelector 欄位

#### Scenario: 掛多個 widget
- **WHEN** 使用者為同一服務設定多個 widget
- **THEN** 存檔後的 YAML 對該服務包含複數 widgets 陣列，且原有的單一 widget 寫法仍可讀寫

#### Scenario: 設定 ping 追蹤
- **WHEN** 使用者將狀態追蹤設為遠端 ICMP Ping 並填入 IP 位址
- **THEN** 存檔後的 YAML 對該服務包含 ping 欄位

### Requirement: 書籤分組可管理
系統 SHALL 讓使用者新增、編輯、刪除書籤分組與其中的書籤項目，每個書籤包含名稱、縮寫、連結、說明（description）與圖示（icon）。

書籤分組與書籤項目的新增與編輯 SHALL 使用對話框完成，MUST NOT 使用瀏覽器原生的輸入視窗。書籤項目的對話框 SHALL 同時顯示名稱、連結、縮寫、說明與圖示欄位，連結欄位 SHALL 帶入目前的連結，讓使用者一眼看見連結並可直接修改。名稱與連結 SHALL 為必填；縮寫留空時 SHALL 以名稱的前兩個字元補上。說明未填時 Homepage 顯示連結主機名稱。編輯器沒有建模的欄位 SHALL 在存檔時保留。

#### Scenario: 新增書籤
- **WHEN** 使用者新增書籤並提供名稱、縮寫與連結
- **THEN** 該書籤出現在所選分組中，存檔後寫入 bookmarks.yaml

#### Scenario: 編輯書籤連結
- **WHEN** 使用者按下書籤項目的編輯鈕
- **THEN** 對話框顯示名稱、連結與縮寫，連結欄位帶入目前的連結；使用者修改連結並確認後，書籤列表顯示新的連結，存檔後寫入 bookmarks.yaml

#### Scenario: 設定書籤說明
- **WHEN** 使用者在書籤對話框填入說明並存檔
- **THEN** 存檔後的 bookmarks.yaml 對該書籤包含 description 欄位

#### Scenario: 連結留空
- **WHEN** 使用者在書籤對話框把連結清空後確認
- **THEN** 對話框不關閉並提示需要連結，該書籤的連結不被清空

#### Scenario: 重新命名書籤分組
- **WHEN** 使用者按下書籤分組的編輯鈕並輸入新的名稱
- **THEN** 分組以新名稱顯示，存檔後 bookmarks.yaml 的分組鍵名一併更新

### Requirement: 設定檔位置可由環境變數指定

系統 SHALL 從 HOMEPAGE_CONFIG_PATH 讀取設定檔位置，未設定時使用專案目錄下的 config。首次啟動且設定檔不存在時，系統 SHALL 由範例檔建立初始設定。

#### Scenario: 乾淨環境首次啟動

- **WHEN** 設定路徑下沒有 services.yaml，但專案中有 services.example.yaml
- **THEN** 伺服器以範例檔建立 services.yaml 與 bookmarks.yaml

#### Scenario: 已有設定不被覆寫

- **WHEN** 設定路徑下已存在 services.yaml
- **THEN** 伺服器保留原檔，不以範例檔覆寫

### Requirement: 書籤與服務共用同一套排序與拖曳體驗
系統 SHALL 讓書籤項目與服務項目具備一致的操作體驗：每個項目都有上移、下移
與「移動到別的分組」按鈕，移動到別的分組 SHALL 以對話框引導使用者選擇目標
分組。兩個分頁 SHALL 共用同一套拖曳引擎：分組內重新排序與跨分組拖曳，
拖曳時 SHALL 以視覺指示指出落點位置，落點解析 SHALL 以目前分頁的分組清單
為底，切換分頁時拖曳的可行目標跟著改變。

#### Scenario: 書籤項目上下移動
- **WHEN** 使用者按下書籤項目的上移或下移按鈕
- **THEN** 該書籤與相鄰書籤交換位置，其餘書籤的相對順序不變，第一個與最後
  一個書籤的對應按鈕停用

#### Scenario: 書籤移動到別的分組
- **WHEN** 使用者按下書籤項目的「移動到別的分組」並從對話框選擇另一個書籤
  分組
- **THEN** 該書籤從原分組移除並加入目標分組，顯示移動結果提示

#### Scenario: 拖曳書籤跨分組
- **WHEN** 使用者把一個書籤拖曳到另一個書籤分組並放開
- **THEN** 該書籤從原分組移除並加入目標分組，拖曳過程中目標分組顯示落點指示

#### Scenario: 分頁決定拖曳的可行目標
- **WHEN** 使用者在書籤分頁拖曳一個項目
- **THEN** 落點解析與指示只對書籤分組生效，服務分組不是合法的拖放目標
