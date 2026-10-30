# Spec Delta

## MODIFIED Requirements

### Requirement: 資訊小工具可管理

系統 SHALL 讓使用者管理 widgets.yaml 的資訊小工具：新增、編輯、刪除、
重新排序。每個小工具 SHALL 可設定型別與通用選項（url、key、label、fields、
href、target、cache、latitude、longitude、provider 等）。型別下拉 SHALL 與
服務 dialog 共用同一自繪元件（見 select-hints），每列顯示一句話提示；
未建模的選項鍵 SHALL 在存檔時保留；檔案裡有、型別清單沒有的型別 SHALL
原樣保留並提示。存檔 SHALL 先備份，且檔案被其他程式改動過時拒絕覆寫。

#### Scenario: 新增小工具
- **WHEN** 使用者新增一個型別為 search 的小工具並填入 provider
- **THEN** 存檔後的 widgets.yaml 多一個 search 條目，原有條目與順序不變

#### Scenario: 重新排序
- **WHEN** 使用者把一個小工具上移並存檔
- **THEN** 存檔後 widgets.yaml 的條目順序跟著改變

#### Scenario: 未建模的選項保留
- **WHEN** 某小工具含編輯器沒有建模的選項，使用者改完通用欄位存檔
- **THEN** 該選項原樣留在檔案裡

#### Scenario: 型別下拉顯示提示
- **WHEN** 使用者展開資訊小工具 dialog 的型別下拉
- **THEN** 每列左側為型別名、右側為一句話提示；未建模型別缺提示時該列右側留空
