# Spec Delta

## MODIFIED Requirements

### Requirement: 設定檔位置可由環境變數指定

系統 SHALL 從 HOMEPAGE_CONFIG_PATH 讀取設定檔位置，未設定時使用專案目錄下的
config。首次啟動且設定檔不存在時，系統 SHALL 由範例檔建立初始設定；已存在的
檔案 MUST NOT 被範例檔覆寫。初始設定包含 services.yaml、bookmarks.yaml 與
widgets.yaml。

#### Scenario: 乾淨環境首次啟動
- **WHEN** 設定路徑下沒有 services.yaml、bookmarks.yaml 與 widgets.yaml
- **THEN** 伺服器以對應的範例檔建立三份檔案

#### Scenario: 已有設定不被覆寫
- **WHEN** 設定路徑下已存在某份設定檔
- **THEN** 伺服器保留原檔，不以範例檔覆寫
