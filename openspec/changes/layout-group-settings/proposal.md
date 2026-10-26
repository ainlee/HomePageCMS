# Change: layout-group-settings

## Why

群組標題的圖示、分頁（tab）、排列樣式、每群組的欄數與折疊行為，上游都放在
settings.yaml 的 layout 區塊，但編輯器的群組對話框只有名稱與 col-span
（col-span 上游根本不會讀）。settings.yaml 裡還有一批全域行為開關
（fullWidth、maxGroupColumns、disableCollapse、statusStyle 等）與頁面基本資訊
（title、description、language、target），至今只能手改 YAML。

## What Changes

- 新增「版面」分頁：列出 settings.yaml 的 layout 群組（含不存在於 services.yaml
  的自動發現群組），可新增、編輯、刪除；欄位包含 icon、tab、style、columns、
  header、initiallyCollapsed、useEqualHeights。
- 群組版面設定集中在「版面」分頁以群組名為鍵管理；服務與書籤分頁的群組對話框
  移除上游不讀取的 col-span 欄位與卡片上的 col-XX 徽章，檔案裡既有的 col-span
  以未建模欄位保留、不再顯示或寫入。
- 「版面」分頁同時提供 settings.yaml 的全域開關：fullWidth、maxGroupColumns、
  maxBookmarkGroupColumns、disableCollapse、groupsInitiallyCollapsed、
  useEqualHeights、bookmarksStyle、target、hideVersion、disableUpdateCheck、
  hideErrors、statusStyle、showStats、disableIndexing、language、title、
  description、startUrl、favicon、instanceName、base、logpath。
- 新增 GET/PUT /api/homepage-layout：只改寫 settings.yaml 的 layout 鍵與上述
  全域鍵，未建模的鍵（providers、quicklaunch、pwa、blockHighlights）保留；
  照例備份、hash 衝突檢查、writeFileSafe。
- 介面遵循既有 design token 與 Minimalism 路線：雙欄格線、窄螢幕單欄、
  8px 間距節奏、觸控目標 44px、對比 4.5:1。

## Capabilities

### New Capabilities

- layout-editing：settings.yaml 的 layout 群組與全域開關可視化編輯。

### Modified Capabilities

- config-editing：群組對話框加入版面欄位，改名時 layout 鍵同步。
- config-editing：移除群組對話框的 col-span 欄位（上游不讀取），既有值以未建模
  欄位保留；群組版面改由「版面」分頁管理。

## Impact

- Affected specs: layout-editing（ADDED）、config-editing（MODIFIED）
- Affected code: server.js、lib/homepage-layout.js（新）、public/app.js、
  public/index.html、public/style.css、locales/*.ini、config/services.example.yaml
  不影響；新增 tests/verify-layout.mjs
- 行為變更：col-span 不再提供編輯；settings.yaml 的 layout 成為群組版面的唯一
  來源。
