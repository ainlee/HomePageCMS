# HomePageCMS
一個小巧輕便的HomePage後台

Homepage 用 YAML 描述你的服務與書籤，首頁本身很單純，但要編輯這些 YAML 卻得在 NAS 共用資料夾與文字編輯器之間來回。HomePageCMS 提供一個網頁介面：左側編輯、右側即時預覽、儲存前自動備份，改完直接看效果。

![編輯器畫面](docs/screenshot.png)

## 功能

- **雙欄編輯 + 即時預覽** — 預覽面板載入你的 Homepage 實例，改設定立刻看到結果。
- **可拖曳的分割線** — 拖曳調整編輯器與預覽的比例；橫向分割時往側邊收，縱向分割時往下收。
- **可折疊的預覽** — 折疊後分割線會移動、內容空間真的釋放，並保留一條「展開預覽」觸發列。
- **服務與書籤分頁** — 服務分組支援拖曳排序、跨分組移動、欄位寬度 (col-span)。
- **狀態小工具** — 每個服務可設定 Docker 容器、遠端 ICMP ping 或自訂 HTTP API 的狀態追蹤。
- **自動備份** — 每次儲存都會在 `backups/` 留下時間戳快照，可隨時還原。
- **行動版可用** — 版面依可見範圍而非瀏覽器視窗高度計算，手機上底部內容不會掉出畫面。

## 快速開始

需求：Node.js 18 以上。

```bash
npm install
npm start
```

開啟 <http://localhost:3456>。若尚未有設定檔，程式會自動從 `config/*.example.yaml` 建立一份可直接編輯的範例。

Windows 使用者也可以直接執行 `start-editor.bat`。

### 首次啟動

第一次打開編輯器時，會跳出「設定」視窗，把 Homepage 訪問網址、監聽位址、
連接埠、各個檔案位置與存取保護一次填好；留空的欄位使用預設值，欄位下方會以
小字顯示該欄位目前的實際值與來源。存檔後視窗關閉，之後開啟就直接進編輯頁。

設定檔一旦存在就不再重複打擾。編輯器自身的設定檔在 `<專案>/cms-settings.yaml`，
也可以在設定視窗裡改到別的位置（例如容器裡的掛載點）。

### 執行期設定

編輯器不把任何特定部署環境的值寫在程式碼裡，全部由環境變數或設定視窗決定。
未設定時的預設值都相對於專案目錄，因此剛 clone 下來就能直接跑。

| 環境變數 | 預設值 | 說明 |
| --- | --- | --- |
| `PORT` | `3456` | 編輯器的連接埠 |
| `HOST` | `0.0.0.0` | 編輯器綁定的位址；也可在介面上設定 |
| `HOMEPAGE_CONFIG_PATH` | `<專案>/config` | Homepage 設定檔（`services.yaml`、`bookmarks.yaml`）所在目錄 |
| `HOMEPAGE_BACKUP_PATH` | `<專案>/backups` | 備份目錄 |
| `HOMEPAGE_CMS_SETTINGS` | `<專案>/cms-settings.yaml` | 編輯器自身的設定檔 |
| `HOMEPAGE_PREVIEW_URL` | 無 | 預覽目標網址；未設定時需於介面設定 |
| `HOMEPAGE_CMS_PASSWORD` | 無 | 存取密碼；設定後所有寫入 API 都需要它 |

同一組設定也能在介面的齒輪按鈕裡修改，兩者的優先序不同：

- **檔案位置與連接埠**（`HOMEPAGE_CONFIG_PATH`、`HOMEPAGE_BACKUP_PATH`、
  `HOMEPAGE_CMS_SETTINGS`、`PORT`）：環境變數優先。部署通常就是用環境變數掛載
  目錄，介面不應該蓋掉它。
- **Homepage 訪問網址與監聽位址**（`HOMEPAGE_PREVIEW_URL`、`HOST`）：設定檔
  優先。在介面上填代表使用者明確選過了。

每個欄位下方都會顯示目前生效的值與來源，環境變數蓋掉介面設定時看得出來。

例如把設定指到 NAS 共用資料夾、備份指到掛載點、換一個連接埠：

```bash
HOMEPAGE_CONFIG_PATH=/path/to/homepage/config \
HOMEPAGE_BACKUP_PATH=/path/to/backups \
PORT=3899 npm start
```

