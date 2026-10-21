# editor-i18n

## ADDED Requirements

### Requirement: 介面文字由語系檔提供

系統 SHALL 以語系檔提供編輯器介面文字，MUST NOT 把使用者可見文字硬編在範本或
腳本裡。語系檔 SHALL 以 INI 格式撰寫，內容分為 `[meta]` 與其他 section：
`[meta]` 記錄語言代碼（`code`）與顯示名稱（`name`），其餘 section 以
`key = 文字` 的形式定義各個字串，key 應能看出所屬區域（例如 `topbar.save`）。

系統 SHALL 內建 `zh-TW`、`zh-CN`、`ja`、`en` 四種語系。使用者 SHALL 能把新的
INI 檔放進語系目錄就讓它出現在語言選單中，不必修改程式碼。

#### Scenario: 切換語系立即生效

- **WHEN** 使用者在設定介面把語言改成英文
- **THEN** 介面文字立刻換成英文，頁面不重新載入，編輯中的內容不受影響

#### Scenario: 缺少翻譯時退回繁中

- **WHEN** 選定的語系缺少某個 key
- **THEN** 該字串顯示繁體中文的翻譯；若繁中也没有，才顯示 key 本身，
  並在瀏覽器 console 留下警告

#### Scenario: 頁面語言屬性跟著更新

- **WHEN** 使用者切換語系
- **THEN** `<html lang>` 變成該語系的代碼

#### Scenario: 使用者自行加入語系

- **WHEN** 使用者在語系目錄放入 `fr.ini` 並重新載入編輯器
- **THEN** 語言選單出現法語，選擇後介面以該檔案的文字顯示

### Requirement: 伺服器訊息隨語系翻譯

系統 SHALL 讓伺服器回傳的錯誤訊息隨著語系翻譯，且 SHALL 以 `?locale=` 查詢參數
或 `Accept-Language` 標頭決定使用的語系。回應的結構 MUST NOT 因翻譯而改變：
`error` 欄位仍是可直接顯示的字串。

#### Scenario: 以參數指定語系

- **WHEN** 用戶端以 `?locale=en` 呼叫會回傳錯誤的 API
- **THEN** 回應的錯誤訊息是英文

#### Scenario: 未指定語系

- **WHEN** 用戶端未指定語系
- **THEN** 伺服器以設定檔中的語系回應訊息，沒有設定時使用繁體中文

### Requirement: 語系選擇持久化

系統 SHALL 把使用者選定的語系寫入編輯器設定檔，並在重新啟動後沿用。語系 SHALL
可由環境變數指定，語系檔目錄的位置 SHALL 由環境變數指定，預設為專案目錄下的
`locales`；環境變數 MUST 優先於設定檔。

#### Scenario: 重啟後維持語系

- **WHEN** 使用者選了英文後重新啟動編輯器
- **THEN** 介面仍以英文顯示

#### Scenario: 語系檔目錄可指定

- **WHEN** 設定 `HOMEPAGE_CMS_LOCALES_PATH` 指向別的目錄
- **THEN** 伺服器從該目錄讀取語系檔，而不是專案目錄下的 `locales`

