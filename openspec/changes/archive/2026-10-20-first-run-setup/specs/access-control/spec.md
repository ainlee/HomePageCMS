# access-control

## MODIFIED Requirements

### Requirement: 寫入 API 可由密碼保護

系統 SHALL 支援以 `HOMEPAGE_CMS_PASSWORD` 設定存取密碼，也 SHALL 讓使用者在
介面上啟用存取保護並設定密碼。介面設定的密碼 MUST 以雜湊與隨機 salt 儲存，
MUST NOT 以明文儲存。設定後，除 `GET /api/auth` 外的所有 API 都必須提供正確
密碼，否則回應 401；兩者都未設定時，系統 MUST NOT 要求認證。

#### Scenario: 沒有密碼時維持原有行為

- **WHEN** 環境中沒有設定 `HOMEPAGE_CMS_PASSWORD`，且介面上也沒有啟用保護
- **THEN** 所有 API 都不需要認證，編輯器可正常使用

#### Scenario: 介面啟用保護

- **WHEN** 使用者在設定視窗開啟存取保護並輸入密碼後儲存
- **THEN** 設定檔以雜湊儲存該密碼，之後的 API 請求都需要密碼

#### Scenario: 密碼錯誤被拒絕

- **WHEN** 已設定密碼，且請求沒有帶正確的密碼
- **THEN** 伺服器回應 401，且不寫入任何設定檔

#### Scenario: 密碼正確則放行

- **WHEN** 已設定密碼，且請求帶了正確的密碼
- **THEN** 伺服器正常處理該請求

## ADDED Requirements

### Requirement: 密碼欄位可切換顯示

系統 SHALL 在密碼輸入欄位提供眼睛圖示，讓使用者切換密碼的明文與遮罩顯示。

#### Scenario: 切換密碼顯示

- **WHEN** 使用者點擊密碼欄位旁的眼睛圖示
- **THEN** 輸入框在明文與遮罩之間切換

