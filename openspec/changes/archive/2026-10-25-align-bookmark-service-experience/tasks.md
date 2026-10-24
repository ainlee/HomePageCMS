# Tasks

## 1. 共用拖曳引擎（public/app.js）

- [x] 1.1 新增 `activeGroups` 與 `activeTotalItems` computed（依 `activeTab`
  切換服務／書籤清單），落點解析 `updateDropIndexFromPoint`、滑鼠拖曳放開
  `endCardDrag` 改查 `activeGroups.value`
- [x] 1.2 移除沒有綁定的 HTML5 拖放處理器（onDragStart、onDragOver、
  onDragOverGroup、onDrop、onDragEnd、onDragStartScroll）與重複的
  `toggleBookmarkGroup`，同步清理 return 導出清單
- [x] 1.3 移動對話框目標清單綁 `activeGroups`；`watch(activeTab, …)`
  清空拖曳狀態

## 2. 書籤頁範本（public/index.html）

- [x] 2.1 書籤分組卡補上 `data-group-id`、`drag-over` 邊框、項目卡
  `drop-target`／`is-dragging` 類別與插入指示條
- [x] 2.2 書籤項目操作列補上移、下移、移動到別的分組按鈕，折疊改綁
  `toggleGroup`
- [x] 2.3 書籤工具列統計加上項目總數

## 3. 語系

- [x] 3.1 四個內建語系檔：`tabs.statsBookmarks` 加項目總數佔位、
  `bookmark.confirmDeleteGroup` 加項目數佔位

## 4. 測試

- [x] 4.1 無頭 Chrome 測試：書籤分頁排序按鈕、跨分組移動、拖曳指示
  （加入 verify-bookmarks.mjs 或新檔，併入 npm test）
- [x] 4.2 npm test 全數通過（12 組 253 項檢查）；實機截圖確認兩頁操作列一致
