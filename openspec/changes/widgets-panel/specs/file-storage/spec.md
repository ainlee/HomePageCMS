# Spec Delta

## MODIFIED Requirements

### Requirement: 首次啟動建立初始設定

系統 SHALL 在首次啟動且設定檔不存在時，由專案目錄的範例檔（*.example.yaml）
建立 services.yaml、bookmarks.yaml 與 widgets.yaml；已存在的檔案 MUST NOT 被
範例檔覆寫。

#### Scenario: 乾淨環境首次啟動
- **WHEN** 設定路徑下沒有 services.yaml、bookmarks.yaml 與 widgets.yaml
- **THEN** 伺服器以對應的範例檔建立三份檔案

#### Scenario: 已有設定不被覆寫
- **WHEN** 設定路徑下已存在某份設定檔
- **THEN** 伺服器保留原檔，不以範例檔覆寫
