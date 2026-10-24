# Tasks

## 1. Base path 改造

- [x] 1.1 伺服器讀取 HOMEPAGE_CMS_BASE_PATH（預設空）；非空時 index、靜態、
  /vendor、/api 路由掛前綴下，無前綴的請求不被誤路由
- [x] 1.2 window.__META__ 注入 basePath；前端 apiFetch 與 index.html 資產
  路徑改走 base；模板新增綁定同步 app.js 的 setup 回傳物件
- [x] 1.3 未設定前綴時 npm test 全過（無回歸）

## 2. 重讀目標

- [x] 2.1 讀取 HOMEPAGE_CMS_REVALIDATE_URL；存檔後重讀目標依
  「revalidate URL > 預覽網址」
- [x] 2.2 未設定時沿用預覽網址（現行行為）

## 3. 容器化

- [x] 3.1 Dockerfile：node:22-alpine、npm ci --omit=dev、最小 COPY
  （server.js、lib/、public/、locales/、themes/、config/*.example.yaml、
  package*.json）、非 root 執行、HEALTHCHECK
- [x] 3.2 .dockerignore：node_modules、backups/、cms-settings.yaml、
  config/*.yaml（保留 example）、shots/、.gitnexus/、*.log
- [x] 3.3 compose 範例：雙容器（homepage 不動 + homepage-cms）、設定目錄
  單掛、cms/ 為其子目錄、HOST=0.0.0.0、BASE_PATH=/cms、REVALIDATE 走
  服務名直連、host 埠錯開單機版
- [x] 3.4 README 增加容器部署節（部署值走環境變數與 compose；雙模式規則）

## 4. 88X 實測

- [x] 4.1 驗證 Homepage 忽略設定目錄下未知子目錄 cms/（dashboard 列舉、
  寫入、revalidate 全流程）
- [x] 4.2 權限：非 root 映像對 host 1000:1000 檔案寫入成功、新檔屬主正確
- [ ] 4.3（部署端待辦）Cloudflare path 規則：/cms/* 保留完整路徑送容器；根 path 維持
  指 Homepage
- [x] 4.4 /cms 下 /api/auth 回 200、上線改一筆服務並存檔、備份落
  cms/backups、重啟容器後設定仍在、/cms 需密碼
- [x] 4.5 雙模式並存：單機版與容器版同時開、同檔雙寫 409 重載驗證

## 5. 規格與封存

- [x] 5.1 openspec validate docker-deployment 通過
- [ ] 5.2 實作與 4.x 驗證全過後，主規格同步並 openspec archive


## 驗證記錄（本會話實測，2026-10-24）

88X 上以本機 build 的映像實測（不推 registry）：
- 4.1 正在執行的 Homepage 容器的設定目錄出現 `cms/` 子目錄後，dashboard 與
  `/api/config/*` 行為不變、log 無未知子目錄錯誤；`/api/revalidate`（GET）回 200。
- 4.2 映像以 `node`（uid 1000）執行；對 host 的 `cms/` 寫入成功，新檔
  屬主 `ain:ain`（1000:1000），與 Homepage 容器期望一致。
- 4.4 `/cms/api/auth` 回 200；改一筆服務存檔 200、marker 寫入（上述於 scratch
  複本目錄進行，真實 `services.yaml` 未動，mtime 不變）；備份落 `cms/backups`；
  重啟容器後設定檔仍在；啟用保護後未帶密碼 401、帶密碼 200。
- 4.5 同檔雙寫：後存者拿 409，hash 樂觀鎖照設計保護（scratch 複本上驗證）。
- 4.4 上線前最後一哩：真實 `services.yaml` 的「改一筆並存檔」尚未在活的
  Homepage 上實做（會改變儀表板內容），留給上線當下做一次；其機制（存檔、備份、
  衝突、權限）已在同一路徑的 scratch 上全數驗證。
- 4.3 未在此會話下達：88X 的 cloudflared 是 remote token tunnel（規則在
  Cloudflare dashboard、主機無 config 檔），`/cms/*` path 規則需於 dashboard
  端設定，非本機可做。

### 部署端殘留（未在本會話完成，下版處理）
- revalidate 走服務名 `http://homepage:3000` 時，Homepage 的
  `HOMEPAGE_ALLOWED_HOSTS` 未含 `homepage`，回 400。上線時需把服務名加進
  該環境變數並 recreate Homepage 容器（或改走公開預覽網址避開此問）。
- Cloudflare dashboard 端加 `/cms/*` path 規則指到容器埠，根 path 維持 Homepage。
