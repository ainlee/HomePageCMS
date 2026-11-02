# Spec Delta

## MODIFIED Requirements

### Requirement: layout 群組可視化編輯

系統 SHALL 讓使用者編輯 settings.yaml 的 layout 區塊：依群組名稱設定圖示
（icon）、分頁（tab）、排列樣式（style）、欄數（columns）、標題（header）、
初始折疊（initiallyCollapsed）與等高卡片（useEqualHeights）。已綁定群組
（名稱在 services.yaml 或 bookmarks.yaml 存在）的這些欄位 SHALL 由分組對話框
的外觀區編輯；版面分頁的群組列 SHALL 只列未綁定條目（無對應群組的自動發現
群組等），並 SHALL 照常顯示、編輯與刪除。存檔時 SHALL 只改寫 settings.yaml
的 layout 鍵，檔案裡其它未建模的鍵保留。

#### Scenario: 在分組對話框設定分頁
- **WHEN** 使用者為某群組在分組對話框的外觀區設定 tab 為 First 並存檔
- **THEN** settings.yaml 的 layout 對該群組名含 tab: First，儀表板顯示分頁標籤

#### Scenario: 版面分頁只列未綁定條目
- **WHEN** 群組 A 存在於 services.yaml、群組 B 不存在（自動發現群組），
  使用者開啟版面分頁
- **THEN** 群組列只顯示 B；A 在外觀上不出現於該列（仍可在分組對話框編輯）

#### Scenario: 刪除未綁定條目
- **WHEN** 使用者刪除一個未綁定的 layout 群組並存檔
- **THEN** settings.yaml 的 layout 沒有該鍵，其它條目與順序不變

### Requirement: 分頁結構總覽

系統 SHALL 於版面分頁提供唯讀的分頁結構總覽：依 layout 條目的排列順序列出
每個分頁桶，未指定分頁的群組收於「未指派」桶；桶內的群組以 chip 呈現，
已綁定群組的 chip SHALL 可點，點擊 SHALL 開啟該群組對應的分組對話框（服務
或書籤），未綁定條目的 chip SHALL 開啟 layout 群組對話框。

#### Scenario: 檢視分頁結構
- **WHEN** 三個群組設 tab 為 Media、兩個群組未設 tab，使用者開啟版面分頁
- **THEN** 總覽列出 Media 桶（含三個 chip）與未指派桶（含兩個 chip），
  順序與 layout 條目排列一致

#### Scenario: 由總覽進入分組對話框
- **WHEN** 使用者在總覽點擊一個已綁定群組的 chip
- **THEN** 該群組的分組對話框開啟並帶入其 layout 欄位的現值