注意 `HOMEPAGE_` 開頭的變數屬於 Homepage 自己的命名空間（例如
`HOMEPAGE_ALLOWED_HOSTS`），編輯器專用的那幾個是另一組，別搞混。

編輯器自身的設定檔放在**編輯器的目錄**，不放進 Homepage 的設定目錄——那個目錄是
Homepage 的（常是容器掛載點或 NAS 共用資料夾），不是編輯器的。舊版把設定放在
`<設定檔目錄>/.homepage-cms.yaml`，新版本首次啟動會自動搬到新位置。

### 預覽目標

預覽面板載入哪個 Homepage 由執行期設定決定，決定順序是
**編輯器設定檔 → `HOMEPAGE_PREVIEW_URL` → 尚未設定**。

最簡單的做法是點右上角的齒輪按鈕，把 Homepage 網址填進「Homepage 訪問網址」
並儲存；它會寫進 `HOMEPAGE_CMS_SETTINGS` 指定的檔案，重啟後仍在。介面同時會
顯示目前這個值來自設定檔、環境變數還是尚未設定，以及設定檔與備份的實際位置。

Homepage 官方預設的連接埠是 3000，所以欄位留空時提示的就是
`http://localhost:3000`；實際上留空代表「尚未設定」，預覽區會請你填。

預覽網址是**瀏覽器**要能開到的位址。Homepage 若跑在容器內網，請填使用者瀏覽器
打得開的網址，而不是容器內部的主機名稱。

### 監聽位址

編輯器預設綁 `0.0.0.0`，也就是所有介面都可以連進來——家用或區網環境通常正是
你要的。齒輪按鈕裡可以改成 `127.0.0.1` 只留本機，或填指定的介面位址；同一個
視窗也能改編輯器自己的連接埠。兩者改完都要重新啟動才會生效，介面會標示出來。

> 綁 `0.0.0.0` 代表**任何能連到這台機器的人都能開啟編輯器並改寫你的 Homepage
> 設定**。請只在信任的網路使用；要對外開放請設定 `HOMEPAGE_CMS_PASSWORD`
> （見下）。

### 存取保護

編輯器本身沒有帳號系統，只有一道共用密碼。在設定視窗的「存取保護」打開開關
並填入密碼即可啟用，密碼以 salt + scrypt 雜湊儲存，設定檔裡不會留明文；密碼
欄位右邊的眼睛圖示可以切換顯示。啟用後所有 API 都必須帶上這組密碼，密碼不符
會得到 401 且不會寫入任何檔案。瀏覽器會在需要時跳出密碼輸入框，輸入後記在該
裝置上，不必每次重打。

需要密碼時，編輯器會先停在「需要存取密碼」的鎖定畫面，不會先把頁面載成空的；
按掉密碼框也還是鎖定狀態，上面有「輸入密碼」按鈕可以再來一次。

也可以用 `HOMEPAGE_CMS_PASSWORD` 環境變數指定。環境變數優先，設定了它的話
介面的密碼欄位會停用——那是部署層的鎖，不該被介面改掉。

## 設定檔格式

