# config-editing Spec Delta

## MODIFIED Requirements

### Requirement: 服務可設定狀態小工具

系統 SHALL 讓每個服務選擇狀態追蹤方式與通用參數：widget 型別（無或上游支援的任意型別）、
對應值、Docker 主機（server）、排序權重（weight）、Kubernetes 目標（namespace、app、podSelector）。
服務 SHALL 可掛多個 widget（複數 widgets），並 SHALL 提供每組 widget 的通用欄位（url、key、
container、host、fields、hideErrors）；未建模的欄位（headers、highlight 等）SHALL 保留原樣。
未填的欄位 SHALL 不寫入；檔案裡的 widget 型別不在清單中時 SHALL 保留原值並提示。
服務 SHALL 可設定 siteMonitor 網址、狀態樣式（statusStyle：dot／basic／未設）與統計展開
（showStats：未設或明確關閉兩選；上游只有明確 false 會關閉統計，未設時跟隨全域 showStats，
明確設 true 等同未設，故不提供「開」選項）。

#### Scenario: 設定容器追蹤
- **WHEN** 使用者將狀態追蹤設為本機 Docker 容器並填入容器名稱
- **THEN** 存檔後的 YAML 對該服務包含 container 欄位

#### Scenario: 設定 Docker 主機
- **WHEN** 使用者填入 Docker 主機名稱（對應 docker.yaml 的主機）
- **THEN** 存檔後的 YAML 對該服務包含 server 欄位，未填時不寫入此欄位

#### Scenario: 設定排序權重
- **WHEN** 使用者填入排序權重數值
- **THEN** 存檔後的 YAML 對該服務包含 weight 欄位，未填時不寫入此欄位

#### Scenario: 設定 Kubernetes 目標
- **WHEN** 使用者填入 namespace 與 app（或自訂 podSelector）
- **THEN** 存檔後的 YAML 對該服務包含對應的 namespace、app 或 podSelector 欄位

#### Scenario: 掛多個 widget
- **WHEN** 使用者為同一服務設定多個 widget
- **THEN** 存檔後的 YAML 對該服務包含複數 widgets 陣列，且原有的單一 widget 寫法仍可讀寫

#### Scenario: 設定 ping 追蹤
- **WHEN** 使用者將狀態追蹤設為遠端 ICMP Ping 並填入 IP 位址
- **THEN** 存檔後的 YAML 對該服務包含 ping 欄位

#### Scenario: 設定 siteMonitor
- **WHEN** 使用者填入 siteMonitor 網址並存檔
- **THEN** 存檔後的 YAML 對該服務包含 siteMonitor 欄位，未填時不寫入

#### Scenario: 未建模的 widget 型別保留
- **WHEN** 檔案裡的 widget 型別不在清單中（例如上游新版新增的型別）
- **THEN** 該 widget 原樣保留，介面顯示其原值並提示型別未被建模

#### Scenario: 明確關閉統計展開
- **WHEN** 使用者把 showStats 設為明確關閉並存檔
- **THEN** 存檔後的 YAML 對該服務包含 showStats: false，卡片不再顯示統計區

#### Scenario: showStats 未設跟隨全域
- **WHEN** 使用者把 showStats 設為未設（跟隨全域）並存檔
- **THEN** 存檔後該服務不寫 showStats 欄位，卡片統計區依全域 showStats 決定

## ADDED Requirements

### Requirement: 服務欄位的繼承提示

服務項目標的 showStats 與 statusStyle 未設定時 SHALL 依全域值動態顯示繼承結果：
全域未設時顯示預設值（showStats 不展開、statusStyle 為無值的完整顯示），全域已設時顯示全域值；
欄位設為明確值且與全域值不同時 SHALL 顯示「覆寫全域（全域：X）」提示。提示 SHALL 為
標籤行內的單行文字，空間不足時截斷，不另起一行。

#### Scenario: 未設定的 showStats 顯示全域繼承
- **WHEN** 全域 showStats 未設定、項目標的 showStats 為未設
- **THEN** 該欄位的提示顯示「跟隨全域：不展開」；全域設為開時顯示「跟隨全域：展開」

#### Scenario: 明確的 statusStyle 顯示覆寫提示
- **WHEN** 全域 statusStyle 為 dot、項目標明確設為 basic
- **THEN** 該欄位的提示顯示「覆寫全域（全域：dot）」；未設時提示顯示「跟隨全域：無值（完整顯示）」

### Requirement: 群組卡片的版面摘要

服務與書籤群組的卡片 SHALL 顯示版面摘要：樣式未設定時以 columns 呈現；樣式非 row 時
不顯示欄數；任何欄位（初始折疊、等高卡片）明確覆寫全域值時 SHALL 在摘要加覆寫圖示。

#### Scenario: 摘要依樣式顯示欄數
- **WHEN** 群組樣式為 row 且欄數為 4
- **THEN** 卡片摘要顯示 row × 4；樣式未設定時摘要顯示 columns 且不含欄數

#### Scenario: 覆寫全域顯示圖示
- **WHEN** 群組的 initiallyCollapsed 與全域 groupsInitiallyCollapsed 相反
- **THEN** 卡片摘要含覆寫圖示；未覆寫時不含
