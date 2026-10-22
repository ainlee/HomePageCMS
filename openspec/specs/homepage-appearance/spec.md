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

介面 SHALL 把設定分成幾個群組：配色、樣式、字型、背景，以及配色的客製化。系統
SHALL 在配色的客製化之前畫一條分隔線，把客製化的部分與其它設定分開。

系統 MUST NOT 在介面上要求使用者知道哪個設定寫進哪個檔案；寫入的檔案只以一行
小字說明。

「自訂 CSS」區塊的標題旁 SHALL 有一個可聚焦的提示標記，滑鼠停留或鍵盤聚焦時
浮出說明，內容為儀表板可能快取 `custom.css`、改完樣式需要重新載入頁面。

配色列 SHALL 說明：在這裡選了配色之後，Homepage 頁腳的調色盤切換鈕就不會出現
（官方行為），把配色設成「不指定」可以讓它回來。

種子色的色票 SHALL 保持小尺寸，不得被表單的輸入框寬度規則撐開。

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
- **THEN** 配色的客製化與其它設定之間有一條分隔線

#### Scenario: 快取提示

- **WHEN** 使用者把滑鼠停在配色的客製化標題旁的驚嘆號上
- **THEN** 浮出提示，說明儀表板可能快取 `custom.css`、改完需要重新載入頁面

#### Scenario: 選了配色後的切換鈕

- **WHEN** 使用者在配色列選了一個配色
- **THEN** 介面說明 Homepage 頁腳的調色盤切換鈕會消失，要讓它回來請把配色設成
  「不指定」

#### Scenario: 種子色色票的大小

- **WHEN** 使用者看著種子色的色票
- **THEN** 色票是小方塊，不會被拉成整列寬度

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

系統 SHALL 讓使用者指定字型的來源網址（CDN 網址），SHALL 讓使用者指定訪客電腦上
的字型名稱。兩者 SHALL 互相獨立：填了網址不必填名稱，填了名稱也不必填網址。

系統產生的字型規則 SHALL 依序嘗試：**來源網址 → 訪客電腦上的字型 → 系統字型**。

當來源網址指向樣式表時，系統 SHALL 以 `@import` 匯入它，並以樣式表註冊的家族
名稱優先於訪客電腦上的字型名稱。

當來源網址指向字型檔（woff2、woff、ttf 或 otf）時，系統 SHALL 以 `@font-face`
規則載入它，家族名稱 SHALL 使用一個自訂標籤，並將訪客電腦上的字型名稱列為該
規則的第二個來源。

介面 SHALL 把「Homepage 內建字型」下拉選單、來源網址與訪客電腦的字型名稱放在
同一個群組裡。下拉選單選了 Homepage 的內建字型時，那兩個欄位 SHALL 被鎖住但
保留已填的值，因為內建字型的規則優先級較高。

#### Scenario: 只填字型名稱

- **WHEN** 使用者只填了訪客電腦的字型名稱
- **THEN** `custom.css` 裡只有 `font-family`，沒有 `@import` 與 `@font-face`

#### Scenario: 填了名稱與網址

- **WHEN** 使用者填了訪客電腦的字型名稱與來源網址
- **THEN** `custom.css` 裡有該網址對應的匯入規則，且 `font-family` 裡網址的字型
  在前、訪客電腦的字型在後

#### Scenario: 填了名稱與樣式表網址

- **WHEN** 使用者填了訪客電腦的字型名稱與一個樣式表的網址
- **THEN** `custom.css` 裡有 `@import` 且它在檔案最前面，`font-family` 裡樣式表
  註冊的名字在前、訪客電腦的字型在後、最後是系統字型

#### Scenario: 填了名稱與字型檔網址

- **WHEN** 使用者填了訪客電腦的字型名稱與一個字型檔的網址
- **THEN** `custom.css` 裡有 `@font-face`，其 `src` 先指向該字型檔、再是
  `local()` 指向訪客電腦上的字型

#### Scenario: 只填網址時查出字型名稱

- **WHEN** 使用者填了一個含有 `@font-face` 的樣式表網址
- **THEN** 介面從樣式表裡找出家族名稱並顯示找到的是哪一個字型

#### Scenario: 選了內建字型時輸入框鎖住

- **WHEN** 使用者在下拉選了 `plex`
- **THEN** 來源網址與字型名稱兩個欄位不能編輯，但已填的值仍在

#### Scenario: 舊的設定檔不會被清掉

- **WHEN** `custom.css` 是由舊版的編輯器寫的，沒有記錄字型設定的註解
- **THEN** 系統從 CSS 本身讀出字型設定，該字型不會消失
