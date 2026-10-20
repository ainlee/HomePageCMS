# first-run-setup Specification

## Purpose
TBD - created by archiving change first-run-setup. Update Purpose after archive.

## Requirements

### Requirement: 首次訪問進入設定流程

系統 SHALL 在編輯器設定檔不存在時，於首次訪問時開啟設定視窗；設定檔存在時
MUST NOT 阻擋使用者進入編輯頁。

#### Scenario: 全新安裝

- **WHEN** 使用者第一次開啟編輯器，且編輯器設定檔不存在
- **THEN** 系統開啟設定視窗，視窗標題為「設定」

#### Scenario: 已經設定過

- **WHEN** 使用者開啟編輯器，且編輯器設定檔已存在
- **THEN** 系統直接進入編輯頁，不開啟設定視窗

#### Scenario: 設定完成後不再阻擋

- **WHEN** 使用者在首次設定視窗儲存了設定
- **THEN** 設定檔被建立，之後的訪問不再顯示設定視窗

### Requirement: 設定欄位顯示預設值

系統 SHALL 讓每個設定欄位預設填入目前生效的值，欄位有值時 MUST NOT 只顯示提示
文字。提示文字 SHALL 說明該欄位被清空時會套用什麼（環境變數的值或內建預設值）。
系統 MUST NOT 讓提示文字與實際預設值不一致。

#### Scenario: 欄位有值時顯示該值

- **WHEN** 某個設定有生效值（來自設定檔、環境變數或預設值）
- **THEN** 欄位內容為該值，而不是只有提示文字

#### Scenario: 欄位留空時顯示預設值

- **WHEN** 使用者清空某個欄位
- **THEN** 該欄位以提示文字顯示清空後會套用的值

#### Scenario: 來源仍然可見

- **WHEN** 使用者開啟設定視窗
- **THEN** 每個欄位下方仍顯示目前生效值與其來源（設定檔／環境變數／預設值）

### Requirement: 設定視窗涵蓋所有執行期設定

系統 SHALL 在設定視窗提供下列欄位：Homepage 訪問網址、監聽位址、Homepage
設定檔位置、備份位置、編輯器設定檔位置、存取保護。

#### Scenario: 欄位清單

- **WHEN** 使用者開啟設定視窗
- **THEN** 視窗中可設定 Homepage 訪問網址、監聽位址、Homepage 設定檔位置、
  備份位置、編輯器設定檔位置與存取保護

#### Scenario: 設定 Homepage 設定檔位置

- **WHEN** 使用者把 Homepage 設定檔位置改成另一個目錄並儲存
- **THEN** 編輯器之後讀寫的 services.yaml 與 bookmarks.yaml 來自新目錄

#### Scenario: 設定備份位置

- **WHEN** 使用者把備份位置改成另一個目錄並儲存
- **THEN** 之後的備份寫入新目錄

#### Scenario: 設定編輯器設定檔位置

- **WHEN** 使用者把編輯器設定檔位置改成另一個路徑並儲存
- **THEN** 設定被寫到新路徑，重新啟動後編輯器仍從新路徑讀取設定
