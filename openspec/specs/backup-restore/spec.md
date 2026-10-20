# 備份與還原

## Purpose

編輯器直接改寫正式設定檔，一旦內容有誤就難以還原。備份機制確保每次寫入前都留有快照，且可以從介面還原。

## Requirements

### Requirement: 寫入前自動備份

系統 SHALL 在覆寫 services.yaml 之前，將原檔複製成帶時間戳的備份檔，存放在 backups 目錄。備份 MUST NOT 覆蓋既有備份。

#### Scenario: 儲存服務設定

- **WHEN** 使用者儲存 services.yaml
- **THEN** 覆寫前先產生一份時間戳命名的備份檔

#### Scenario: 備份檔名不重複

- **WHEN** 同一秒內連續儲存兩次
- **THEN** 兩次產生不同的備份檔，較早的備份不被覆蓋

### Requirement: 備份可列出與還原

系統 SHALL 提供列出備份與還原備份的介面。還原前 MUST 先備份目前的檔案。

#### Scenario: 列出備份

- **WHEN** 使用者開啟備份清單
- **THEN** 依時間由新到舊列出所有備份檔名

#### Scenario: 還原備份

- **WHEN** 使用者選擇一個備份並確認還原
- **THEN** 系統先將目前的設定另存為備份，再以選定的備份覆蓋，且介面重新載入設定

#### Scenario: 還原前先保存現況

- **WHEN** 使用者執行還原
- **THEN** 還原前的設定內容仍保留為一份備份，可再次還原回去

### Requirement: 備份內容不進版本庫

系統 SHALL 將 backups 目錄排除於版本控制之外，避免把執行時產生的歷史快照提交上去。

#### Scenario: 備份目錄被忽略

- **WHEN** 檢查版本控制忽略清單
- **THEN** backups 目錄已被排除
