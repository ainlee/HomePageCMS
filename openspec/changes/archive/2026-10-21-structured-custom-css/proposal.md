# Change: structured-custom-css

## Why

「自訂 CSS」現在是一個自由文字區加三顆按鈕（產生色階、套用到 CSS、移除這段）。用起來
不直覺，而且有兩個實際的問題：

**一、字型換不了。** Homepage 的字型只有 Manrope 與 IBM Plex Mono 兩個內建選項，
想用 CDN 上的字型只能自己寫 `@font-face` 或 `@import`。而 `@import` 必須是
樣式表的第一條規則，寫在後面會被瀏覽器**默默丟棄**（實測：寫在第一行會發出
4 個字型檔請求，寫在第二行是 0 個，而且沒有任何錯誤訊息）。

**二、配色區塊之間沒有分隔。** `settings.yaml` 的欄位和 `custom.css` 是兩個不同
的檔案，卻放在同一個區塊裡，看不出差別。

## What Changes

- 「自訂 CSS」區塊改為結構化：上面選的配色就是下面編輯的主題。
- 兩個色票：該配色的**官方原色**（對照，唯讀）與**你的種子色**（可改）。
  色階即時重算。
- 文字區只顯示**選中那個配色**的 CSS，可手動編輯；存檔後寫入的就是這個狀態。
- 每個配色的客製化各存在 `custom.css` 的獨立區塊裡，切換配色時讀回該區塊。
- 新增字型欄位：字型名稱（必填）與來源網址（選填）。填了網址會自動產生
  `@import`。下拉選了內建字型時輸入框鎖住，但值保留。
- 按鈕改為「恢復」（回到前一個儲存狀態）與「重置」（該配色回到官方預設）。
- 頂端按鈕改為「全部重置」，清除所有配色的客製化與字型，需二次確認。

## Impact

- Affected specs: `homepage-appearance`（MODIFIED）
- Affected code: `lib/custom-css.js`、`lib/official-shades.js`、
  `lib/homepage-appearance.js`、`server.js`、`public/index.html`、
  `public/app.js`、`public/style.css`、`locales/*.ini`、
  `tests/verify-custom-css.mjs`
- `custom.css` 裡使用者自己寫的內容原樣保留，但不再於介面中編輯。
