# config-editing

## MODIFIED Requirements

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

