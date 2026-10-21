# runtime-settings

## ADDED Requirements

### Requirement: 外觀可設定

系統 SHALL 讓使用者從設定介面選擇配色方案，並 SHALL 將選擇寫入編輯器設定檔的
`theme` 欄位。主題檔目錄的位置 SHALL 可由 `HOMEPAGE_CMS_THEMES_PATH` 指定，
預設為專案目錄下的 `themes`；路徑類設定之優先序 SHALL 為 環境變數 > 編輯器
設定檔 > 內建預設值。

#### Scenario: 在介面選擇配色方案

- **WHEN** 使用者在設定介面選擇配色方案並儲存
- **THEN** `theme` 寫入編輯器設定檔，介面立即套用該配色

#### Scenario: 顯示主題來源

- **WHEN** 使用者開啟設定介面
- **THEN** 介面顯示目前生效的配色方案，以及主題檔目錄的位置

