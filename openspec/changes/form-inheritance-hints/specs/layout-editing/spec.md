# layout-editing Spec Delta
 
## MODIFIED Requirements
 
### Requirement: layout 群組可視化編輯
 
系統 SHALL 讓使用者編輯 settings.yaml 的 layout 區塊：依群組名稱設定圖示（icon）、
分頁（tab）、排列樣式（style）、欄數（columns）、標題（header，二元開關：顯示／隱藏）、
初始折疊（initiallyCollapsed）與等高卡片（useEqualHeights）。標題（header）SHALL 以二元開關
呈現（上游是 header 不等於 false 才顯示，未設定與「顯示」同義，不提供第三選）。layout 中沒有對應
services.yaml 群組的條目（例如 Docker 自動發現群組）SHALL 照常顯示與編輯。
存檔時 SHALL 只改寫 settings.yaml 的 layout 鍵，檔案裡其它未建模的鍵保留。
 
#### Scenario: 為群組設定分頁
- **WHEN** 使用者為某群組設定 tab 為 First 並存檔
- **THEN** settings.yaml 的 layout.First 含有該群組，儀表板顯示分頁標籤
 
#### Scenario: 刪除 layout 條目
- **WHEN** 使用者刪除一個 layout 群組並存檔
- **THEN** settings.yaml 的 layout 沒有該鍵，其它條目與順序不變
 
#### Scenario: 標題為二元開關
- **WHEN** 使用者開啟群組對話框查看標題（header）欄位
- **THEN** 該欄位只有「顯示」與「隱藏」兩個選項，預設為顯示；選擇顯示後存檔不寫入
  header 欄位，選擇隱藏後存檔寫入 header: false
 
### Requirement: settings 全域開關可視化編輯
 
系統 SHALL 提供 settings.yaml 的全域開關表單：fullWidth、maxGroupColumns、
maxBookmarkGroupColumns、disableCollapse、groupsInitiallyCollapsed、
useEqualHeights、bookmarksStyle、target、language、hideVersion、
disableUpdateCheck、hideErrors、statusStyle、showStats、disableIndexing、
instanceName、title、description、startUrl、favicon、base、logpath。
未填的值 SHALL 從檔案移除；已建模以外與未填以外（例如 providers、quicklaunch、
pwa、blockHighlights）的鍵 SHALL 保留原樣。
 
maxGroupColumns 與 maxBookmarkGroupColumns 存檔時 SHALL 驗證為 5–8 的整數：
超出範圍或非整數的值 SHALL 不寫入檔案，存檔回應 SHALL 帶錯誤訊息（經 i18n 翻譯），
該欄位 SHALL 顯示範圍提示。載入時對超出範圍的既有值 SHALL 照實顯示並標示超範圍；
下次存檔時超範圍值 SHALL 不寫回（從檔案移除）。
 
#### Scenario: 開啟全文寬
- **WHEN** 使用者勾選 fullWidth 並存檔
- **THEN** settings.yaml 含有 fullWidth: true，儀表板重新載入後佔滿視窗寬度
 
#### Scenario: 未建模的鍵保留
- **WHEN** settings.yaml 含有 providers 與 quicklaunch，使用者存檔全域開關
- **THEN** providers 與 quicklaunch 的內容不變
 
#### Scenario: maxGroupColumns 超出範圍被擋下
- **WHEN** 使用者把 maxGroupColumns 填成 3（低於 5）並存檔
- **THEN** 該值不寫入檔案，存檔回應含翻譯後的錯誤訊息，該欄位顯示範圍提示
 
#### Scenario: 既有超範圍值顯示但不寫回
- **WHEN** settings.yaml 已有 maxGroupColumns: 10，使用者載入版面分頁後存檔
- **THEN** 該欄位照實顯示 10 並標示超範圍；存檔後該值從檔案移除
 
## ADDED Requirements
 
### Requirement: 群組版面欄位的防呆與繼承提示
 
群組版面表單——服務群組、書籤群組與「版面」分頁的群組對話框 SHALL 共用同一套規則：
排列樣式未設定時的選項文案 SHALL 標示其效果等同 columns 樣式；欄數輸入框在樣式
非 row 時 SHALL 停用並置灰，並顯示「僅 row 樣式生效」提示；初始折疊與等高卡片設為
未設定時 SHALL 依全域值動態顯示繼承結果（全域未設時顯示預設方向：初始折疊不折疊、
等高卡片為關；全域已設時顯示全域值），設為明確值且與全域值不同時 SHALL 顯示
「覆寫全域（全域：X）」提示；分頁未填且其他群組有分頁時 SHALL 提示該群組顯示於
所有分頁。提示 SHALL 為標籤行內的單行文字，空間不足時截斷，不另起一行。
 
#### Scenario: 欄數在非 row 樣式下停用
- **WHEN** 群組對話框的樣式為未設定或 columns
- **THEN** 欄數輸入框停用置灰，標籤行顯示「僅 row 樣式生效」；改為 row 後輸入框恢復可用
 
#### Scenario: 未設定時顯示繼承結果
- **WHEN** 全域 groupsInitiallyCollapsed 未設定，群組的 initiallyCollapsed 為未設定
- **THEN** 該欄位的提示顯示「跟隨全域：不折疊」；若全域已設為開則顯示「跟隨全域：折疊」
 
#### Scenario: 明確覆寫全域時顯示覆寫提示
- **WHEN** 全域 groupsInitiallyCollapsed 為「折疊」、群組的 initiallyCollapsed 明確設為「不折疊」
- **THEN** 該欄位的提示顯示「覆寫全域（全域：折疊）」
 
#### Scenario: 分頁未填時提示顯示範圍
- **WHEN** 其他群組已設定分頁、本群組未填分頁
- **THEN** 分頁欄位提示顯示「此群組顯示於所有分頁」；所有群組都沒填分頁時不顯示此提示
 
### Requirement: 版面分頁群組列的摘要
 
版面分頁的群組列 SHALL 顯示版面摘要：樣式未設定時以 columns 呈現；樣式非 row 時
不顯示欄數；任何欄位（初始折疊、等高卡片）明確覆寫全域值時 SHALL 在摘要加覆寫圖示。
 
#### Scenario: 摘要依樣式顯示欄數
- **WHEN** 群組樣式為 row 且欄數為 4
- **THEN** 該群組列的摘要顯示 row × 4；樣式未設定時摘要顯示 columns 且不含欄數
 
#### Scenario: 覆寫全域顯示圖示
- **WHEN** 群組的 initiallyCollapsed 與全域 groupsInitiallyCollapsed 相反
- **THEN** 該群組列的摘要含覆寫圖示；未覆寫時不含
