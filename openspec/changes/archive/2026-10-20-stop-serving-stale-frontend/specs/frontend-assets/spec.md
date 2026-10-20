# frontend-assets

## MODIFIED Requirements

### Requirement: 前端資產由本機提供

系統 SHALL 從已安裝的 npm 套件提供前端所需的 JavaScript 與字型，頁面 MUST NOT
向外部網域載入任何資產。編輯器自己的模板、腳本與樣式 SHALL 以不快取的方式提供，
使瀏覽器不會同時使用新舊兩版的檔案。

#### Scenario: 沒有外網也能載入編輯器

- **WHEN** 執行環境無法連到外部網域
- **THEN** 編輯器仍然完整載入：Vue 掛載成功、圖示字型可用、YAML 寫入可用

#### Scenario: 頁面沒有外部請求

- **WHEN** 載入編輯器頁面
- **THEN** 瀏覽器只向編輯器自己的位址請求資源

#### Scenario: 檔案更新後不會用到舊版本

- **WHEN** 範本或腳本被更新，之後重新載入頁面
- **THEN** 瀏覽器取得的是新版本，不會用快取的舊檔案與新檔案混搭

## ADDED Requirements

### Requirement: 渲染錯誤不留下白屏

系統 SHALL 在前端發生渲染錯誤時顯示錯誤訊息與重新載入的入口，MUST NOT 讓頁面
變成空白。使用者 SHALL 能從畫面上看出錯誤原因或下一步該做什麼。

#### Scenario: 範本與腳本版本不一致

- **WHEN** 頁面載入到版本不一致的範本與腳本，渲染因而失敗
- **THEN** 畫面顯示錯誤訊息與提示（多半是快取問題，建議強制重新整理），並提供
  重新載入按鈕

#### Scenario: 一般載入錯誤

- **WHEN** 前端發生未捕捉的錯誤或 Promise 拒絕
- **THEN** 同樣顯示錯誤面板，而不是空白頁面

