# Spec Delta

## MODIFIED Requirements

### Requirement: 服務分組可管理

系統 SHALL 讓使用者新增、重新命名、刪除與折疊服務分組。群組版面設定
（圖示、分頁、排列樣式、欄數、標題顯示、初始折疊、等高卡片）SHALL 寫入
settings.yaml 的 layout 區塊、以群組名稱為鍵；群組改名時該 layout 條目
SHALL 跟著改名，設定內容不遺失。

#### Scenario: 為群組設定版面
- **WHEN** 使用者在群組對話框設定圖示與分頁並存檔
- **THEN** settings.yaml 的 layout 對該群組含有對應的 icon 與 tab

#### Scenario: 群組改名時版面跟著改
- **WHEN** 使用者把有 layout 設定的群組改名並存檔
- **THEN** settings.yaml 的 layout 以新群組名為鍵，舊鍵移除，設定值保留
