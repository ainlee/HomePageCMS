# Change: bookmark-group-shared-icon-field

## Why

群組標題的 icon 與書籤群組標題的 icon 都寫進 settings.yaml 的 layout 區塊，
但服務群組的編輯對話框有 icon 欄位、書籤群組的卻沒有——「icon 輸入＋即時預覽」
這段 UI 在 index.html 裡被複製了四份各自維護，書籤群組對話框當初對齊體驗時
漏掉，saveBookmarkGroup 也從未把 icon 同步進 layout 區塊。散落各處單獨編寫
就是功能落差的根因。

## What Changes

- 抽出共用的 icon-field 元件（icon 輸入＋即時預覽），服務群組、版面群組、
  服務項目、書籤群組、書籤項目五個對話框全數改用同一份，不再各寫各的。
- 書籤群組對話框補上 icon 欄位；編輯時帶入該群組 layout 條目現有的 icon。
- saveGroup 與 saveBookmarkGroup 共用同一條 groupLayoutIconOf／
  syncGroupLayoutIcon 路徑，兩種群組圖示的讀寫行為一致。
- 寫死的 placeholder（mdi-robot / home-assistant.png）改為語系鍵
  group.iconPlaceholder、layout.iconPlaceholder，四份內建語系檔同步新增。
- 新增 tests/verify-group-icon-shared.mjs：驗證兩個群組對話框都渲染共用欄位、
  即時預覽可用、書籤群組 icon 經存檔寫入 layout 區塊。

## Capabilities

### New Capabilities

（無）

### Modified Capabilities

- config-editing：書籤群組可管理擴充為含圖示（icon），與服務群組對話框共用
  同一套 icon 輸入元件與 layout 同步路徑。

## Impact

- Affected specs: config-editing（MODIFIED）
- Affected code: public/app.js、public/index.html、locales/*.ini、
  tests/verify-group-icon-shared.mjs（新）、package.json
- 不改動存檔流程：icon 照舊經 /api/homepage-layout 寫入 settings.yaml 的
  layout 區塊，備份、hash 衝突檢查、writeFileSafe 照舊。

## 實作狀態

已實作並通過全套無頭測試（npm test：17 組全數通過，含新加的
verify-group-icon-shared 8 項檢查）。待確認後以 openspec-verify-change 驗收、
openspec-archive-change 存檔。
