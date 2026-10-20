# Tasks

## 1. 前端改用 YAML 物件模型

- [x] 1.1 伺服器提供 js-yaml 給瀏覽器使用
- [x] 1.2 解析 settings 時保留原始物件（分組與服務的完整欄位）
- [x] 1.3 存檔時以原始物件為底覆蓋編輯過的欄位，再以 js-yaml 輸出
- [x] 1.4 分組寬度寫成 `col-span`，並排在分組名稱之後

## 2. 狀態小工具

- [x] 2.1 解析上游 `widget` 物件（customapi / ping / docker）
- [x] 2.2 新的自訂 API 小工具寫成 `widget: { type: customapi, url }`
- [x] 2.3 既有服務沿用原本的小工具方言（`customapi` 或 `widget`）

## 3. 範例檔與文件

- [x] 3.1 `config/services.example.yaml` 改用上游 widget 語法
- [x] 3.2 README 說明保真行為與方言沿用規則

## 4. 驗證

- [x] 4.1 含 `siteMonitor`、`widget`、巢狀分組的檔案存檔後內容不減
- [x] 4.2 刪除的服務不會被還原（沒有出現在合併後的檔案裡）
- [x] 4.3 `npm test` 三組版面測試通過（20/20、42/42、14/14）

