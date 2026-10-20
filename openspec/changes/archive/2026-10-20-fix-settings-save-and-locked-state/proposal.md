# Change: fix-settings-save-and-locked-state

## Why

兩個使用者實際遇到的問題：

1. **設定存不下來。** 編輯器的設定檔帶著 Windows 的「隱藏」屬性（從舊的
   `.homepage-cms.yaml` 搬過來時，`copyFileSync` 會連屬性一起複製），而 Node 的
   `writeFileSync` 對帶隱藏屬性的檔案開啟寫入會直接 EPERM。於是儲存設定整個
   失敗（HTTP 500），備份也跟著變成隱藏檔，之後還原也會失敗。
2. **密碼提示是死路。** 編輯器一開始就對所有 API 發請求，需要密碼時全部
   401，畫面只剩一個空白的服務列表，密碼提示晚一步才跳出來。提示的覆蓋層擋住
   整個介面，設定視窗永遠開不了；按取消又會回到剛才那個半壞的狀態。

## What Changes

- 寫檔一律改成「先寫暫存檔再 rename 覆蓋」，不依賴目標檔案現有的屬性，
  順帶讓寫入是原子的。備份與搬遷改用讀取後寫入，屬性不會被複製過去。
- 前端先問 `GET /api/auth`，確認需要密碼且手上沒有密碼時，就停在「需要存取密碼」
  的狀態，不再發注定失敗的請求。
- 密碼提示取消後，畫面維持在明確的鎖定狀態（附「輸入密碼」按鈕），而不是壞掉的
  半載入頁面。
- 密碼錯誤或失效時，清掉瀏覽器記住的密碼並重新提示。

## Impact

- Affected specs: `file-storage`（新增能力）、`access-control`（MODIFIED）
- Affected code: `server.js`、`public/app.js`、`public/index.html`、`public/style.css`

