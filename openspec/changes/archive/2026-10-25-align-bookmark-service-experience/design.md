# Design

## Context

兩頁共用同一支 `public/app.js`，但拖曳引擎（落點解析 `updateDropIndexFromPoint`、
放開解析 `endCardDrag`、HTML5 拖放 `onDrop`）全數寫死 `groups.value`（服務清單），
書籤分組卡也缺少 `data-group-id` 屬性，所以書籤分頁拖曳時落點解析永遠找不到
目標分組，指示條不顯示、跨分組拖放失效。移動對話框（`showMoveModal`）的目標
清單也寫死 `groups`。排序按鈕（上移／下移／移動到別的分組）只存在於服務分頁。
HTML5 拖放那組事件處理器（`@dragstart` 等）在範本裡從未綁定，是死程式碼。

## Goals / Non-Goals

- 目標：兩頁的操作列、拖曳指示、跨分組移動、統計數字體驗一致；共用同一支
  引擎，不再各寫一套。
- 非目標：分組本身的重新排序（服務分頁也沒有，不在本次範圍）；不觸及存檔
  與未建模欄位保留流程。

## Decisions

1. **引擎改以「目前分頁的分組清單」為底。** 新增 `activeGroups` computed，
   依 `activeTab` 在 `groups` 與 `bookmarkGroups` 之間切換；落點解析與放開
   解析改查 `activeGroups.value`。
   不選「兩頁各複製一套引擎」：那是落差的原因，之後再改會兩邊各自漂移。

2. **書籤分組卡補上 `data-group-id` 與拖曳目標提示。** 與服務分組卡相同的
   屬性、`drag-over` 邊框、插入指示條；項目卡補上 `drop-target`、
   `is-dragging` 類別。純範本改動，CSS 全部已存在。

3. **排序與移動按鈕共用既有函式。** `moveItemUp`、`moveItemDown`、
   `moveItemToGroup`、`confirmMove` 對參數都是「傳入的分組物件」，
   對任何分組清單都成立，直接套用；移動對話框的目標清單綁 `activeGroups`，
   切換分頁時自動顯示該頁的分組。

4. **移除沒有綁定的 HTML5 拖放處理器。** `onDragStart`、`onDragOver`、
   `onDragOverGroup`、`onDrop`、`onDragEnd` 與 `onDragStartScroll` 從
   程式與導出清單移除；實際使用的滑鼠拖曳（`startCardDrag` 一系）保留。
   移除重複的 `toggleBookmarkGroup`，書籤分組卡改綁共用的 `toggleGroup`。

5. **分頁切換時清掉拖曳狀態。** 用 `watch(activeTab, …)` 把 `dropIndex`、
   `dragOverGroup`、`draggingItem` 歸零，避免指示條跨分頁殘留。

6. **統計與確認訊息跟齊服務頁。** 書籤分頁的工具列統計加上項目總數；
   刪除書籤分組的確認訊息加上項目數。對應語系 key 在四個語系檔同步改動。

## Risks / Trade-offs

- [書籤行多三顆按鈕，窄版面可能擠壓] → 服務行已有五顆按鈕並經行動版測試，
  書籤行套用同一排版後跑 `verify-mobile` 確認行為不變。
- [落點解析改綁 `activeGroups`，若拖曳中途切分頁] → 拖曳是同步滑鼠序列，
  中途切頁的邊界情況由第 5 點的 `watch` 收尾；頭無測試的滑鼠序列也驗證
  跨分組落點仍正確。
- [移除死程式碼可能影響尚未發現的綁定] → 移除前全倉搜尋 `@dragstart`、
  `@drop` 等綁定與測試引用，確認無一處使用。

## Migration Plan

純前端改動，沒有資料遷移；重開頁面即可。存檔流程不變，bookmarks.yaml 與
services.yaml 的欄位與寫法都不動，無須回滾資料。
