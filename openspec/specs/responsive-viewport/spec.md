# 可見範圍版面

## Purpose

行動版瀏覽器的 100vh 與 100dvh 指的是「網址列收起時」的高版本畫面，比使用者實際看得見的範圍高。若版面依此計算，又禁止捲動，畫面底端的內容就會永遠碰不到。版面高度 MUST 以實測的可見範圍為準。

## Requirements

### Requirement: 以實測可見範圍計算高度

系統 SHALL 在執行時期量測可見範圍，取 window.innerHeight 與 window.visualViewport.height 中較小的一個，寫入 --app-height，並以此作為 html 與 body 的高度。系統 MUST NOT 以 dvh 作為最終高度來源。

#### Scenario: 可見範圍小於版面視窗

- **WHEN** 可見範圍為 600px 而版面視窗為 844px
- **THEN** html 與 body 的高度為 600px，內容不超出可見範圍

#### Scenario: 內建高度與實測一致

- **WHEN** 可見範圍與版面視窗同為 844px
- **THEN** html 與 body 的高度為 844px，版面填滿可視區

### Requirement: 根元素不可捲動

系統 SHALL 將 html 與 body 的 overflow 設為 hidden，確保頁面本身不會被捲動或平移。內容 MUST 改由編輯面板內部捲動。

#### Scenario: 嘗試捲動頁面

- **WHEN** 使用者嘗試捲動頁面
- **THEN** 頁面位置不變，畫面底端不會被推離可見範圍

#### Scenario: 服務列表可捲至最後一組

- **WHEN** 使用者在編輯面板內捲動到最底
- **THEN** 最後一個服務分組完整出現在可見範圍內

### Requirement: 可見範圍變化時重新量測

系統 SHALL 在視窗尺寸變更、裝置旋轉，以及可視視窗的 resize 或 scroll 事件發生時重新量測可見範圍。系統 MUST 合併同一個事件循環內的重複量測，且僅在數值改變時才更新樣式。

#### Scenario: 旋轉裝置

- **WHEN** 裝置從直向旋轉為橫向
- **THEN** 版面高度更新為新的可見範圍高度

#### Scenario: 網址列收合

- **WHEN** 使用者操作網址列使可視視窗高度改變
- **THEN** 版面高度隨之更新，底部內容仍可觸及

### Requirement: 視窗在可見範圍內關閉

系統 SHALL 將對話視窗的遮罩與內容錨定於實測的可見範圍，而非版面視窗，使鍵盤彈出時操作按鈕仍可被點擊。

#### Scenario: 鍵盤彈出時開啟對話視窗

- **WHEN** 鍵盤使可見範圍縮短至 340px 後開啟新增分組對話視窗
- **THEN** 對話視窗完全位於 340px 範圍內，確定按鈕可被點擊
