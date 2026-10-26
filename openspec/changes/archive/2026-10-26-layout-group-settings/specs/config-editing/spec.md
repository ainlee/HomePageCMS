# Spec Delta

## MODIFIED Requirements

### Requirement: 服務分組可管理

系統 SHALL 讓使用者新增、重新命名、刪除與折疊服務分組。群組的版面設定
（圖示、分頁、排列樣式、欄數、標題顯示、初始折疊、等高卡片）SHALL 寫入
settings.yaml 的 layout 區塊、以群組名稱為鍵，並在「版面」分頁管理
（見 layout-editing）。分組對話框 SHALL NOT 提供上游不讀取的欄位
（col-span）；檔案裡既有的 col-span SHALL 以未建模欄位保留，不因此
無法解析設定檔。

#### Scenario: 刪除分組
- **WHEN** 使用者刪除一個含有項目的分組
- **THEN** 系統先要求確認，確認後移除該分組及其所有項目

#### Scenario: 折疊分組
- **WHEN** 使用者點擊分組名稱
- **THEN** 該分組的項目清單收合，箭頭方向改變

#### Scenario: 設定分組寬度會寫入檔案
- **WHEN** services.yaml 的某分組已有 col-span，使用者存檔
- **THEN** 該分組的 col-span 以未建模欄位保留、Homepage 仍能解析整份設定檔；
  介面不提供設定此欄位（群組寬度改由 layout 區塊的 columns 決定）
