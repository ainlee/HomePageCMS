# Spec Delta

## MODIFIED Requirements

### Requirement: 書籤分組可管理

系統 SHALL 讓使用者新增、編輯、刪除書籤分組與其中的書籤項目，每個書籤包含
名稱、縮寫、連結、說明（description）、圖示（icon）與開啟目標（target）。
書籤項目的對話框 SHALL 顯示上述欄位；名稱與連結 SHALL 為必填；縮寫留空時
SHALL 以名稱的前兩個字元補上；說明未填時 Homepage 顯示連結主機名稱；編輯器
沒有建模的欄位 SHALL 在存檔時保留。書籤分組的編輯對話框 SHALL 提供群組圖示
（icon）欄位，與服務分組對話框共用同一套 icon 輸入與即時預覽元件，SHALL
於存檔時同步寫入 settings.yaml 的 layout 區塊（見 layout-editing）；編輯時
SHALL 帶入該群組 layout 條目現有的圖示。

#### Scenario: 新增書籤
- **WHEN** 使用者新增書籤並提供名稱、縮寫與連結
- **THEN** 該書籤出現在所選分組中，存檔後寫入 bookmarks.yaml

#### Scenario: 編輯書籤連結
- **WHEN** 使用者按下書籤項目的編輯鈕
- **THEN** 對話框顯示名稱、連結與縮寫，連結欄位帶入目前的連結；使用者修改
  連結並確認後，書籤列表顯示新的連結，存檔後寫入 bookmarks.yaml

#### Scenario: 設定書籤說明
- **WHEN** 使用者在書籤對話框填入說明並存檔
- **THEN** 存檔後的 bookmarks.yaml 對該書籤包含 description 欄位

#### Scenario: 連結留空
- **WHEN** 使用者在書籤對話框把連結清空後確認
- **THEN** 對話框不關閉並提示需要連結，該書籤的連結不被清空

#### Scenario: 重新命名書籤分組
- **WHEN** 使用者按下書籤分組的編輯鈕並輸入新的名稱
- **THEN** 分組以新名稱顯示，存檔後 bookmarks.yaml 的分組鍵名一併更新

#### Scenario: 設定書籤開啟目標
- **WHEN** 使用者把書籤的 target 設為 _blank 並存檔
- **THEN** 存檔後的 bookmarks.yaml 對該書籤包含 target 欄位，未填時不寫入

#### Scenario: 設定書籤分組圖示
- **WHEN** 使用者在書籤分組的編輯對話框填入圖示並存檔
- **THEN** settings.yaml 的 layout 對該分組包含 icon 欄位，行為與服務分組
  對話框一致
