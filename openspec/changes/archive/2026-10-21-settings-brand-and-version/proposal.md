# Change: settings-brand-and-version

## Why

設定視窗是使用者唯一會停下來看的地方，卻沒有任何「這是什麼程式、是哪個版本、
要去哪裡回報問題」的線索。版本號散落在各處也容易不一致。

## What Changes

- 設定視窗的按鈕列左側靠左顯示專案名稱與版本號（`HomePageCMS v1.0.1`），
  按鈕仍在右側。
- 專案名稱是連結，指向 GitHub 倉庫（新分頁開啟）。
- 版本號與倉庫網址都由 `package.json` 提供，伺服器注入頁面，前端不寫死。
- `package.json` 的版本升到 `1.0.1`，並補上 `repository` 欄位。

## Impact

- Affected specs: `editor-shell`（ADDED）
- Affected code: `package.json`、`server.js`、`public/index.html`、`public/app.js`、
  `public/style.css`、`locales/*.ini`

