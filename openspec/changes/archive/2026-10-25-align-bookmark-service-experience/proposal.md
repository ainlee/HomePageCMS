# Change: align-bookmark-service-experience

## Why

服務分頁的項目有上移、下移、跨分組移動按鈕，拖曳時有插入指示條與跨分組落點提示；
書籤分頁的項目只有編輯與刪除兩顆按鈕，拖曳指示也不生效——落點解析與拖放引擎全數
寫死服務分組清單，書籤分組根本不在解析範圍內。兩個分頁本該是同一套體驗，
書籤分頁落後了。

## What Changes

- 書籤項目補上與服務一致的操作列：上移、下移、移動到別的分組（對話框引導選擇
  目標分組），與既有拖曳共用同一套拖放引擎。
- 拖放引擎（落點解析、插入指示條、跨分組拖放、自動捲動）改以「目前分頁的
  分組清單」為底，服務與書籤共用；移除沒有綁定的 HTML5 拖放事件與寫死服務
  清單的落點解析重複程式碼。
- 書籤分組卡補上與服務一致的拖曳目標提示（drag-over 外框、插入指示條）。
- 工具列統計與服務一致：分組數加項目總數。
- 移除重複的 `toggleBookmarkGroup`，書籤分組改用共用的折疊函式。
- 無頭 Chrome 測試覆蓋書籤分頁的排序按鈕、跨分組移動與拖曳指示。

## Capabilities

### New Capabilities

（無）

### Modified Capabilities

- `config-editing`：書籤分組可管理擴充為可排序、可拖曳、可跨分組移動，
  與服務分組同行為；兩頁共用同一套拖放引擎。

## Impact

- Affected specs: `config-editing`（MODIFIED）
- Affected code: `public/index.html`、`public/app.js`、`locales/*.ini`、
  `tests/verify-bookmarks.mjs`
- 不改動存檔流程：排序與移動仍操作記憶體中的 YAML 物件，存檔時照舊寫回
  bookmarks.yaml，未建模欄位照舊保留。
