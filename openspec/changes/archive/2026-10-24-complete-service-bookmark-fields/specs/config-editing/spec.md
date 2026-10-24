# Spec Delta

## MODIFIED Requirements

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

