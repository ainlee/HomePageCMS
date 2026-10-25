# HomePageCMS

Homepage 的 YAML 設定後台。左側編輯、右側即時預覽，存檔前自動備份。

## 執行

```bash
npm install
npm start          # http://localhost:3456
```

執行期設定由環境變數或編輯器設定檔（`cms-settings.yaml`）決定，預設值都相對於
專案目錄：

```
PORT                    編輯器連接埠（預設 3456）
HOST                    綁定位址（預設 127.0.0.1，也可寫在 cms-settings.yaml 的 bindAddress）
HOMEPAGE_CONFIG_PATH    Homepage 設定檔目錄（預設 config/）
HOMEPAGE_BACKUP_PATH    備份目錄（預設 backups/）
HOMEPAGE_CMS_SETTINGS   編輯器自身設定檔（預設 <專案>/cms-settings.yaml）
HOMEPAGE_PREVIEW_URL    預覽目標（未設定時於介面設定）
HOMEPAGE_CMS_PASSWORD   存取密碼（設定後所有 API 都需要它；不放進設定檔）
HOMEPAGE_CMS_LOCALES_PATH 語系檔目錄（預設 <專案>/locales/）
HOMEPAGE_CMS_THEMES_PATH  配色方案目錄（預設 <專案>/themes/）
HOMEPAGE_CMS_LOCALE       介面語言（預設 zh-TW；設定檔有指定時以設定檔為準）
HOMEPAGE_CMS_UPDATE_PROXY 升級 API 轉發端點（docker 佈署指向 updater sidecar）
```

升級檢查：頂欄的升級按鈕預設鎖定；每次開啟頁面時檢查 GitHub 倉庫的「快照」（commit）
有沒有異動。本機執行（有 git checkout）直接比對遠端 origin/HEAD，有新版時按鈕亮起、
帶呼吸燈，按下後 git pull --ff-only 加 npm install，新行程接棒、瀏覽器重新整理。

Docker 佈署吃不到 git checkout，改走 updater sidecar（server/updater.cjs，零相依）：
它持有持久的 git clone，把新版發布成快照（releases/r-<id> 加 current 符號連結，
原子切換），再經 docker socket 重啟主容器；主程式以環境變數 HOMEPAGE_CMS_UPDATE_PROXY 
把兩個升級端點轉發過去。無 git、離線或快照相同時一律維持鎖定，不亮假燈。

同一組設定也能在介面的齒輪按鈕裡改，寫進 `cms-settings.yaml`。兩種來源的優先序
不同：**檔案位置與連接埠**是環境變數優先（部署用環境變數掛載目錄，介面不該蓋掉
它）；**訪問網址與監聽位址**是設定檔優先（介面填代表使用者明確選過）。每個欄位
下方顯示目前生效的值與來源。

第一次開啟（編輯器設定檔不存在）會自動跳出「設定」視窗；存檔後視窗關閉，之後
開啟直接進編輯頁。視窗的動作列固定在底部，手機上不用捲動就能按到儲存。

首次啟動且設定檔不存在時，會由 `config/*.example.yaml` 建立初始設定。範例檔是
唯一該進版控的設定內容，實際設定檔不進版控。齒輪按鈕裡可以修改全部執行期設定，
寫入編輯器設定檔。

編輯器自己的設定檔放在**編輯器目錄**，不要放進 Homepage 的設定目錄——那個目錄是
Homepage 的（常是容器掛載點或 NAS 共用資料夾）。舊版的
`<設定檔目錄>/.homepage-cms.yaml` 在首次啟動時會自動搬遷到新位置。

## 測試

```bash
npm test
```

六組測試：INI 解析器（純 Node），以及五組無頭 Chrome 測試——折疊與分割線行為、
行動版版面、可見範圍量測、語系切換、配色方案。需要本機有 Chrome，且編輯器正在
執行（預設 `http://localhost:3456`，可用 `APP_URL` 覆寫，Chrome 路徑可用
`CHROME_PATH` 覆寫）。

測試驗證的是**版面行為**，不是實作細節。改動版面時，測試失敗多半代表行為
真的變了，請先確認是不是預期中的改動。

