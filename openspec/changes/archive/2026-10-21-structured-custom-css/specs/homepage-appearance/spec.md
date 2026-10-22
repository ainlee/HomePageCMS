# homepage-appearance

## MODIFIED Requirements

### Requirement: 可編輯 Homepage 的外觀設定

系統 SHALL 提供介面讓使用者編輯 Homepage `settings.yaml` 的視覺欄位，包含主題
（淺色／深色／不指定）、配色、背景圖與其濾鏡、卡片模糊、標題樣式、卡片樣式、
區塊樣式、圖示樣式與字型。

系統 SHALL 以 Homepage 內建的配色清單（23 條色階）提供選項並顯示色票；使用者
選到不在清單中的值時，系統 SHALL 原樣保留該值，不得因此無法存檔，並 SHALL 明確
告知使用者該值不在 Homepage 的內建清單中，套用後會讓儀表板無法顯示。

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

#### Scenario: 區塊之間有分隔線

- **WHEN** 使用者看著「首頁外觀」分頁
- **THEN** 「設定檔欄位」與「自訂 CSS」之間有一條分隔線

#### Scenario: 快取提示

- **WHEN** 使用者把滑鼠停在「自訂 CSS」標題旁的驚嘆號上
- **THEN** 浮出提示，說明儀表板可能快取 `custom.css`、改完需要重新載入頁面

#### Scenario: 產生自訂配色

- **WHEN** 使用者選一個種子色
- **THEN** 色階立即重新計算，文字區顯示該配色的 `html.theme-<配色>` 規則與十個
  `--color-50` 到 `--color-900`，以及 `--color-logo-start`、`--color-logo-stop`

#### Scenario: 自訂配色不影響其它配色

- **WHEN** 使用者把 `slate` 客製化後存檔，再於 Homepage 切換到 `rose`
- **THEN** `slate` 使用客製化的顏色，`rose` 仍是官方的原樣

#### Scenario: 自訂 CSS 存檔前備份

- **WHEN** 使用者存檔自訂 CSS
- **THEN** 備份目錄出現一份存檔前的 `custom.css`

## ADDED Requirements

### Requirement: 每個配色的客製化各自獨立

系統 SHALL 把每個配色的客製化存成 `custom.css` 裡獨立的區塊，區塊之間不得互相
影響。切換配色時，系統 SHALL 讀出該配色的區塊並顯示其內容；沒有客製化的配色
SHALL 顯示以官方原色為種子產生的樣式作為預覽，但不得因此就寫進檔案。

系統 SHALL 顯示兩個色票：該配色的官方原色（唯讀）與使用者選的種子色。種子色
改變時，色階 SHALL 立即重新計算。

#### Scenario: 兩個配色各自客製化

- **WHEN** 使用者先客製化 `rose`、再客製化 `slate`
- **THEN** `custom.css` 裡有兩個獨立的區塊，兩個配色的顏色各自獨立

#### Scenario: 切換配色時讀回

- **WHEN** 使用者客製化 `rose` 後切換到 `slate`、再切回 `rose`
- **THEN** `rose` 的種子色與樣式與切走之前一樣

#### Scenario: 文字區只顯示選中的配色

- **WHEN** 使用者選了 `rose`
- **THEN** 文字區顯示 `rose` 的樣式內容，不是其它配色的

#### Scenario: 恢復到前一個儲存狀態

- **WHEN** 使用者改了某個配色的種子色但還沒存檔，然後按「恢復」
- **THEN** 該配色的種子色與樣式回到檔案裡的樣子

#### Scenario: 重置為官方預設

- **WHEN** 使用者按某個配色的「重置」
- **THEN** 該配色的區塊從 `custom.css` 移除，Homepage 回到官方的配色

#### Scenario: 全部重置

- **WHEN** 使用者按「全部重置」並確認
- **THEN** 所有配色的客製化與字型都被清除，`custom.css` 只剩下使用者自己寫的內容

### Requirement: 可改用 CDN 或本機字型

系統 SHALL 讓使用者指定字型名稱，SHALL 讓使用者選擇性地指定字型的來源網址。填了
來源網址時，系統 SHALL 產生 `@import`；沒填時只產生 `font-family`。

系統 SHALL 產生 `@import` 時把它放在 `custom.css` 的最前面，因為瀏覽器只會
採用樣式表第一條 `@import` 規則。系統 SHALL 在介面上鎖住字型輸入框（但不清除
已填的值），當 `settings.yaml` 的字型指定了 Homepage 的內建字型時，因為那些規則
的優先級較高，使用者選的內建字型仍然生效。

#### Scenario: 只填字型名稱

- **WHEN** 使用者只填了字型名稱
- **THEN** `custom.css` 裡只有 `font-family`，沒有 `@import`

#### Scenario: 填了名稱與網址

- **WHEN** 使用者填了字型名稱與來源網址
- **THEN** `custom.css` 裡有 `@import` 且它在檔案最前面，`font-family` 用同一個
  字型名稱

#### Scenario: 選了內建字型時輸入框鎖住

- **WHEN** 使用者在下拉選了 `plex`
- **THEN** 字型輸入框不能編輯，但已填的值仍在
