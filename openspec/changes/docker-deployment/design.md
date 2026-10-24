# Design: docker-deployment

## 1. 容器布局（RGM-88X）

- Stack：/media/ain/DISK1-SSD/projects/homepage/docker-compose.yml
  新增 homepage-cms 服務；homepage 服務不改映像、不改 compose 既有欄位，
  只加一個 service 條目。
- 掛載（host -> 容器）：
  - /media/ain/DISK1-SSD/projects/homepage -> /app/config（rw）
    Homepage 既有掛載點原封不動；後台以此為 HOMEPAGE_CONFIG_PATH。
  - /media/ain/DISK1-SSD/projects/homepage/cms -> /app/cms（rw）
    後台以此放編輯器設定檔與備份：
    HOMEPAGE_CMS_SETTINGS=/app/cms/cms-settings.yaml、
    HOMEPAGE_BACKUP_PATH=/app/cms/backups。
- 網絡：同 compose 的 default network；存檔後重讀 Homepage 走
  HOMEPAGE_CMS_REVALIDATE_URL=http://homepage:3000（服務名直連，
  不出隧道）。
- 對外：host 埠只對內網開放（127.0.0.1 或 LAN 埠），對外一律走 Cloudflare
  tunnel 的 path 規則；/cms/* 送 homepage-cms，根 path 維持 Homepage。
- 埠錯開：單機版現用 3899；容器版 host 側暫定 3457 對容器內 3456
  （實作時以 88X 現有埠佔用為準）。

## 2. Base path（HOMEPAGE_CMS_BASE_PATH）

- 預設空字串：完全維持現行行為，所有路由掛在根。
- 非空（例如 /cms）時：
  - server.js 以 express Router 掛前綴：index、static、/vendor、/api；
    另加一條無前綴的 404 防呆（或 302 到前綴根，取實作者判斷）。
  - window.__META__ 多注入 basePath；前端 apiFetch 與 index.html 的
    /vendor 資產改用 `${basePath} + ...`。模板新增綁定時同步改
    app.js setup 回傳物件（專案慣例）。
  - 前綴尾端斜線正規化：/cms 與 /cms/ 同視，路由與 301 統一。
- Cloudflare tunnel 的 path 規則保留完整路徑（/cms/... 原樣送達），
  由容器自己認前綴，不加第三個反代容器（決策 #4）。

## 3. 重讀目標（HOMEPAGE_CMS_REVALIDATE_URL）

- 決定順序：HOMEPAGE_CMS_REVALIDATE_URL > 預覽網址。
- 容器部署填服務名直連；單機版與未設定時沿用預覽網址（現行行為）。
- 重讀失敗（例如頁面開启存取驗證）沿用現行提示：按儀表板頁腳重新整理。

## 4. 密碼

- 沿用 access-control 規格：介面上啟用保護，雜湊（salt + scrypt）寫進
  編輯器設定檔。容器版設定檔在 cms/ 掛載點，重啟容器不丟。
- HOMEPAGE_CMS_PASSWORD 環境變數路徑保留（啟動時直接設定的情境），
  但不寫進 compose（避免明文進磁碟或版控）。

## 5. 雙模式並存

- 無資料庫、狀態就是 YAML，切換無搬遷成本。
- 同一份設定檔的雙寫由 hash 樂觀鎖保護：後存方 409，重載再存。
- 兩版各自持有編輯器設定檔（單機：專案根 cms-settings.yaml；
  容器：cms/cms-settings.yaml）；預覽網址、監聽位址、語系主題各記各的。
- 備份目錄可共用（檔名帶時間戳），也可各掛各的；並存期間建議各掛
  各的，還原時不會混淆來源。

## 6. 映像

- 本地 build（決策 #5）：docker build -t homepage-cms:<git 短 sha> .
  compose 端 build: context 指向倉庫 checkout。
- 非 root：node:alpine 的 node 使用者（uid 1000）正好對應 host 檔案
  屬主 1000:1000，實測確認（tasks 4.2）。
  若 88X 的 umask/屬主不同，映像端以 user 指令對齊。

## 7. 風險與未決

- Homepage 對設定目錄未知子目錄 cms/ 的行為未實測（tasks 4.1）；
  若它列進儀表板或掃描，需調整 cms/ 名稱或位置。
- 915150576 側的 tunnel 結構未驗證，本 change 只定義通用接線，
  另一側套用時補對應資訊。
- registry 推送、多子路徑留待後續 change。
