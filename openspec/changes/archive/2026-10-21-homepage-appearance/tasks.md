# Tasks

## 1. 後端

- [x] 1.1 新增 `lib/homepage-appearance.js`：色階資料、選項、讀取與套用
- [x] 1.2 `GET /api/homepage-settings` 讀出視覺欄位與檔案雜湊
- [x] 1.3 `PUT /api/homepage-settings` 備份後寫回，只覆蓋被編輯的欄位

## 2. 介面

- [x] 2.1 新增「首頁外觀」分頁與表單（配色色票、樣式下拉、背景與濾鏡）
- [x] 2.2 外觀分頁有獨立的儲存鈕，頂端儲存也會一併存檔；沒有改動時不重複寫檔
- [x] 2.3 四個內建語系檔補上外觀介面的文字

## 3. 測試

- [x] 3.1 無頭 Chrome 測試確認改配色會寫進 settings.yaml，其他欄位不動
- [x] 3.2 測試結束後把 settings.yaml 還原
