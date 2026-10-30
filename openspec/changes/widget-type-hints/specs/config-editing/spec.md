# Spec Delta

## MODIFIED Requirements

### Requirement: 服務可設定狀態小工具

系統 SHALL 讓每個服務選擇狀態追蹤方式與通用參數：widget 型別（無或上游支援的任意型別）、對應值、Docker 主機（server）、排序權重（weight）、Kubernetes 目標（namespace、app、podSelector）。型別清單 SHALL 包含上游服務層支援的 ping（ICMP 監控）；選 ping 時填的主機值（host）SHALL 寫回服務的 ping 欄位。服務 SHALL 可掛多個 widget（複數 widgets），並 SHALL 提供每組 widget 的通用欄位（url、key、container、host、fields、hideErrors）；未建模的欄位（headers、highlight 等）SHALL 保留原樣。未填的欄位 SHALL 不寫入；檔案裡的 widget 型別不在清單中時 SHALL 保留原值並提示。服務 SHALL 可設定 siteMonitor 網址、狀態樣式（statusStyle：dot／basic／未設）與統計展開（showStats：true／false／未設）。型別下拉的每列 SHALL 顯示一句話提示（見 select-hints）。

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
- **WHEN** 使用者將 widget 型別選為 ping 並填入 IP 位址或主機
- **THEN** 存檔後的 YAML 對該服務包含 ping 欄位（舊式單一 widget 寫法或 widget 物件皆可）；未填主機時不寫入

#### Scenario: 設定 siteMonitor
- **WHEN** 使用者填入 siteMonitor 網址並存檔
- **THEN** 存檔後的 YAML 對該服務包含 siteMonitor 欄位，未填時不寫入

#### Scenario: 未建模的 widget 型別保留
- **WHEN** 檔案裡的 widget 型別不在清單中（例如上游新版新增的型別）
- **THEN** 該 widget 原樣保留，介面顯示其原值並提示型別未被建模
