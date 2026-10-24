# 三種部署方法比較：本地版／同一份 compose／獨立 compose

> 編輯器程式碼在三種方法下**完全相同、不用改任何東西**——差異全部由環境變數與
> compose 的擺法決定。這份文件比的是「部署與設定方法」，不是程式功能。

## 比較表

| | ① 本地版 | ② 同一份 compose（跟 Homepage 同 stack） | ③ 獨立 compose（獨立 stack） |
| --- | --- | --- | --- |
| 跑在哪 | 你自己的電腦（`npm start` 或雙擊 `start-editor.bat`） | 容器，寫在 Homepage 那支 compose 檔裡 | 容器，自己一支 compose 檔、自己一個資料夾 |
| 要裝 Docker | 不需要 | 要 | 要 |
| 讀寫 Homepage 設定檔 | 走網路（NAS 共用資料夾） | 跟容器同一個資料夾，最快最穩 | 跟容器同一個資料夾，最快最穩 |
| 找到 Homepage 做 revalidate 的方式 | 預覽網址（本機或公開網址直連） | 容器內服務名 `http://homepage:3000`（靠同張 docker 網路） | 公開網址 `https://home.928202333.xyz`（兩 stack 網路不同，服務名解不到） |
| 對 Homepage 的依賴 | 只有設定檔 + 一次 HTTP 呼叫 | 多一項：共用 docker 網路 | 只有設定檔 + 一次 HTTP 呼叫 |
| 版控 | 專案自己一個倉庫 | 跟 Homepage **共用一份檔**：他升級、你升級都碰同一支 compose，Dockge 整顆標 drift | **各一份檔**：各自升級只碰各的，Dockge 各一個卡片 |
| 升級 Homepage | 不影響你 | 只重啟他的容器（若 `up -d` 順帶重做你的容器，你只停幾秒） | 完全碰不到你 |
| 升級我們 | 不影響他 | 改的是共用的那份檔，他的服務也在風險面內 | 只重啟 `homepage-cms`，他的檔案與容器完全不動 |
| 對外網址 | 看你自己的 tunnel | `你的網域/cms/` | `你的網域/cms/`（tunnel 規則與 ② 相同） |
| 編輯器設定檔位置 | 專案根的 `cms-settings.yaml` | Homepage 設定目錄下 `cms/cms-settings.yaml` | 同 ② |
| 適合誰 | 沒有 Docker、或想在自己電腦上弄 | 最省事，兩容器一起管 | 要求兩邊版控互不干擾（現階段採用的方向） |

## 為什麼編輯器不用改

三個方法用到的路徑、埠、重讀目標，全是環境變數在控制，程式碼裡沒有寫死任何一台機器的值：

- `HOMEPAGE_CONFIG_PATH`、`HOMEPAGE_CMS_SETTINGS`、`HOMEPAGE_BACKUP_PATH`：掛哪、設定檔放哪
- `HOMEPAGE_CMS_BASE_PATH`：掛在根還是 `/cms`（②③ 用 `/cms`；① 通常留空掛根）
- `HOMEPAGE_CMS_REVALIDATE_URL`：存檔後去哪找 Homepage 重讀設定。決定順序是「這個變數 > 預覽網址」，所以 ① 留空走預覽網址、② 填服務名、③ 填公開網址，同一支程式碼三種跑法

所以 ② ↔ ③ 之間切換，實際動作只有兩步：把 `homepage-cms` 那段從 Homepage 的 compose 搬到獨立檔、把 revalidate 變數從服務名改成公開網址。**映像不用重建、編輯器不用改、tunnel 規則不用動。**

## 三個方法都能並存

①②③ 讀寫的是同一批 YAML。原則照舊：**看，幾邊都可以；存檔，一次只用一邊。**
兩邊同時存同一份檔時，後存的一方會收到衝突提示，重新整理再存就好（hash 樂觀鎖保護）。
