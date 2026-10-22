# Change: font-simplification

## Why

字型設定有三個欄位擠在下方的「自訂 CSS」區塊裡，跟它們最相關的「Homepage 內建
字型」下拉選單隔了一整個畫面，使用者不會想到它們是一件事。

而且「字型名稱」欄位的語意含混：它同時被當成「CDN 樣式表裡註冊的名字」和「要
寫進 font-family 的名字」，而這兩者其實不同——樣式表裡的名字是對方定的，字型檔
則是連字型自己都沒說。

## What Changes

- 三個字型欄位搬到一起，放在「Homepage 內建字型」下拉選單旁邊。
- 兩個欄位：「CDN 網址」與「訪客電腦的字型名稱」，兩者意義明確、互不糾纏。
- 產生的規則一律是同一個順序：**CDN → 訪客電腦上的字型 → 系統字型**。
  - CDN 指向字型檔：用 `@font-face` 載入，標籤用我們自己的名字，
    `local()` 放訪客電腦上的那個字型。
  - CDN 指向樣式表：用 `@import` 匯入，`font-family` 先列樣式表註冊的名字，
    再列訪客電腦上的那個字型。
- 放棄「上半部是 settings.yaml、下半部是 custom.css」的分法，檔案歸屬退成
  一行小字。

## Impact

- Affected specs: `homepage-appearance`（MODIFIED）
- Affected code: `lib/custom-css.js`、`server.js`、`public/app.js`、
  `public/index.html`、`public/style.css`、`locales/*.ini`、
  `tests/verify-custom-css.mjs`
- 舊格式的 `custom.css` 會被讀出來（設定值直接從 CSS 解析），不會被清掉。
