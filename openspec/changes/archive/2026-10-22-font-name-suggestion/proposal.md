# Change: font-name-suggestion

## Why

貼上字型檔的網址卻沒生效，原因是編輯器寫出了這樣的東西：

```css
@font-face {
  font-family: "";
  src: url("...Cubic_11_1.100_R.woff2") format("woff2");
  font-display: swap;
}
```

家族名稱是空的，檔案裡也沒有 `html body { font-family: ... }`——語法沒錯，
卻完全不會有效果。原因是樣式表裡的 `@font-face` 會告訴瀏覽器家族叫什麼，
但一個字型檔本身不說自己叫什麼，所以名稱欄還是得由使用者填。

## What Changes

- 探測到字型檔時，用檔名猜一個家族名稱填進名稱欄（去掉版本與樣式後綴），
  例如 `Cubic_11_1.100_R.woff2` → `Cubic 11`，使用者可以改。
- 填了網址卻沒有名稱時，不再寫出壞掉的規則：儲存會被擋下並說明原因。

## Impact

- Affected specs: `homepage-appearance`（MODIFIED）
- Affected code: `lib/custom-css.js`、`server.js`、`public/app.js`、
  `locales/*.ini`、`tests/verify-custom-css.mjs`
