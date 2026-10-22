# Change: font-url-and-seed-picker

## Why

實測後發現三個問題：

**一、只填網址沒填名稱，字型完全不會生效。** 產生 `@import` 與 `font-family` 需要
字型名稱，名稱空了就整段不寫。而且「名稱」其實是可以從樣式表裡查出來的——
`https://fontsapi.zeoseven.com/101/main/result.css` 裡有 32 條 `@font-face`，
家族名是 `"Cubic 11"`，使用者不必自己猜。

**二、樣式表以外的字型檔（woff2／ttf）沒辦法用。** `@import` 只能匯入樣式表，
直接指向字型檔需要 `@font-face`。使用者給的
`https://cdn.jsdelivr.net/npm/@fontpkg/cubic-11@1.100.1/+esm` 回 404（那個套件
沒有 `+esm` 打包，裡面只有 `Cubic_11_1.100_R.woff2` 與 `.ttf`），本來就取不到。

**三、種子色的色票變成一長條。** `.form-group input` 的 `width: 100%` 優先級比
`.seed-input` 高，色票被拉成整列寬度（實測 792px）。

另外，使用者在「首頁外觀」選了配色後，Homepage 頁腳的調色盤按鈕就消失了——
那是官方行為（`settings.color` 有值時不顯示切換鈕），但介面沒有說明，使用者
只會覺得按鈕不見了。

## What Changes

- 填入字型網址時，伺服器抓取該網址並解析出可用的 `@font-face` 家族名稱，
  介面自動填入名稱並顯示找到的字型。
- 網址指向字型檔（woff2／woff／ttf／otf）時，改用 `@font-face` 規則，
  名稱由使用者填寫。
- 只有名稱、沒有網址時，行為不變（只用本機字型）。
- 修正種子色色票的寬度。
- 配色列加上說明：選了配色後，Homepage 頁腳的調色盤按鈕會消失。

## Impact

- Affected specs: `homepage-appearance`（MODIFIED）
- Affected code: `lib/custom-css.js`、`server.js`、`public/app.js`、
  `public/index.html`、`public/style.css`、`locales/*.ini`、
  `tests/verify-custom-css.mjs`
