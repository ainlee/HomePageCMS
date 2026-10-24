# Design

## Context

見 proposal.md 的 Why。服務對話框目前只建模 href、description、target、icon 與單一 widget（container、ping、customapi 三種寫法）；書籤對話框只建模 name、href、abbr。存檔流程已支援未建模欄位保留（以原始物件為底，只覆蓋編輯過的欄位），因此新增欄位只需擴充讀寫對應，不需改存檔骨架。

## Goals / Non-Goals

**Goals:**

- 書籤補齊 description 與 icon 的讀寫與顯示。
- 服務補齊 server、weight、namespace、app、podSelector 的讀寫。
- 服務支援複數 widgets 的讀寫，同時保留現有單一 widget 寫法。
- 四個語系檔與測試同步覆蓋新增欄位。

**Non-Goals:**

- 不改動存檔流程（hash 檢查、備份、保留未建模欄位）。
- 不改動分組層級欄位（col-span 除外）。
- 不做 Homepage 的 layout 或 settings.yaml 編輯。

## Decisions

- 新增欄位沿用現有的 setOrDelete 寫法：有值寫入，無值刪除，避免空字串污染 YAML。
- widget 讀寫採方言保留：既有單一 widget 的三種形狀（widget 物件、legacy customapi、container 或 ping 簡寫）維持原樣回寫；複數 widgets 以陣列保存，不與單一寫法互轉。
- Kubernetes 欄位採 namespace 加 app 為主、podSelector 為輔：app 對應標準 label 查 pod，podSelector 覆蓋非標準 label 情境。
- 書籤說明未填時顯示維持現狀（Homepage 端顯示連結主機名稱），編輯器不自行預填。

## Risks / Trade-offs

- 複數 widgets 的欄位結構（fields、mappings、headers）複雜，先以 YAML 原樣保留加基本編輯為主，完整表單化留待後續：過度表單化會讓對話框難以維護。
- Kubernetes 需要 cluster mode 與 ServiceAccount 權限，編輯器只負責寫欄位，不驗證叢集連線：寫錯只會讓 Homepage 顯示異常，不影響存檔流程。

