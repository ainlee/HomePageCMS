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

### 設定檔位置

預設讀寫專案目錄下的 `config/`。若要指向別處（例如 NAS 共用資料夾），設定環境變數：

```bash
HOMEPAGE_CONFIG_PATH=/path/to/homepage/config PORT=3899 npm start
```

### 預覽目標

預覽面板載入的網址寫在 `public/app.js` 的 `previewUrl`，預設為 `https://home.928202333.xyz`，請改成你的 Homepage 實例位置。

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

## HTTP API

| Method | Path | 說明 |
| --- | --- | --- |
| GET | `/api/services` | 讀取 services.yaml |
| PUT | `/api/services` | 寫入 services.yaml（自動備份） |
| GET | `/api/bookmarks` | 讀取 bookmarks.yaml |
| PUT | `/api/bookmarks` | 寫入 bookmarks.yaml（自動備份） |
| GET | `/api/backups` | 列出備份 |
| POST | `/api/restore` | 還原指定備份 |

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

尚未指定授權。若要公開散布，建議補上一份授權條款。
