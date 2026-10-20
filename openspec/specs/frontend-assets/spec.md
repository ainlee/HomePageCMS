# frontend-assets Specification

## Purpose
TBD - created by archiving change vendor-frontend-assets. Update Purpose after archive.

## Requirements

### Requirement: 前端資產由本機提供

系統 SHALL 從已安裝的 npm 套件提供前端所需的 JavaScript 與字型，頁面 MUST NOT
向外部網域載入任何資產。

#### Scenario: 沒有外網也能載入編輯器

- **WHEN** 執行環境無法連到外部網域
- **THEN** 編輯器仍然完整載入：Vue 掛載成功、圖示字型可用、YAML 寫入可用

#### Scenario: 頁面沒有外部請求

- **WHEN** 載入編輯器頁面
- **THEN** 瀏覽器只向編輯器自己的位址請求資源

### Requirement: 資產隨 npm 安裝提供

系統 SHALL 以 npm 相依取得前端資產，使用者只需執行 `npm install`，不需要額外
下載步驟。

#### Scenario: 安裝後即可使用

- **WHEN** 使用者執行 `npm install` 後啟動編輯器
- **THEN** 編輯器不需要連到外部網域即可運作
