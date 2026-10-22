# homepage-appearance

## MODIFIED Requirements

### Requirement: 可改用 CDN 或本機字型

系統 SHALL 讓使用者指定字型名稱，SHALL 讓使用者選擇性地指定字型的來源網址。

當來源網址指向樣式表時，系統 SHALL 產生 `@import`；當它指向字型檔
（woff2、woff、ttf 或 otf）時，系統 SHALL 產生 `@font-face`。兩種情況都以字型名稱
作為 `font-family` 的值。

系統 SHALL 在使用者填入來源網址時讀取該網址，找出其中可用的 `@font-face` 家族
名稱並填入名稱欄位。網址指向字型檔時，檔案本身不說自己叫什麼，系統 SHALL 用檔名
推測一個名稱填入（去掉版本與樣式後綴），並說明那是一個推測值，使用者可以改。

系統 MUST NOT 寫出沒有家族名稱的字型規則。來源網址有值而名稱是空的時候，儲存
SHALL 被擋下並說明需要名稱。

讀取來源網址 SHALL 只支援 http 與 https，且讀取的內容 SHALL 有長度上限。

系統 SHALL 產生 `@import` 時把它放在 `custom.css` 的最前面，因為瀏覽器只會
採用樣式表第一條 `@import` 規則。系統 SHALL 在介面上鎖住字型輸入框（但不清除
已填的值），當 `settings.yaml` 的字型指定了 Homepage 的內建字型時，因為那些規則
的優先級較高，使用者選的內建字型仍然生效。

#### Scenario: 只填字型名稱

- **WHEN** 使用者只填了字型名稱
- **THEN** `custom.css` 裡只有 `font-family`，沒有 `@import` 與 `@font-face`

#### Scenario: 填了名稱與網址

- **WHEN** 使用者填了字型名稱與來源網址
- **THEN** `custom.css` 裡有該網址對應的匯入規則，且 `font-family` 用同一個
  字型名稱

#### Scenario: 填了名稱與樣式表網址

- **WHEN** 使用者填了字型名稱與一個樣式表的網址
- **THEN** `custom.css` 裡有 `@import` 且它在檔案最前面，`font-family` 用同一個
  字型名稱

#### Scenario: 填了名稱與字型檔網址

- **WHEN** 使用者填了字型名稱與一個字型檔的網址
- **THEN** `custom.css` 裡有 `@font-face`，其 `src` 指向該字型檔，
  `font-family` 用同一個字型名稱

#### Scenario: 只填網址時查出字型名稱

- **WHEN** 使用者填了一個含有 `@font-face` 的樣式表網址
- **THEN** 介面從樣式表裡找出家族名稱並填入名稱欄位，並顯示找到的是哪一個字型

#### Scenario: 字型檔用檔名猜名稱

- **WHEN** 使用者填了一個字型檔的網址
- **THEN** 介面以檔名猜一個家族名稱填入（例如 `Cubic_11_1.100_R.woff2` 猜成
  `Cubic 11`），並說明那是推測值

#### Scenario: 有網址但沒有名稱時擋下存檔

- **WHEN** 使用者填了來源網址但名稱是空的
- **THEN** 儲存被擋下並提示需要字型名稱，`custom.css` 不被寫入壞掉的規則

#### Scenario: 選了內建字型時輸入框鎖住

- **WHEN** 使用者在下拉選了 `plex`
- **THEN** 字型輸入框不能編輯，但已填的值仍在
