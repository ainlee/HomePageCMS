# homepage-appearance

## MODIFIED Requirements

### Requirement: 可編輯 Homepage 的外觀設定

系統 SHALL 提供介面讓使用者編輯 Homepage `settings.yaml` 的視覺欄位，包含主題
（淺色／深色／不指定）、配色、背景圖與其濾鏡、卡片模糊、標題樣式、卡片樣式、
區塊樣式、圖示樣式與字型。

系統 SHALL 以 Homepage 內建的配色清單（23 條色階）提供選項並顯示色票；使用者
選到不在清單中的值時，系統 SHALL 原樣保留該值，不得因此無法存檔。

系統 SHALL 另提供自訂 CSS 的編輯介面，寫入設定目錄中的 `custom.css`。系統
SHALL 提供配色助手，讓使用者以一個種子色產生十個色階（50 到 900）與圖示漸層色，
並可逐階微調。

產生的 CSS SHALL 使用比官方 `.theme-<配色>` 更高優先級的選擇器（例如
`html.theme-<配色>`），因為 `custom.css` 在官方樣式表之前載入，同等優先級會被
官方規則蓋掉。產生的規則 SHALL 只影響被客製化的那一個配色，使用者切換到其它
配色時仍應看到官方的原樣。

#### Scenario: 讀取現有設定

- **WHEN** 使用者開啟「首頁外觀」分頁
- **THEN** 顯示 `settings.yaml` 目前的外觀設定；檔案不存在時顯示空白表單

#### Scenario: 改變配色並存檔

- **WHEN** 使用者選擇另一個配色並存檔
- **THEN** `settings.yaml` 的 `color` 變成新的配色，預覽重新載入並顯示新外觀

#### Scenario: 未建模的欄位保持原樣

- **WHEN** 使用者存檔首頁外觀
- **THEN** `settings.yaml` 裡編輯器沒有建模的欄位（例如 `allowedHosts`、
  `providers`、`layout`）內容不變

#### Scenario: 設定檔被其他程式改動過

- **WHEN** `settings.yaml` 在載入後被其他程式改動，使用者再存檔
- **THEN** 系統拒絕覆寫並提示先重新載入

#### Scenario: 產生自訂配色

- **WHEN** 使用者選一個種子色並產生配色片段
- **THEN** 片段包含 `html.theme-<配色>` 選擇器與十個 `--color-50` 到 `--color-900`
  以及 `--color-logo-start`、`--color-logo-stop`，存檔後寫入 `custom.css`

#### Scenario: 自訂配色不影響其它配色

- **WHEN** 使用者把 `slate` 客製化後存檔，再於 Homepage 切換到 `rose`
- **THEN** `slate` 使用客製化的顏色，`rose` 仍是官方的原樣

#### Scenario: 自訂 CSS 存檔前備份

- **WHEN** 使用者存檔自訂 CSS
- **THEN** 備份目錄出現一份存檔前的 `custom.css`