## 慣例

- **設定格式就是 Homepage 的 YAML 格式。** 不要發明私有格式，編輯器與
  Homepage 直接共用同一份檔案。
- **存檔要保留沒建模的欄位。** 不要用畫面模型重新產生整份 YAML——那會把使用者
  檔案裡編輯器沒有建模的欄位（`siteMonitor`、`widget`、`server` 等）全部清掉。
  一律以原始物件為底，只覆蓋實際編輯過的欄位；寫回前用 hash 檢查檔案有沒有被
  其他程式改過。
- **面板尺寸由 Vue 的 computed 決定**，不要在拖曳時直接寫內嵌 `width`/`height`。
  內嵌樣式的優先級會蓋掉 `.collapsed` 類別，導致折疊時分割線不動。
- **高度來自實測的可見範圍**，不要用 `100vh` 或 `dvh` 當最終答案。手機瀏覽器
  這兩個值指的是網址列收起時的高版本畫面，會讓畫面底部永遠捲不到。
- **頂端工具列放不下時先縮標題。** 按鈕是主要操作，不能被擠出畫面；標題用省略號
  截短（`.topbar-title`），按鈕維持同高同寬——包在容器裡的按鈕要用 flex 容器，
  否則它不會跟旁邊的按鈕一起被拉高，看起來就是大小不一致。
- **窄螢幕上多按鈕的欄位用格線排。** 按鈕橫向溢出會掉到別的欄位下面，看起來像壞掉
  的一塊；寧可兩欄換行，也不要讓它溢出。
- **版本號不要寫死在前端。** 伺服器從 `package.json` 讀版本與倉庫網址，連同語系與
  主題一起注入頁面（`window.__META__`）；改了版本只要改 `package.json`，介面就跟著
  變。倉庫網址也放 `package.json` 的 `repository` 欄位，不要寫在樣式或範本裡。
- **後端 API 很薄。** 設定檔就是磁碟上的 YAML，沒有一層資料庫要同步。
- **備份是自動的。** 寫入前一定先複製一份到備份目錄（預設 `backups/`），
  不要手動改流程繞開它。
- **不要把特定部署的值寫進程式碼。** 網域、路徑、埠號一律走環境變數或設定檔，
  預設值相對於專案目錄。預覽網址的決定順序是設定檔 > 環境變數 > 尚未設定，
  不要加內建預設值——猜錯只會在預覽區顯示無關的錯誤頁。
- **前端資產不要連 CDN。** Vue、MDI 圖示、js-yaml 都是 npm 相依，由伺服器從
  `node_modules` 提供；內網環境沒有外網也要能開得起來。
- **前端檔案不快取。** `public/` 由 `no-store` 提供，因為範本與腳本必須版本一致；
  瀏覽器留著舊範本又拿到新腳本，Vue 會在渲染時拋錯，整頁變白屏。改動模板時
  若新增了綁定，腳本的 `setup` 回傳物件也要跟著加，兩邊要一起改。
- **渲染錯誤要讓使用者看得見。** Vue 自己攔截渲染錯誤，`window.onerror` 收不到，
  所以要註冊 `app.config.errorHandler`，讓 `index.html` 的錯誤面板能顯示出來。
- **寫檔用 `writeFileSafe`，不要用 `copyFileSync`。** Windows 上帶有「隱藏」屬性的
  檔案無法以寫入模式開啟（EPERM），而複製檔案會連屬性一起複製——備份與搬遷都
  會變成下一次寫入的地雷。`writeFileSafe` 先寫暫存檔再 rename 覆蓋，屬性不傳染、
  寫入也變成原子的。

## 語系與配色

介面文字與配色都不寫死在程式裡，而是放在 INI 檔：語系檔在 `locales/`，
配色檔在 `themes/`，使用者放一個檔案進去就會出現在介面上，不必改程式碼。
兩個目錄的位置都能用環境變數指定（`HOMEPAGE_CMS_LOCALES_PATH`、
`HOMEPAGE_CMS_THEMES_PATH`）。

