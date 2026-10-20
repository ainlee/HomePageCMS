# access-control Specification

## Purpose
TBD - created by archiving change access-control. Update Purpose after archive.

## Requirements

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

### Requirement: 前端提示輸入密碼

系統 SHALL 在載入任何資料之前先確認是否需要密碼。需要密碼而手上沒有密碼時，
系統 SHALL 顯示密碼輸入畫面並讓使用者處於明確的鎖定狀態，MUST NOT 發出注定
失敗的請求，也 MUST NOT 顯示空白或半載入的畫面。密碼輸入畫面 MUST NOT 是死路：
使用者可以取消，取消後畫面維持在鎖定狀態並提供再次輸入的入口。

#### Scenario: 需要密碼時提示

- **WHEN** 編輯器啟動後確認需要存取密碼，且瀏覽器沒有記住的密碼
- **THEN** 畫面顯示密碼輸入框與鎖定狀態的說明，服務列表不會呈現空白

#### Scenario: 輸入密碼後繼續

- **WHEN** 使用者輸入正確密碼並確認
- **THEN** 密碼記在瀏覽器中，編輯器重新載入設定並可繼續編輯

#### Scenario: 取消後仍可再來一次

- **WHEN** 使用者取消密碼輸入
- **THEN** 畫面維持在鎖定狀態，並提供再次輸入密碼的按鈕

#### Scenario: 密碼失效時重新提示

- **WHEN** 瀏覽器記住的密碼不再正確
- **THEN** 系統清除記住的密碼並重新顯示輸入畫面

### Requirement: 設定介面顯示保護狀態

系統 SHALL 在設定對話框顯示存取保護目前的狀態，並說明密碼只能透過
`HOMEPAGE_CMS_PASSWORD` 環境變數設定。

#### Scenario: 顯示未啟用

- **WHEN** 環境中沒有設定密碼
- **THEN** 設定對話框顯示存取保護未啟用，並提醒綁定 `0.0.0.0` 時的風險

#### Scenario: 顯示已啟用

- **WHEN** 環境中已設定密碼
- **THEN** 設定對話框顯示存取保護已啟用

### Requirement: 密碼欄位可切換顯示

系統 SHALL 在密碼輸入欄位提供眼睛圖示，讓使用者切換密碼的明文與遮罩顯示。

#### Scenario: 切換密碼顯示

- **WHEN** 使用者點擊密碼欄位旁的眼睛圖示
- **THEN** 輸入框在明文與遮罩之間切換
