# runtime-settings

## ADDED Requirements

### Requirement: 語系可設定

系統 SHALL 讓使用者從設定介面選擇介面語系，並 SHALL 將選擇寫入編輯器設定檔的
`locale` 欄位。語系檔目錄的位置 SHALL 可由 `HOMEPAGE_CMS_LOCALES_PATH` 指定，
預設為專案目錄下的 `locales`；路徑類設定之優先序 SHALL 為 環境變數 > 編輯器
設定檔 > 內建預設值。

#### Scenario: 在介面選擇語系

- **WHEN** 使用者在設定介面選擇語言並儲存
- **THEN** `locale` 寫入編輯器設定檔，介面立即改用該語系顯示

#### Scenario: 顯示語系來源

- **WHEN** 使用者開啟設定介面
- **THEN** 介面顯示目前生效的語系，以及語系檔目錄的位置

