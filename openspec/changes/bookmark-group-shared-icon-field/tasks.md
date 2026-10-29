# Tasks

## 1. 前端共用化

- [x] 1.1 public/app.js：抽出模組層級的 icon 預覽 helper 與 icon-field 共用
  元件（template 形式，vue.global 含編譯器），註冊為 icon-field
- [x] 1.2 public/index.html：服務群組、版面群組、服務項目、書籤項目四處私有
  icon 區塊全數改用 icon-field；書籤群組對話框補上 icon 欄位
- [x] 1.3 saveGroup／saveBookmarkGroup 共用 groupLayoutIconOf 與
  syncGroupLayoutIcon，兩邊群組圖示的 layout 同步行為一致
- [x] 1.4 寫死的 placeholder 改為語系鍵；四份語系檔新增 group.iconPlaceholder
  與 layout.iconPlaceholder

## 2. 驗證

- [x] 2.1 tests/verify-group-icon-shared.mjs：共用欄位在兩個群組對話框渲染、
  即時預覽、書籤群組 icon 經存檔寫入 layout 區塊；納入 npm test 主鏈
- [x] 2.2 npm test 全數通過（17 組，含本組 8 項檢查）
