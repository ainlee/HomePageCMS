# Change: theme-list-row-layout

## Why

配色方案清單裡，每個方案的名稱與小標籤（「內建」「使用中」「自訂」）原本是
上下兩行。名稱短（「深海」只有兩個字），標籤也短，兩者並排放得下，但標籤卻
自己換行——看起來像名稱被折行了，其實旁邊都是空的。

## What Changes

- 名稱與標籤排在同一行，標籤緊接在名稱右側。
- 名稱過長時以省略號截短，標籤不被擠掉。
- 標籤文字不折行。

## Impact

- Affected specs: `editor-themes`（MODIFIED）
- Affected code: `public/style.css`

