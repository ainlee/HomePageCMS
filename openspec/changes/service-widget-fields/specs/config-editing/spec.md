# Spec Delta

## MODIFIED Requirements

### Requirement: 服務可設定狀態小工具

系統 SHALL 讓每個服務選擇狀態追蹤方式與通用參數：widget 型別（無或上游支援的
任意型別）、對應值、Docker 主機（server）、排序權重（weight）、Kubernetes
目標（namespace、app、podSelector）。服務 SHALL 可掛多個 widget（複數 widgets），
且 SHALL 提供每組 widget 的通用欄位（url、key、container、host、fields、headers、
highlight、hideErrors）。未填的欄位 SHALL 不寫入；編輯器沒有建模的 widget 型別
SHALL 保留原樣並提示。服務 SHALL 可設定 siteMonitor 網址、狀態樣式（statusStyle：
dot／basic／未設）與統計展開（showStats：true／false／未設）。

#### Scenario: 掛多個 widget
- **WHEN** 使用者為同一服務新增兩組 widget 並存檔
- **THEN** 存檔後的 YAML 對該服務包含複數 widgets 陣列，且原有的單一 widget
  寫法仍可讀寫

#### Scenario: 設定 siteMonitor
- **WHEN** 使用者填入 siteMonitor 網址並存檔
- **THEN** 存檔後的 YAML 對該服務包含 siteMonitor 欄位，未填時不寫入

#### Scenario: 未建模的 widget 型別保留
- **WHEN** 檔案裡的 widget 型別不在清單中（例如上游新版新增的型別）
- **THEN** 該 widget 原樣保留，介面顯示其原值並提示型別未被建模

### Requirement: 書籤分組可管理

系統 SHALL 讓使用者新增、編輯、刪除書籤分組與其中的書籤項目，每個書籤包含
名稱、縮寫、連結、說明（description）、圖示（icon）與開啟目標（target）。
書籤項目的對話框 SHALL 顯示上述欄位；名稱與連結 SHALL 為必填；縮寫留空時
SHALL 以名稱的前兩個字元補上；編輯器沒有建模的欄位 SHALL 在存檔時保留。

#### Scenario: 設定書籤開啟目標
- **WHEN** 使用者把書籤的 target 設為 _blank 並存檔
- **THEN** 存檔後的 bookmarks.yaml 對該書籤包含 target 欄位，未填時不寫入
