# homepage-appearance Specification

## Purpose
讓使用者在編輯器裡調整 Homepage 儀表板本身的外觀。Homepage 沒有佈景檔，
能改的是設定目錄中 `settings.yaml` 的視覺欄位；這份檔案過去只能離開編輯器
手動修改，而且改完沒有即時預覽。這個能力把這些欄位變成表單，存檔後預覽立刻
反映新的外觀。

## Requirements

### Requirement: 可編輯 Homepage 的外觀設定

系統 SHALL 提供介面讓使用者編輯 Homepage `settings.yaml` 的視覺欄位，包含主題
（淺色／深色／不指定）、配色、背景圖與其濾鏡、卡片模糊、標題樣式、卡片樣式、
區塊樣式、圖示樣式與字型。

系統 SHALL 以 Homepage 內建的配色清單（23 條色階）提供選項並顯示色票；使用者
選到不在清單中的值時，系統 SHALL 原樣保留該值，不得因此無法存檔，並 SHALL 明確
告知使用者該值不在 Homepage 的內建清單中，套用後會讓儀表板無法顯示。

系統 SHALL 另提供自訂 CSS 的編輯介面，寫入設定目錄中的 `custom.css`。系統
SHALL 提供配色助手，讓使用者以一個種子色產生十個色階（50 到 900）與圖示漸層色，
並可逐階微調。

產生的 CSS SHALL 使用比官方 `.theme-<配色>` 更高優先級的選擇器（例如
`html.theme-<配色>`），因為 `custom.css` 在官方樣式表之前載入，同等優先級會被
官方規則蓋掉。產生的規則 SHALL 只影響被客製化的那一個配色，使用者切換到其它
配色時仍應看到官方的原樣。

介面 SHALL 把「設定檔欄位」與「自訂 CSS」分成兩個區塊，區塊之間有分隔線。
「自訂 CSS」區塊的標題旁 SHALL 有一個可聚焦的提示標記，滑鼠停留或鍵盤聚焦時
浮出說明，內容為儀表板可能快取 `custom.css`、改完樣式需要重新載入頁面。

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

#### Scenario: 配色不在官方清單中

- **WHEN** `settings.yaml` 的 `color` 不是 Homepage 內建的配色
- **THEN** 介面說明該值不在官方清單中、套用後儀表板會無法顯示，且不擅自改掉它

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

#### Scenario: 區塊之間有分隔線

- **WHEN** 使用者看著「首頁外觀」分頁
- **THEN** 「設定檔欄位」與「自訂 CSS」之間有一條分隔線

#### Scenario: 快取提示

- **WHEN** 使用者把滑鼠停在「自訂 CSS」標題旁的驚嘆號上
- **THEN** 浮出提示，說明儀表板可能快取 `custom.css`、改完需要重新載入頁面

### Requirement: 自訂 CSS 要能即時送到瀏覽器

系統 SHALL 讓存檔後的自訂 CSS 立即到達瀏覽器。部署在快取代理（CDN）之後時，
系統 SHALL 確保 `/api/config/custom.css` 不被該代理快取；否則使用者改完樣式，
儀表板仍會套用舊的樣式長達數小時。

#### Scenario: 改完樣式立刻生效

- **WHEN** 使用者存檔自訂 CSS 之後重新載入儀表板
- **THEN** 儀表板使用新的樣式，而不是先前被快取的舊版本

### Requirement: 存檔前備份

系統 SHALL 在覆寫 `settings.yaml` 前把原檔複製到備份目錄，並 SHALL 以暫存檔再改名
的方式寫入，避免寫壞檔案或帶著舊屬性。

#### Scenario: 備份產生

- **WHEN** 使用者存檔首頁外觀
- **THEN** 備份目錄出現一份存檔前的 `settings.yaml`

### Requirement: 存檔後預覽立刻反映外觀

系統 SHALL 在存檔外觀設定後，讓預覽立刻顯示新的外觀。

Homepage 的 dashboard 資料在伺服器行程的記憶體中快取，只有 `/api/revalidate` 會
清除，因此系統 SHALL 在存檔後對預覽來源呼叫該端點。若預覽來源無法呼叫該端點
（例如 Homepage 開啟了存取驗證），系統 SHALL 略過這一步並提示使用者按儀表板
頁腳的重新整理按鈕。

#### Scenario: 存檔後預覽更新

- **WHEN** 使用者改變配色並存檔
- **THEN** 預覽顯示新的配色，不需要手動重新整理

#### Scenario: 預覽來源需要驗證

- **WHEN** 預覽來源的 `/api/revalidate` 回應不是成功
- **THEN** 存檔仍然完成，介面提示使用者按儀表板頁腳的重新整理按鈕
