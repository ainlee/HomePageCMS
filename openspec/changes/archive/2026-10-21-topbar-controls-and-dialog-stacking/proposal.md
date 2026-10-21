# Change: topbar-controls-and-dialog-stacking

## Why

三件小事湊在一起：

1. **配色方案視窗被設定視窗擋住。** 兩個視窗都是 `.modal-overlay`、同一個
   `z-index`，而配色方案視窗在 DOM 裡排在前面，所以從設定視窗點進去時，配色
   方案視窗整個被蓋住，看起來像沒反應。
2. **換語言與換配色要繞進設定視窗。** 語言與配色是會天天調的東西，每次都要
   開齒輪、切到某個欄位，太遠了。
3. **「隱藏預覽／顯示預覽」的字是贅字。** 按鈕旁邊就有眼睛圖示，文字只是把
   頂端工具列塞滿。

## What Changes

- 配色方案視窗疊在設定視窗之上（專屬的 `z-index`），從設定視窗開啟時看得見。
- 頂端工具列新增兩個小圖示按鈕：
  - **語言**：以動畫展開的下拉選單，列出所有可用語言，點選即切換。
  - **配色方案**：直接開啟配色方案視窗。
- 預覽切換按鈕改為只有眼睛圖示，名稱放進提示（`title`）。

## Impact

- Affected specs: `editor-shell`（ADDED）、`editor-themes`（MODIFIED）、
  `preview-panel`（MODIFIED）
- Affected code: `public/index.html`、`public/app.js`、`public/style.css`

