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

- [ ] 4.1 驗證 Homepage 忽略設定目錄下未知子目錄 cms/（dashboard 列舉、
  寫入、revalidate 全流程）
- [ ] 4.2 權限：非 root 映像對 host 1000:1000 檔案寫入成功、新檔屬主正確
- [ ] 4.3 Cloudflare path 規則：/cms/* 保留完整路徑送容器；根 path 維持
  指 Homepage
- [ ] 4.4 /cms 下 /api/auth 回 200、上線改一筆服務並存檔、備份落
  cms/backups、重啟容器後設定仍在、/cms 需密碼
- [ ] 4.5 雙模式並存：單機版與容器版同時開、同檔雙寫 409 重載驗證

## 5. 規格與封存

- [x] 5.1 openspec validate docker-deployment 通過
- [ ] 5.2 實作與 4.x 驗證全過後，主規格同步並 openspec archive

