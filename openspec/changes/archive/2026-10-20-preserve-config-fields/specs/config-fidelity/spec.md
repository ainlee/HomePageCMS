# config-fidelity

## ADDED Requirements

### Requirement: 存檔保留未建模的欄位

系統 SHALL 在寫回 YAML 時以使用者原本的設定物件為底，只覆蓋編輯器實際編輯過的
欄位。編輯器沒有建模的欄位 MUST NOT 因為存檔而消失。

#### Scenario: 未建模的服務欄位被保留

- **WHEN** 使用者的 services.yaml 中某個服務含有 `siteMonitor` 等編輯器沒有建模的
  欄位，使用者編輯其他欄位後存檔
- **THEN** 該欄位在存檔後仍然存在，值未被改動

#### Scenario: 分組層級的額外欄位被保留

- **WHEN** 使用者的分組物件含有分組層級的欄位（例如 `col-span`）
- **THEN** 該欄位在存檔後仍然存在

#### Scenario: 刪除的項目不會被還原

- **WHEN** 使用者刪掉一個服務後存檔
- **THEN** 該服務不會因為保留機制而重新出現

#### Scenario: 巢狀分組維持原樣

- **WHEN** 使用者的 services.yaml 含有巢狀分組
- **THEN** 存檔後巢狀分組維持原本的結構，不被展開成普通服務

### Requirement: 狀態小工具使用上游語法

系統 SHALL 以 Homepage 上游的語法寫出狀態小工具：容器與 ping 使用 `container` 與
`ping`，自訂 API 使用 `widget: { type: customapi, url }`。系統 MUST NOT 產生上游
不支援的服務層級 `customapi` 欄位，除非原檔本來就是那樣寫的。

#### Scenario: 新的自訂 API 小工具

- **WHEN** 使用者新增一個狀態追蹤為遠端 HTTP API 的服務並存檔
- **THEN** 該服務包含 `widget` 物件，其 `type` 為 `customapi` 且 `url` 為輸入的網址

#### Scenario: 沿用既有方言

- **WHEN** 使用者既有的服務用的是服務層級的 `customapi` 欄位，使用者只修改其他欄位
  後存檔
- **THEN** `customapi` 欄位保留，值未被改寫成別種寫法

#### Scenario: 解析上游的 widget 寫法

- **WHEN** 使用者的服務使用 `widget: { type: customapi, url }`
- **THEN** 編輯器在該服務上顯示「遠端 HTTP API」狀態追蹤與對應的網址

