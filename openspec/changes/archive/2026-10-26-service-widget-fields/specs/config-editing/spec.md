# Spec Delta

## MODIFIED Requirements

### Requirement: 服務可設定狀態小工具

系統 SHALL 讓每個服務選擇狀態追蹤方式與通用參數：widget 型別（無或上游支援的任意型別）、對應值、Docker 主機（server）、排序權重（weight）、Kubernetes 目標（namespace、app、podSelector）。服務 SHALL 可掛多個 widget（複數 widgets），並 SHALL 提供每組 widget 的通用欄位（url、key、container、host、fields、hideErrors）；未建模的欄位（headers、highlight 等）SHALL 保留原樣。未填的欄位 SHALL 不寫入；檔案裡的 widget 型別不在清單中時 SHALL 保留原值並提示。服務 SHALL 可設定 siteMonitor 網址、狀態樣式（statusStyle：dot／basic／未設）與統計展開（showStats：true／false／未設）。

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

#### Scenario: 設定 siteMonitor
- **WHEN** 使用者填入 siteMonitor 網址並存檔
- **THEN** 存檔後的 YAML 對該服務包含 siteMonitor 欄位，未填時不寫入

#### Scenario: 未建模的 widget 型別保留
- **WHEN** 檔案裡的 widget 型別不在清單中（例如上游新版新增的型別）
- **THEN** 該 widget 原樣保留，介面顯示其原值並提示型別未被建模

### Requirement: 書籤分組可管理

系統 SHALL 讓使用者新增、編輯、刪除書籤分組與其中的書籤項目，每個書籤包含名稱、縮寫、連結、說明（description）、圖示（icon）與開啟目標（target）。書籤項目的對話框 SHALL 顯示上述欄位；名稱與連結 SHALL 為必填；縮寫留空時 SHALL 以名稱的前兩個字元補上；說明未填時 Homepage 顯示連結主機名稱；編輯器沒有建模的欄位 SHALL 在存檔時保留。

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

#### Scenario: 設定書籤開啟目標
- **WHEN** 使用者把書籤的 target 設為 _blank 並存檔
- **THEN** 存檔後的 bookmarks.yaml 對該書籤包含 target 欄位，未填時不寫入

