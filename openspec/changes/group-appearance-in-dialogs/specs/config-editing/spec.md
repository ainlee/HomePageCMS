# Spec Delta

## MODIFIED Requirements

### Requirement: 服務分組可管理

系統 SHALL 讓使用者新增、重新命名、刪除與折疊服務分組。分組對話框 SHALL
提供外觀區：分頁（tab）、排列樣式（style）、欄數（columns）、標題顯示
（header）、初始折疊（initiallyCollapsed）與等高卡片（useEqualHeights），
資料寫入 settings.yaml 的 layout 區塊、以群組名稱為鍵。分頁欄位 SHALL 可
自由輸入，SHALL 以下拉列出所有已存在的分頁名（服務與書籤群組共用同一個
layout 名空間）。群組的分頁被清空時，SHALL 只影響該群組自身：該群組退回
顯示在所有分頁；該分頁值在其他群組仍在引用時維持存活，當沒有任何群組
使用它時自然消失——系統 SHALL NOT 主動級聯清空其他群組的分頁值。群組刪除 SHALL
連同該群組名對應的 layout 條目一併移除。分組對話框 SHALL NOT 提供上游不讀取
的欄位（col-span）；檔案裡既有的 col-span SHALL 以未建模欄位保留。

#### Scenario: 在對話框設定分組外觀
- **WHEN** 使用者在分組對話框的外觀區設定 tab 為 Media、style 為 row 並確認
- **THEN** settings.yaml 的 layout 對該群組名含 tab: Media 與 style: row，
  儀表板重載後該群組出现在 Media 分頁

#### Scenario: 分頁下拉列出既有分頁
- **WHEN** 兩個群組已分別設定 tab 為 A 與 B，使用者開啟第三群組的分頁欄位
- **THEN** 下拉列出 A 與 B，亦可輸入新的分頁名

#### Scenario: 清空分頁只影響該群組
- **WHEN** 群組 X、Y 都設 tab 為 Media，使用者把 X 的分頁 chip 按 X 清空
- **THEN** X 退回顯示在所有分頁；Y 保留 tab: Media，存檔後 settings.yaml 的
  layout 仍有 Y 的 tab: Media；當其他群組都清空後該分頁才自然消失

#### Scenario: 改動群組分頁不影響其他群組
- **WHEN** 群組 X 設 tab 為 Media、群組 Y 設 tab 為 Other，使用者把 X 改成 Other
- **THEN** 只有 X 的值改變，Y 與其他群組不受影響

#### Scenario: 刪除分組連同 layout 條目
- **WHEN** 使用者刪除一個已有 layout 條目（icon、tab…）的分組
- **THEN** 該分組自 services.yaml 移除，settings.yaml 的 layout 不再有該群組名的
  條目；其他條目與順序不變

#### Scenario: 設定分組寬度會寫入檔案
- **WHEN** services.yaml 的某分組已有 col-span，使用者存檔
- **THEN** 該分組的 col-span 以未建模欄位保留、Homepage 仍能解析整份設定檔；
  介面不提供設定此欄位（群組寬度改由 layout 區塊的 columns 決定）

### Requirement: 書籤分組可管理

系統 SHALL 讓使用者新增、編輯、刪除書籤分組與其中的書籤項目，每個書籤包含
名稱、縮寫、連結、說明（description）、圖示（icon）與開啟目標（target）。
書籤項目的對話框 SHALL 顯示上述欄位；名稱與連結 SHALL 為必填；縮寫留空時
SHALL 以名稱的前兩個字元補上；說明未填時 Homepage 顯示連結主機名稱；編輯器
沒有建模的欄位 SHALL 在存檔時保留。書籤分組對話框 SHALL 提供與服務分組同構
的外觀區（分頁、排列樣式、欄數、標題顯示、初始折疊、等高卡片），資料寫入
settings.yaml 的 layout 區塊；清空分頁（只影響該群組自身）與群組刪除連同
layout 條目移除的行為 SHALL 與服務分組一致（服務與書籤群組共用同一個
layout 名空間）。

#### Scenario: 新增書籤
- **WHEN** 使用者新增書籤並提供名稱、縮寫與連結
- **THEN** 該書籤出現在所選分組中，存檔後寫入 bookmarks.yaml

#### Scenario: 設定書籤分組的分頁
- **WHEN** 使用者在書籤分組對話框把 tab 設為 Tools 並存檔
- **THEN** settings.yaml 的 layout 對該書籤分組名含 tab: Tools，該分組出现在
  Tools 分頁；服務分組若設同一 tab 亦會出現在該分頁
