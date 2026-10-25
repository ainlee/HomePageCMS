# Design

## Context

拖曳引擎目前是 `startCardDrag` 綁在把手的 `@mousedown`，之後監聽 `document` 的
`mousemove`／`mouseup`。觸控裝置不會產出 `mousemove`，瀏覽器看到把手上的觸碰
就會按預設手勢去捲頁面——除非該元素有 `touch-action: none`。

## Goals / Non-Goals

- 目標：滑鼠、觸控、手寫筆三類指標用同一支拖曳代碼；手機上可用觸控排序與
  跨分組插入。
- 非目標：不重做落點解析與插入指示（現有的 `updateDropIndexFromPoint` 與
  指示條照樣共用）；不處理多指手勢（拖曳是單指）。

## Decisions

1. **Pointer Events 取代三套滑鼠事件。** 把手改綁 `@pointerdown`，拖動中
   監聽 `document` 的 `pointermove`／`pointerup`／`pointercancel`。Pointer
   Events 在 Chrome 的 headless 可用 CDP 的 `Input.dispatchTouchEvent` 模擬，
   測試不需第二套邏輯。不選「另寫一組觸控事件處理器」：那是上次落差的原因，
   兩套引擎會再次漂移。

2. **起拖門檻只對觸控生效。** 滑鼠維持「按下就開始拖」的現狀；觸控按下後
   記下 `clientX/clientY`，指標移動 ≥ 5px 才建立 ghost 並轉為拖曳中。小於
   門檻就放開時當作普通點擊收掉（把手沒有點擊行為，等同無操作）。
   理由：手指落點天然比滑鼠粗，無門檻會把「想點卡片」誤觸成拖曳。

3. **把手 CSS 加 `touch-action: none`。** 這是瀏覽器唯一真正聽得見的「手勢歸
   你管」宣告；缺了它，`pointerdown` 之後瀏覽器仍可能接手捲動並送出
   `pointercancel`。只在 `.item-drag` 上設，不影響卡片其餘區域的捲動。

4. **自動捲動改讀指標 Y。** 現有的 `autoScrollDuringDrag` 已用
   `event.clientY`，Pointer 事件自帶 `clientX/clientY`，不需改動。

5. **`pointercancel` 等同放開但不落位。** 系統中斷（通知、多指）時清掉拖曳
   狀態，項目回原位。

## Risks / Trade-offs

- [把手區失去原生捲動] → 只影響把手本身（約 14px 寬的一列），卡片其餘
  空間照樣可捲動；這正是拖曳把手的預期行為。
- [5px 門檻讓觸控起拖比滑鼠慢半拍] → 用真實觸控位移換取「輕點不誤觸」，
  可接受；門檻是常數，測試以 ≥ 8px 的位移驗證。
- [瀏覽器相容性] → Pointer Events 在 Chrome／Edge／Safari 13+／Firefox 59+
  皆有，內網環境不構成問題。

## Migration Plan

純前端改動，無資料遷移。重開頁面即生效；滑鼠使用者沒有行為差異（起拖條件、
落點規則、指示條完全照舊）。
