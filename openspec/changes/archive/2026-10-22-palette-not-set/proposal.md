# Change: palette-not-set

## Why

配色是用 23 顆色票選的，每一顆都是「選這個」，沒有任何一格能把配色清空。於是
一旦選了某個配色，就再也回不到「不指定」——只能自己去改設定檔。

那正是最需要回頭的情況：Homepage 在 `settings.yaml` 有 `color:` 的時候會把頁腳
的調色盤切換鈕藏起來（官方行為），使用者看到按鈕消失，就想改回不指定，卻找不到
地方可改。

## What Changes

- 配色色票的最前面加一格「不指定」，點它就把 `color` 從設定檔拿掉，儀表板的
  調色盤切換鈕回來。
- 其餘七個欄位（深淺色、卡片模糊、標題樣式、卡片樣式、區塊樣式、圖示樣式、字型）
  的下拉第一項都是「不指定」，配色欄補上這一格後語彙一致。

## Impact

- Affected specs: `homepage-appearance`（MODIFIED）
- Affected code: `public/index.html`、`public/style.css`、`locales/*.ini`、
  `tests/verify-appearance.mjs`
