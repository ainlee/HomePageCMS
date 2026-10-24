# Change: docker-deployment

## Why

編輯器現在只在 RGM-79G 上以裸 node 行程執行，透過 SMB 讀寫 RGM-88X 上
Homepage 容器的設定檔。需求是同一個 stack 放兩個容器（Homepage 原封不動
＋後台容器），後台掛在同一網域下一層 /cms，後台資料放在 Homepage 資料夾
內的 cms/ 子目錄。容器化可免除 SMB 依賴，存檔後重讀 Homepage 走容器網絡
直連；單機版保留，雙模式並存。

## 決策（本會話已拍板，實作前的最終依據）

| # | 事項 | 決定 | 依據 |
| --- | --- | --- | --- |
| 1 | 放哪台機器 | RGM-88X，與 Homepage 同 stack | 88X 的 stack 與設定目錄已查證（/media/ain/DISK1-SSD/projects/homepage）；79G 保留單機版 |
| 2 | 對外網域 | home.928202333.xyz，後台掛 /cms/ | 928202333 側的 stack 與 Cloudflare tunnel 已驗證；915150576 側資訊不足，結構保持通用之後再套用 |
| 3 | 密碼做法 | 沿用設定檔雜湊（介面上啟用保護）；HOMEPAGE_CMS_PASSWORD 保留為啟動路徑，不寫進 compose | 雜湊檔隨 cms/ 掛載持久化，容器重啟不丟；明文不進版控 |
| 4 | /cms 前綴 | 後台程式認前綴（HOMEPAGE_CMS_BASE_PATH），不加反代容器 | 維持兩容器布局；tunnel 的 path 規則保留完整路徑，容器自己剝 |
| 5 | 映像推送 | 先本地 build，不推 registry | 先證明流程；tag 慣例暫定 homepage-cms:<git 短 sha>，registry 另立 change |

## What Changes

- 新增 docker-deployment 能力：Dockerfile、.dockerignore、compose 範例
  （雙容器、cms/ 子目錄掛載、非 root、健康檢查）。
- 新增 base-path 支援：HOMEPAGE_CMS_BASE_PATH 環境變數；設定時伺服器在
  前綴下掛靜態、vendor 與 API，並把前綴注入前端讓所有請求相對前綴；
  未設定時行為與現行完全相同。
- 新增 HOMEPAGE_CMS_REVALIDATE_URL：存檔後重讀 Homepage 的目標，預設沿用
  預覽網址，容器部署指服務名（例如 http://homepage:3000）。
- 雙模式並存規則：容器版與單機版讀寫同一批 YAML，衝突由既有 hash 樂觀鎖
  （後存方 409 重載）處理；兩版編輯器設定檔各自獨立。
- README 增加容器部署節；部署值全走環境變數與 compose，不進程式碼。

## Capabilities

### New Capabilities

- docker-deployment：容器化部署、自訂 base path、重讀目標可指定、雙模式並存。

### Modified Capabilities

- runtime-settings：環境變數清單加入 HOMEPAGE_CMS_BASE_PATH 與
  HOMEPAGE_CMS_REVALIDATE_URL（部署接線類，只由環境變數提供）。

## Impact

- Affected specs: docker-deployment（ADDED）、runtime-settings（MODIFIED）
- Affected code: server.js（路由前綴、__META__ 注入、revalidate 目標）、
  public/app.js 與 public/index.html（請求路徑 baseURL 化、setup 回傳同步）、
  新增 Dockerfile、.dockerignore、compose 範例、README
- 不改 Homepage 映像與程式碼；單機版（未設前綴）行為不變。

## 非目標

- 不處理 915150576 側的主機與 tunnel（資訊不足，套用時補對應資訊）。
- v1 不推 registry、不做第二個子路徑。

