# Proposal

## Why

表單裡一批欄位的「未設定／空白」在上游是會繼承全域值或等同另一個選項的隱形行為（例：
群組 style 空白等同 columns、columns 欄數只在 row 樣式下生效、initiallyCollapsed /
useEqualHeights／showStats／statusStyle 空白時跟隨 settings.yaml 的全域開關、
maxGroupColumns 範圍 5–8 目前完全沒有驗證），介面上沒有任何提示，使用者存檔後
不知道「實際生效的是什麼」。另有一處存檔驗證漏洞：maxGroupColumns／
maxBookmarkGroupColumns 只要填整數就照單全收寫進檔案，填 3 或 10 都不會被擋。

## What Changes

- 群組表單（服務群組、書籤群組、版面分頁群組三個對話框同步改）：
  - `columns` 欄位在樣式非 `row` 時 disabled 置灰，標籤行顯示單行提示「僅 row 樣式生效」
    （照 `.select-hint` 既有模式，放不下的情境 ellipsis，不另起一行）。
  - 樣式下拉的「未設定」選項文案改為「未設定（同 columns）」。
  - `header` 改為二元開關（上游是 `header !== false`，未設定與「開」同義）。
  - `initiallyCollapsed`、`useEqualHeights` 保留三選；「未設定」的標籤行動態顯示
    繼承結果：全域未設 → 顯示預設方向；全域已設 → 顯示全域值；明確覆寫 → 顯示
    「覆寫全域（全域：X）」。
  - `tab` 欄位下方既有 hint 區動態顯示：當其他群組有分頁、本群組未填 tab 時，
    提示「顯示於所有分頁」。
- 服務項目標：`showStats` 簡化為「跟隨全域／明確關閉」兩選（上游只有明確 false
  會關掉，填 true 等同跟隨全域）；`statusStyle` 未設定的標籤行動態顯示全域值；
  兩者有明確覆寫時顯示「覆寫全域」。`statusStyle` 本身保留 dot／basic／未設三選。
- 版面分頁全域開關：`maxGroupColumns`、`maxBookmarkGroupColumns` 存檔驗證
  限制在 5–8（對既有檔案中超出範圍的值：載入時照實顯示，存檔時不寫回、並提示），
  標籤行提示「僅對 columns 樣式群組生效」。
- 群組卡片摘要：樣式空白顯示 columns；非 row 不顯示欄數；有欄位覆寫全域時加
  小圖示。
- 四個內建語系檔新增／調整對應 key（繼承與覆寫文案帶插值）；無頭 Chrome 測試
  加斷言（columns 禁用狀態、繼承提示內容、maxGroupColumns 範圍擋下）。

## Capabilities

### New Capabilities

（無）

### Modified Capabilities

- `layout-editing`: 群組欄位防呆與動態繼承提示；全域開關 maxGroupColumns /
  maxBookmarkGroupColumns 的 5–8 範圍驗證；header 改二元開關。
- `config-editing`: 服務群組與書籤群組對話框的防呆同步（與版面分頁共用一組
  規則）；服務項目的 showStats／statusStyle 繼承提示與 showStats 兩選化；
  群組卡片摘要顯示規則。

## Impact

- 受影響代碼：public/index.html（三個群組對話框、項目標、版面分頁）、
  public/app.js（提示的 computed、showStats 選項改造、maxGroupColumns 範圍
  驗證）、lib/homepage-layout.js（applyLayoutSettings 的 int 驗證加範圍）、
  locales/*.ini（四語）、public/style.css（disabled 置灰照既有樣式，可能不需動）。
- 後端 API：`/api/homepage-layout` 的 PUT 驗證多一道 5–8 檢查，回應錯誤訊息走
  既有 i18n ERROR 模式。
- 純顯示層改動不改變存檔檔案內容（maxGroupColumns 例外，屬存檔行為）；
  不影響未建模欄位的保留規則。
