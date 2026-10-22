# Change: editor-chrome

## Why

三個在手机上特別明顯的問題：

**一、分頁列會跟著捲��。** 服務、書籤、首頁外觀的分頁列和旁邊的按鈕是離開長
清單的出口，卻會跟著內容捲走。

**二、提示框有一半在畫面外。** 配色自訂旁的驚嘆號在標題的左邊，提示框以它為
中心往兩邊展開，於是左半部跑出畫面。

**三、種子色多了一格。** 「官方原色」旁邊有一個純色塊和一個調色器，兩個都畫著
同一個顏色，看起來像多了一格。

## What Changes

- 分頁列連同旁邊的按鈕固定在編輯區頂端，內容從它底下捲過。
- 提示框改成從驚嘆號的左緣往右展開，不再往畫面外跑。
- 種子色的調色器直接就是「官方原色」字樣右邊那一格，多餘的純色塊拿掉。

## Impact

- Affected specs: `editor-shell`（MODIFIED）、`homepage-appearance`（MODIFIED）
- Affected code: `public/style.css`、`public/index.html`、
  `tests/verify-mobile.mjs`、`tests/verify-appearance-hints.mjs`
