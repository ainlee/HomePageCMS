# Change: homepage-custom-css

## Why

Homepage 的官方擴充點是設定目錄裡的 `custom.css` / `custom.js`：官方文件說「編輯
`custom.css` 就能用各種 class / id 客製化 Homepage」。編輯器目前只寫
`settings.yaml` 的內建視覺欄位，所以能做的只有「從官方 23 個配色裡挑一個」，
要自己定義配色就必須離開介面去改檔。

實測還發現一個容易踩的坑：`custom.css` 是**在官方 CSS 之前**載入的，所以
`custom.css` 裡寫 `.theme-slate { --color-50: ... }` 會輸給官方同一條規則，
覆寫根本不生效。必須用更高優先級的選擇器（`html.theme-slate`）才行。

## What Changes

- 首頁外觀分頁新增「自訂 CSS」區塊，直接編輯 `custom.css`。
- 內建一個配色助手：選一個 Homepage 內建配色與一個種子色，產生
  `html.theme-<配色> { --color-50..900; --color-logo-start/stop }` 的 CSS 片段，
  可微調十個色階後套用。
- 產生的選擇器帶 `html` 前綴，優先級高於官方的 `.theme-<配色>`，因此覆寫會
  生效；而且只影響被客製化的那一個配色，使用者切換到其它配色仍是官方原樣。
- 存檔前備份 `custom.css`；檔案在載入後被其他程式改動過時拒絕覆寫。

## Impact

- Affected specs: `homepage-appearance`（MODIFIED）
- Affected code: `lib/homepage-appearance.js`、`server.js`、`public/index.html`、
  `public/app.js`、`public/style.css`、`locales/*.ini`、
  `tests/verify-custom-css.mjs`
- 編輯器自己的配色（`themes/*.ini`）不變，兩套樣式仍然分開。
- 不包含 `custom.js`（JavaScript 不在本次範圍）。
