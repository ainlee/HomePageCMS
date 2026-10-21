# Change: collapsed-preview-strip-layout

## Why

桌面版把預覽折疊後，右側只剩一條 44px 寬的直條。這條直條原本整條設成
`writing-mode: vertical-rl`，於是 flex 的排列軸跟著轉成直向，箭頭與「展開預覽」
變成**左右並排**：兩者寬度加起來超過 44px，文字被壓到 10px 且左右兩端都被裁掉，
看起來像壞掉的一小撮字。實際量測下 `.preview-header-left` 是 55px 寬，卻被塞在
43px 的容器裡。

## What Changes

- 折疊列的版面改為：展開圖示在上、標籤文字在下，兩者上下排列，不再並排競爭寬度。
- 標籤改為直排（`vertical-rl`，字形保持正向），字級從 10px 提升到 12px，字距略為
  放鬆，像一個直立的頁籤標題。
- 展開圖示改成圓形把手（32px），看起來就是「可以把面板拉開」的握把。
- 行動版維持原本的橫排版面，但把手縮小成 26px，避免 38px 高的色帶容不下。
- 折疊列寬度維持 44px，不變寬。

## Impact

- Affected specs: `preview-panel`（ADDED）
- Affected code: `public/style.css`

