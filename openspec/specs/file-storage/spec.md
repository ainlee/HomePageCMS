# file-storage Specification

## Purpose
TBD - created by archiving change fix-settings-save-and-locked-state. Update Purpose after archive.

## Requirements

### Requirement: 寫入檔案不依賴檔案屬性

系統 SHALL 以不依賴目標檔案現有屬性的方式寫入檔案。帶有唯讀或隱藏屬性的檔案
SHALL 仍可被覆寫，且寫入後的檔案 SHALL 可再次被覆寫。

#### Scenario: 覆寫隱藏的設定檔

- **WHEN** 設定檔帶有隱藏屬性，使用者儲存設定
- **THEN** 寫入成功，設定檔的內容被更新，且之後仍可再次儲存

#### Scenario: 備份不會帶走屬性

- **WHEN** 系統建立設定檔的備份
- **THEN** 備份檔可以被覆寫或還原，不會因為繼承了來源檔的隱藏屬性而失敗

#### Scenario: 搬遷後仍可寫入

- **WHEN** 舊位置的設定檔被搬到新位置
- **THEN** 新位置的檔案可以被正常寫入
