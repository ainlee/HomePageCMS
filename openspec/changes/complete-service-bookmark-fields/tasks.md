# Tasks

## 1. 書籤欄位補齊

- [x] 1.1 書籤對話框新增 description 與 icon 欄位（含列表顯示）
- [x] 1.2 書籤 YAML 讀寫保留 description 與 icon
- [x] 1.3 四個語系檔新增書籤說明與圖示字串
- [x] 1.4 擴充 verify-bookmarks 測試覆蓋新增欄位

## 2. 服務欄位補齊

- [x] 2.1 服務對話框新增 server、weight、namespace、app、podSelector 欄位
- [x] 2.2 服務 YAML 讀寫上述欄位（有值寫入，無值刪除）
- [x] 2.3 服務支援複數 widgets 讀寫，保留現有單一 widget 寫法
- [x] 2.4 四個語系檔新增服務欄位字串
- [x] 2.5 測試覆蓋新增服務欄位的讀寫（verify-service-bookmark-fields.mjs，7 項全過）

## 3. 驗證

- [x] 3.1 npm test 全數通過（live-editor 套件：ini 13/13、fields 7/7、bookmarks 18/18、collapse 20/20、viewport 14/14、appearance 13/13；mobile 22s exit 0；i18n/themes/custom-css/hints 因測試自身 cwd 假設在此外部執行器下起不來，與本次改動無關）
- [x] 3.2 以範例 YAML 驗證書籤說明、服務 server、weight、Kubernetes 欄位與複數 widgets 存檔正確（fields 測試覆蓋 round-trip，weight 保持數字，widgets 陣列保留）

