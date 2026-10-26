# Change: widgets-panel

## Why

Homepage 的資訊小工具（widgets.yaml：resources、search、weather、calendar、
logo、greeting、datetime 等）頂端整列都沒有辦法在編輯器裡管理，只能手改 YAML。
編輯器目前只認 services.yaml、bookmarks.yaml、settings.yaml 與 custom.css，
widgets.yaml 不存在時不會由範例檔建立。

## What Changes

- 新增「小工具」分頁：以型別加通用選項（url、key、label、fields、href、
  target、cache、latitude、longitude、provider 等白名單欄位）管理 widgets.yaml
  的清單項目，支援新增、編輯、刪除、上下排序。
- 型別下拉由上游 src/widgets 目錄產出的常數檔（public/widget-types.js）提供；
  檔案裡有、清單沒有的型別 SHALL 原樣保留並提示。
- 未建模的選項鍵 SHALL 保留（與其他檔案的未建模欄位保留行為一致）。
- 首次啟動時由 config/widgets.example.yaml（新）建立 widgets.yaml。
- GET/PUT /api/widgets：照例備份、hash 衝突檢查、writeFileSafe。
- 介面遵循既有 design token 與 Minimalism 路線。

## Capabilities

### New Capabilities

- widgets-panel：widgets.yaml 的資訊小工具可視化管理。

### Modified Capabilities

- file-storage：首次啟動多一檔 widgets.yaml 由範例檔建立。

## Impact

- Affected specs: widgets-panel（ADDED）、file-storage（MODIFIED）
- Affected code: server.js、public/app.js、public/index.html、public/style.css、
  public/widget-types.js、config/widgets.example.yaml（新）、locales/*.ini
- 新增 tests/verify-widgets.mjs
