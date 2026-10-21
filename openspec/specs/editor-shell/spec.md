# editor-shell Specification

## Purpose
TBD - created by archiving change topbar-controls-and-dialog-stacking. Update Purpose after archive.

## Requirements

### Requirement: 頂端工具列提供語言與配色入口

系統 SHALL 在頂端工具列提供語言與配色方案的入口。語言入口 SHALL 以動畫展開的
下拉選單呈現，列出所有可用的語言，點選其中一項即切換介面語言，且選單在點選後
或點擊選單以外的地方時 SHALL 自動收合。配色方案入口 SHALL 直接開啟配色方案
視窗。

頂端工具列的按鈕 SHALL 全部同高，圖示按鈕 SHALL 同寬，MUST NOT 有按鈕因為被
包在容器裡而看起來比較小。畫面變窄時，工具列 MUST NOT 水平溢出；標題 SHALL
先以省略號縮排讓出空間。

#### Scenario: 從頂端工具列切換語言

- **WHEN** 使用者點擊頂端工具列的語言按鈕
- **THEN** 下拉選單展開並列出所有可用語言；點選其中一項後，介面立即換成該
  語言，選單自動收合

#### Scenario: 點擊選單外面會收合

- **WHEN** 下拉選單展開時，使用者點擊選單以外的地方
- **THEN** 選單收合

#### Scenario: 從頂端工具列開啟配色方案

- **WHEN** 使用者點擊頂端工具列的配色方案按鈕
- **THEN** 配色方案視窗開啟，且疊在其他視窗之上，看得見

#### Scenario: 按鈕大小一致

- **WHEN** 使用者看著頂端工具列
- **THEN** 每個按鈕的高度相同，圖示按鈕的寬度也相同

#### Scenario: 窄螢幕不溢出

- **WHEN** 視窗寬度為 390px
- **THEN** 頂端工具列的內容不超過畫面寬度，標題以省略號截短

### Requirement: 設定視窗顯示專案名稱與版本

系統 SHALL 在設定視窗的按鈕列左側靠左顯示專案名稱與版本號，並 SHALL 讓專案名稱
成為指向原始碼倉庫的連結。系統 SHALL 從套件檔取得版本號與倉庫網址，MUST NOT 在
程式碼或樣式表中寫死；升版時只改套件檔即可。

#### Scenario: 設定視窗顯示名稱與版本

- **WHEN** 使用者開啟設定視窗
- **THEN** 按鈕列左側顯示專案名稱與版本號，右側仍是取消與儲存按鈕

#### Scenario: 名稱連到倉庫

- **WHEN** 使用者點擊專案名稱
- **THEN** 瀏覽器在新分頁開啟該專案的原始碼倉庫

#### Scenario: 版本跟著套件檔走

- **WHEN** 套件檔的版本改了並重新啟動編輯器
- **THEN** 設定視窗顯示的是新的版本號