服務設定沿用 Homepage 的 YAML 格式，編輯器讀寫的是同一份檔案，因此也能直接手改。欄位說明見 [Homepage 設定文件](https://gethomepage.dev/configs/services/)。

```yaml
- 開發工具:
    - code-server:
        href: https://code.example.com
        description: VS Code 網頁版
        icon: mdi-microsoft-visual-studio-code
        container: code-server
```

### 存檔不會吃掉沒編輯到的設定

編輯器只會改動你實際編輯過的欄位，其餘原樣保留。`siteMonitor`、`widget`、
`server` 這些畫面上沒有的欄位不會因為按一次儲存就消失；分組層級的額外欄位
（包含 `col-span`）與巢狀分組也會原樣保留。狀態小工具沿用上游寫法
（`widget: { type: customapi, url }`），既有檔案若是用舊的 `customapi:` 寫法，
編輯器會照原樣維持，不會偷偷換成別種寫法。

若設定檔在你編輯期間被其他程式改過，儲存會被拒絕並提示重新載入，避免蓋掉那些
變更。

## HTTP API

| Method | Path | 說明 |
| --- | --- | --- |
| GET | `/api/services` | 讀取 services.yaml |
| PUT | `/api/services` | 寫入 services.yaml（自動備份） |
| GET | `/api/bookmarks` | 讀取 bookmarks.yaml |
| PUT | `/api/bookmarks` | 寫入 bookmarks.yaml（自動備份） |
| GET | `/api/backups` | 列出備份 |
| POST | `/api/restore` | 還原指定備份 |
| GET | `/api/settings` | 讀取全部執行期設定、其來源與各路徑 |
| PUT | `/api/settings` | 寫入執行期設定（自動備份） |

## 測試

版面行為由無頭 Chrome 實測驗證，不是只檢查原始碼。測試需要本機有 Chrome，並且編輯器正在執行。

```bash
npm test              # 全部三組
npm run test:collapse # 折疊與分割線行為
npm run test:mobile   # 行動版版面
npm run test:viewport # 可見範圍量測（含 URL 列情境）
```

Chrome 路徑可用 `CHROME_PATH` 覆寫，編輯器網址可用 `APP_URL` 覆寫（預設 `http://localhost:3456`）。

`npm run shots` 會產生 `shots/` 內的截圖，可用來比對外觀。

### 關於行動版的可見範圍

手機瀏覽器的 `100vh` 與 `100dvh` 指的是「網址列收起時」的高版本畫面，比實際看得見的範圍高。當版面高於可見範圍又設定了 `overflow: hidden`，畫面底端（包含服務列表最後一組與折疊後的預覽觸發列）就永遠捲不到。

因此本專案不信任 `dvh`，而是由 JavaScript 量測 `visualViewport` 與 `innerHeight` 中較小的一個，寫入 `--app-height`，`html` 與 `body` 都依此撐高。`tests/verify-visible-viewport.mjs` 會模擬這個情境來驗證。

## 專案結構

```
public/          前端（index.html、app.js、style.css）
config/          設定檔與範例檔
backups/         執行時產生的備份（已忽略）
tests/           無頭 Chrome 版面測試
server.js        Express API 與靜態檔服務
```

實際的設定檔與備份位置由 `HOMEPAGE_CONFIG_PATH`、`HOMEPAGE_BACKUP_PATH` 決定，
預設就是上面那兩個目錄。編輯器自身的設定檔（訪問網址、監聽位址、連接埠、各路徑、
存取保護）預設位於 `cms-settings.yaml`，同樣不在版控內。

## 開發工具

三個工具的**規格內容**跟進版本庫，**工具本體**則是安裝產物，由全域安裝提供。
各工具更新時都會整份覆寫自己的產物，提交進來只會製造大 diff，也會把開發者
各自的偏好綁進這個倉庫。

| 內容 | 是否進版控 | 理由 |
| --- | --- | --- |
| `openspec/specs/` 規格 | 是 | 專案本身的設計文件，說明各能力目前的行為 |
| `AGENTS.md` / `CLAUDE.md` | 是 | 給人和 AI 讀的專案說明 |
| `.gitnexus/` 知識圖譜 | 否 | 本機索引，每次重跑 `gitnexus analyze` 重建 |
| `.agents/`、`.claude/` 技能檔 | 否 | 工具安裝產物，內容隨工具版本變動 |
| `ui-ux-pro-max/` 設計資料庫 | 否 | 數 MB 的第三方資料 |

全新 clone 後，用以下指令補齊工具：

```bash
npm i -g gitnexus@latest ui-ux-pro-max-cli@latest @fission-ai/openspec@latest
openspec init                 # 規格工作流（openspec/ 已存在時用 openspec update）
uipro init --ai codex         # 設計資料庫
gitnexus analyze --index-only # 知識圖譜
```

`--index-only` 讓 GitNexus 不動 `AGENTS.md`（那份由人維護），也不安裝它的技能檔。

### 語意搜尋

預設只有關鍵字搜尋。再跑一次 `npm run reindex` 會把每個符號向量化，
連到本機的 OpenAI 相容嵌入端點（預設 Ollama 的 `http://localhost:11434/v1`），
於是「用中文描述一個問題」也能找到對應的程式碼：

```bash
npm run reindex -- --model qwen3-embedding:0.6b
npm run reindex -- --model bge-m3
npm run reindex -- --url http://192.168.1.10:11434/v1
```

模型是參數而非寫死的選擇——不同機器裝的模型不同，適合的模型取決於被索引
程式碼的語言。工具會先向端點詢問向量寬度再建立索引，避免寬度不符；換模型時
務必用這個指令，它會帶 `--drop-embeddings` 重算舊向量（索引只記錄寬度、
不記錄模型，同寬度換模型不會被自動偵測）。

#### 機器層級的預設

GitNexus 沒有全域設定檔可以放嵌入設定（`~/.gitnexus/config.json` 只給 wiki
的 LLM 用），唯一的機制是環境變數。把它設在使用者層級，**所有專案共用**：

```bash
# PowerShell
[Environment]::SetEnvironmentVariable('GITNEXUS_EMBEDDING_URL', 'http://localhost:11434/v1', 'User')
[Environment]::SetEnvironmentVariable('GITNEXUS_EMBEDDING_MODEL', 'qwen3-embedding:0.6b', 'User')
[Environment]::SetEnvironmentVariable('GITNEXUS_EMBEDDING_DIMS', '1024', 'User')
```

設定後（需重開終端機讓新行程繼承），任何新專案直接
`gitnexus analyze --embeddings` 就會自動接上端點，不需要逐案設定。

兩點注意事項：`GITNEXUS_EMBEDDING_DIMS` 在載入時讀取，預設 384
（snowflake-arctic-embed-xs）；索引若以不同寬度建立，下次 analyze 會強制重建，
以讓向量欄位寬度與實際模型一致。另外純關鍵字分析不帶 `--embeddings` 時不會
呼叫端點，所以端點離線也不影響一般分析。

### GitNexus — 程式碼知識圖譜

把程式碼解析成知識圖譜，用來回答「這個函式被誰呼叫」「改動會影響什麼」這類問題。

```bash
gitnexus analyze        # 建立或更新索引，並更新 AGENTS.md / CLAUDE.md
gitnexus status        # 查看索引狀態
gitnexus query "預覽折疊"  # 查詢符號與執行流程
```

索引存在 `.gitnexus/`（已忽略，不進版本庫），每次改動程式碼後重跑 `analyze` 即可。`.gitnexusignore` 會把 AI 工具的技能檔案排除在圖譜之外，讓索引只描述本專案的程式碼。

### OpenSpec — 規格驅動開發

以變更提案（change）的方式管理功能開發：先寫規格與任務，再實作，最後歸檔成規格。

```bash
openspec list           # 檢視進行中的變更
openspec validate <id>  # 驗證變更
openspec archive <id>   # 歸檔完成的變更
```

目錄在 `openspec/`，文件以繁體中文撰寫（見 `openspec/config.yaml`）。Codex 與 Claude Code 的技能檔已安裝於 `.agents/skills/openspec-*` 與 `.claude/skills/openspec-*`。

### UI/UX Pro Max — 介面設計資料庫

內建 79 種樣式、192 組配色、74 組字體配對、119 條 UX 準則與 22 種技術堆疊的查詢資料庫。

以 `uipro init --ai codex` 安裝到 `.agents/skills/`。其中 `ui-ux-pro-max/` 是那份查詢資料庫（不進版控，數 MB 且會被更新覆寫），`banner-design`、`design`、`design-system`、`ui-styling` 等外殼則隨專案一起版控。向 AI 助理提出介面相關問題時，它會查閱這份資料庫再回答。

## License

MIT。詳見 [LICENSE](LICENSE)。

## 第三方元件

本專案自身的程式碼採 MIT 授權，並使用下列第三方元件：

| 元件 | 授權 | 取得方式 |
| --- | --- | --- |
| [Express](https://expressjs.com/) | MIT | npm 依賴 |
| [js-yaml](https://github.com/nodeca/js-yaml) | MIT | npm 依賴 |
| [Vue 3](https://vuejs.org/) | MIT | npm 依賴，由伺服器提供 |
| [Material Design Icons](https://pictogrammers.com/library/mdi/) | Apache-2.0 | npm 依賴，由伺服器提供 |

前端資產全部來自 npm 依賴並由伺服器提供，頁面不會向外部網域載入任何東西，
沒有外網的環境也能正常使用。倉庫內未內嵌任何第三方資產。
