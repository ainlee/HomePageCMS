# Tasks

## 1. 拖曳引擎改 Pointer Events（public/app.js、public/index.html）

- [x] 1.1 把手綁定由 `@mousedown="startCardDrag(…)"` 改為
  `@pointerdown="startCardDrag(…)"`（兩頁共用同一處函式）
- [x] 1.2 `startCardDrag` 依指標類型定門檻：滑鼠按下即起拖；觸控記錄
  按壓座標，`pointermove` 位移 ≥ 5px 才建立 ghost 與拖曳狀態
- [x] 1.3 拖動監聽改 `pointermove`／`pointerup`／`pointercancel`；
  `pointercancel` 清狀態不落位

## 2. 觸控手勢（public/style.css）

- [x] 2.1 `.item-drag` 加 `touch-action: none`，把手區不再被瀏覽器捲走

## 3. 測試

- [x] 3.1 新增無頭 Chrome 觸控拖曳測試（CDP `Input.dispatchTouchEvent`）：
  同組排序、跨組插入、指示條、未拖曳時捲動不受影響，併入 npm test
- [x] 3.2 npm test 全數通過（13 組 266 項檢查）
