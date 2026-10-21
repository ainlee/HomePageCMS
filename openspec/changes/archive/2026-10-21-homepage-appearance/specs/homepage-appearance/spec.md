# homepage-appearance

## Purpose

讓使用者在編輯器裡調整 Homepage 儀表板本身的外觀。Homepage 沒有佈景檔，
能改的是設定目錄中 `settings.yaml` 的視覺欄位；這份檔案過去只能離開編輯器
手動修改，而且改完沒有即時預覽。這個能力把這些欄位變成表單，存檔後預覽立刻
反映新的外觀。

## ADDED Requirements

### Requirement: 可編輯 Homepage 的外觀設定

系統 SHALL 提供介面讓使用者編輯 Homepage `settings.yaml` 的視覺欄位，包含主題
（淺色／深色／不指定）、配色、背景圖與其濾鏡、卡片模糊、標題樣式、卡片樣式、
區塊樣式、圖示樣式與字型。

系統 SHALL 以 Homepage 內建的配色清單（23 條色階）提供選項並顯示色票；使用者
選到不在清單中的值時，系統 SHALL 原樣保留該值，不得因此無法存檔。

#### Scenario: 讀取現有設定

- **WHEN** 使用者開啟「首頁外觀」分頁
- **THEN** 顯示 `settings.yaml` 目前的外觀設定；檔案不存在時顯示空白表單

#### Scenario: 改變配色並存檔

- **WHEN** 使用者選擇另一個配色並存檔
- **THEN** `settings.yaml` 的 `color` 變成新的配色，預覽重新載入並顯示新外觀

#### Scenario: 未建模的欄位保持原樣

- **WHEN** 使用者存檔首頁外觀
- **THEN** `settings.yaml` 裡編輯器沒有建模的欄位（例如 `allowedHosts`、
  `providers`、`layout`）內容不變

#### Scenario: 設定檔被其他程式改動過

- **WHEN** `settings.yaml` 在載入後被其他程式改動，使用者再存檔
- **THEN** 系統拒絕覆寫並提示先重新載入

### Requirement: 存檔前備份

系統 SHALL 在覆寫 `settings.yaml` 前把原檔複製到備份目錄，並 SHALL 以暫存檔再改名
的方式寫入，避免寫壞檔案或帶著舊屬性。

#### Scenario: 備份產生

- **WHEN** 使用者存檔首頁外觀
- **THEN** 備份目錄出現一份存檔前的 `settings.yaml`
