# Change: first-run-setup

## Why

現在的編輯器在第一次開啟時，使用者只會看到一個空的預覽窗和一堆範例設定；所有
部署相關的設定（預覽網址、監聽位址、檔案位置、存取保護）都得先讀 README、
再設定環境變數才知道怎麼改。設定對話框也只有預覽網址與監聽位址兩個欄位，
而且路徑只能靠環境變數。

對開源後的使用者來說，第一次打開應該是「填完表就能用」。

## What Changes

- 首次訪問時檢查編輯器設定檔：不存在就開啟設定視窗（標題「設定」），存在就直接
  進入編輯頁。
- 設定視窗改名為「設定」，並且每個欄位在留空時以提示文字顯示該設定的預設值。
- 設定視窗補齊所有執行期設定：Homepage 訪問網址、監聽位址、Homepage 設定檔
  位置、備份位置、編輯器設定檔位置、存取保護。
- 存取保護可在介面上用開關啟用並設定密碼，密碼以雜湊（salt + scrypt）儲存，
  密碼欄位有眼睛圖示切換顯示。
- 路徑類設定（Homepage 設定檔、備份、編輯器設定檔）改由設定檔決定，
  環境變數仍可指定，且環境變數優先。
- 編輯器設定檔的位置若與預設不同，設定檔內會記錄新位置，重新啟動後仍能找到。

## Impact

- Affected specs: `first-run-setup`（新增能力）、`runtime-settings`（MODIFIED）、
  `access-control`（MODIFIED）
- Affected code: `server.js`、`public/app.js`、`public/index.html`、`public/style.css`、
  `README.md`、`AGENTS.md`
- 既有安裝的設定檔格式相容：新增欄位都是選用的，舊檔案讀得起來。