- **介面文字一律走 `t('key')`。** 範本與腳本裡不要出現寫死的中文。新增字串要
  同時加進四個內建語系檔（`locales/*.ini`），key 名稱要能看出所屬區域，
  例如 `topbar.save`。缺翻譯會退回繁體中文，再缺才顯示 key 並在 console 警告。
- **伺服器的錯誤訊息也要翻譯。** 訊息原文寫在 `lib/i18n.js` 的 `ERROR_KEYS`／
  `ERROR_PATTERNS` 對應到語系檔的 key；回應結構不變，`error` 仍是字串。
- **顏色一律用 CSS 變數。** `public/style.css` 的 `:root` 只留預設值，實際配色
  由配色檔的 `[colors]` 決定，key 對應變數名（`bg` → `--bg`）。新增 token 要
  同時加到 `lib/themes.js` 的 `COLOR_TOKENS` 與每個內建配色檔，否則自訂編輯器
  看不到那個 token。
- **內建配色要看得清楚。** 正文與次要文字對背景、卡片背景的對比至少 4.5:1，
  `tests/verify-themes.mjs` 會檢查。
- **語系檔與配色檔都用同一個 INI 語法**（`lib/ini.js`）：section、`key = value`、
  `#` 開頭的註解。沒有行內註解，因為顏色值本身以 `#` 開頭。

## 規格

`openspec/specs/` 記錄這個專案目前的行為，逐能力分檔，每份含需求與情境。
改動前先看對應規格；要新增或變更行為，寫一份 OpenSpec change proposal
而不是直接改程式碼。

規格以繁體中文撰寫，但 `Requirement`、`Scenario`、`SHALL` 等結構性關鍵字
維持英文（見 `openspec/config.yaml`）。

## 開發工具

本專案用 GitNexus（程式碼知識圖譜）、OpenSpec（規格驅動）、UI/UX Pro Max
（介面設計資料庫）。三者皆為全域安裝，**產物不進版控**：

```bash
npm i -g gitnexus@latest ui-ux-pro-max-cli@latest @fission-ai/openspec@latest
uipro init --ai codex
gitnexus analyze --index-only        # 關鍵字搜尋
npm run reindex                       # 加上語意搜尋（需要本機的嵌入模型）
```

用 `--index-only` 是為了讓 GitNexus 不動 `AGENTS.md`（那由人維護），
也不安裝它的技能檔。

### 語意搜尋

`npm run reindex` 會連到本機的 OpenAI 相容嵌入端點（預設 Ollama 的
`http://localhost:11434/v1`），把每個符號向量化，讓「用中文描述一個問題」
也能找到對應的程式碼。模型是參數而非寫死的選擇，因為不同機器裝的模型不同，
而適合的模型取決於被索引程式碼的語言：

```bash
npm run reindex -- --model qwen3-embedding:0.6b
npm run reindex -- --model bge-m3
npm run reindex -- --url http://192.168.1.10:11434/v1
```

工具會先向端點詢問向量寬度再建立索引，避免寬度不符。換模型時務必用這個指令
（它會帶 `--drop-embeddings`）：索引只記錄向量寬度、不記錄是哪個模型產生的，
同寬度換模型不會被偵測到，舊模型的向量會留在索引裡。

### 機器層級的預設

這台機器的嵌入設定放在使用者層級的環境變數，所以**新專案不需要再設定一次**：

```
GITNEXUS_EMBEDDING_URL=http://localhost:11434/v1
GITNEXUS_EMBEDDING_MODEL=qwen3-embedding:0.6b
GITNEXUS_EMBEDDING_DIMS=1024
```

GitNexus 沒有全域設定檔可以放這些（`~/.gitnexus/config.json` 只給 wiki 的
LLM 用），唯一的機制就是環境變數。設定好之後，在任何新專案直接
`gitnexus analyze --embeddings` 就會自動接上端點。

要注意 `GITNEXUS_EMBEDDING_DIMS` 是在載入時讀取的，預設 384
（snowflake-arctic-embed-xs）。索引若以不同寬度建立，下次 analyze 會**強制
重建**——這是為了讓向量欄位寬度與實際模型一致。

純關鍵字分析（不帶 `--embeddings`）不會呼叫端點，所以端點離線時仍然正常運作。

