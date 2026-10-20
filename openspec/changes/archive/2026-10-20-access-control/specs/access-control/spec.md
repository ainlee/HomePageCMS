# access-control

## ADDED Requirements

### Requirement: 寫入 API 可由密碼保護

系統 SHALL 支援以 `HOMEPAGE_CMS_PASSWORD` 設定存取密碼。設定後，除
`GET /api/auth` 外的所有 API 都必須提供正確密碼，否則回應 401。未設定密碼時，
系統 MUST NOT 要求認證。

#### Scenario: 沒有密碼時維持原有行為

- **WHEN** 環境中沒有設定 `HOMEPAGE_CMS_PASSWORD`
- **THEN** 所有 API 都不需要認證，編輯器可正常使用

#### Scenario: 密碼錯誤被拒絕

- **WHEN** 已設定密碼，且請求沒有帶正確的密碼
- **THEN** 伺服器回應 401，且不寫入任何設定檔

#### Scenario: 密碼正確則放行

- **WHEN** 已設定密碼，且請求帶了正確的密碼
- **THEN** 伺服器正常處理該請求

### Requirement: 前端提示輸入密碼

系統 SHALL 在收到 401 時顯示密碼輸入畫面，讓使用者輸入密碼後繼續操作，
並記住該次輸入以免每個動作都要重打。

#### Scenario: 需要密碼時提示

- **WHEN** 編輯器載入後第一個 API 請求回應 401
- **THEN** 畫面顯示密碼輸入框，提示使用者輸入

#### Scenario: 輸入密碼後繼續

- **WHEN** 使用者輸入正確密碼並確認
- **THEN** 密碼記在瀏覽器中，編輯器重新載入設定並可繼續編輯

### Requirement: 設定介面顯示保護狀態

系統 SHALL 在設定對話框顯示存取保護目前的狀態，並說明密碼只能透過
`HOMEPAGE_CMS_PASSWORD` 環境變數設定。

#### Scenario: 顯示未啟用

- **WHEN** 環境中沒有設定密碼
- **THEN** 設定對話框顯示存取保護未啟用，並提醒綁定 `0.0.0.0` 時的風險

#### Scenario: 顯示已啟用

- **WHEN** 環境中已設定密碼
- **THEN** 設定對話框顯示存取保護已啟用

