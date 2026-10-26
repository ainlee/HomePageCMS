# layout-editing Specification

## Purpose
TBD - created by archiving change layout-group-settings. Update Purpose after archive.

## Requirements

### Requirement: layout 群組可視化編輯

系統 SHALL 讓使用者編輯 settings.yaml 的 layout 區塊：依群組名稱設定圖示（icon）、
分頁（tab）、排列樣式（style）、欄數（columns）、標題（header）、初始折疊
（initiallyCollapsed）與等高卡片（useEqualHeights）。layout 中沒有對應
services.yaml 群組的條目（例如 Docker 自動發現群組）SHALL 照常顯示與編輯。
存檔時 SHALL 只改寫 settings.yaml 的 layout 鍵，檔案裡其它未建模的鍵保留。

#### Scenario: 為群組設定分頁
- **WHEN** 使用者為某群組設定 tab 為 First 並存檔
- **THEN** settings.yaml 的 layout.First 含有該群組，儀表板顯示分頁標籤

#### Scenario: 刪除 layout 條目
- **WHEN** 使用者刪除一個 layout 群組並存檔
- **THEN** settings.yaml 的 layout 沒有該鍵，其它條目與順序不變

### Requirement: settings 全域開關可視化編輯

系統 SHALL 提供 settings.yaml 的全域開關表單：fullWidth、maxGroupColumns、
maxBookmarkGroupColumns、disableCollapse、groupsInitiallyCollapsed、
useEqualHeights、bookmarksStyle、target、language、hideVersion、
disableUpdateCheck、hideErrors、statusStyle、showStats、disableIndexing、
instanceName、title、description、startUrl、favicon、base、logpath。
未填的值 SHALL 從檔案移除；已建模以外與未填以外（例如 providers、quicklaunch、
pwa、blockHighlights）的鍵 SHALL 保留原樣。

#### Scenario: 開啟全文寬
- **WHEN** 使用者勾選 fullWidth 並存檔
- **THEN** settings.yaml 含有 fullWidth: true，儀表板重新載入後佔滿視窗寬度

#### Scenario: 未建模的鍵保留
- **WHEN** settings.yaml 含有 providers 與 quicklaunch，使用者存檔全域開關
- **THEN** providers 與 quicklaunch 的內容不變
