# Tasks

## 1. 後端

- [x] 1.1 lib/homepage-layout.js：讀取／寫入 layout 與全域開關，保留未建模鍵
- [x] 1.2 server.js：GET/PUT /api/homepage-layout（hash 衝突檢查、備份、writeFileSafe）

## 2. 前端

- [x] 2.1 新增「版面」分頁：layout 群組列表（含孤兒條目）與全域開關表單
- [x] 2.2 群組對話框加入版面欄位；改名時同步 layout 鍵
- [x] 2.3 style.css：雙欄格線、窄螢幕單欄、8px 間距、44px 觸控目標
- [x] 2.4 四個語系檔新增字串

## 3. 驗證

- [x] 3.1 tests/verify-layout.mjs：layout 讀寫、孤兒條目、改名同步、未建模鍵保留
- [x] 3.2 npm test 全數通過
