# HomePageCMS

Homepage 的 YAML 設定後台：左側編輯、右側即時預覽，存檔前自動備份。

![編輯器畫面](docs/screenshot.png)

## 功能

- **雙欄編輯 + 即時預覽** — 右側直接載入你的 Homepage，改完立刻看到效果。
- **可拖曳的分割線、可折疊的預覽** — 拖曳調整比例；折疊後分割線會移動，空間真的
  還給編輯區。
- **服務與書籤分頁** — 分組、拖曳排序、跨分組移動、col-span；狀態小工具支援
  Docker 容器、ICMP Ping 與 HTTP API，同一服務可掛多個小工具，也可指定 Docker
  主機、排序權重與 Kubernetes 目標。
- **書籤欄位完整** — 對話框同時管理名稱、連結、縮寫、說明與圖示；說明留空時
  Homepage 顯示連結主機名稱。
- **首頁外觀分頁** — 儀表板的視覺欄位（主題、配色、背景圖與濾鏡、卡片、區塊、
  圖示樣式與字型）變成表單，存檔後預覽立刻更新；內建 23 條色階並顯示色票，
  每條配色可從種子色各自客製化，寫進 `custom.css` 的獨立區塊互不影響。
- **後端過舊偵測** — 更新編輯器後忘了重新啟動時，介面會提示後端比頁面舊，
  不再出現看不懂的解析錯誤。
- **自動備份與還原** — 每次存檔留一份時間戳快照，介面裡就能還原。
- **存檔不傷原檔** — 只覆寫你改過的欄位，編輯器不認得的欄位原樣保留。
- **多語系** — 內建繁中、簡中、日文、英文；也可以自己加語言檔。
- **配色方案** — 內建七套深淺色配色，可自訂、儲存、匯出匯入。
- **可選的存取保護** — 一道共用密碼鎖住編輯器，密碼以 salt + scrypt 雜湊儲存。
- **行動版可用** — 版面依實測可見範圍計算，手機上底部內容不會掉出畫面。

## 開始使用

需求：Node.js 18 以上。

```bash
npm install
npm start
```

開啟 <http://localhost:3456>。第一次開啟會跳出設定視窗，把 Homepage 網址填進去
就好；留空的欄位使用預設值。

Windows 也可以直接執行 `start-editor.bat`：它以 `0.0.0.0:3899` 啟動（方便區網內的
裝置連進來），等伺服器準備好後自動開啟瀏覽器。

## 使用

| 想做的事 | 怎麼做 |
| --- | --- |
| 改服務或書籤 | 左側改，右側預覽同步更新，按「儲存」才寫檔 |
| 還原舊設定 | 頂端工具列的「備份」→ 挑一個快照還原 |
| 換語言 | 頂端工具列的語言圖示，點選即換 |
| 換配色 | 頂端工具列的調色盤圖示，或設定視窗的「外觀」 |
| 改儀表板外觀 | 「首頁外觀」分頁設定主題、配色、背景、字型等，按「儲存」即寫入並重新預覽 |
| 顯示／隱藏預覽 | 頂端工具列的眼睛圖示 |
| 改路徑、位址、密碼 | 頂端工具列的齒輪 |

## 設定

執行期設定由環境變數或編輯器設定檔（`cms-settings.yaml`）決定，預設值都相對於
專案目錄，clone 下來就能直接跑。

| 環境變數 | 預設值 | 說明 |
| --- | --- | --- |
| `PORT` | `3456` | 編輯器的連接埠 |
| `HOST` | `127.0.0.1` | 編輯器綁定的位址；也可在介面上設定 |
| `HOMEPAGE_CONFIG_PATH` | `<專案>/config` | Homepage 設定檔（`services.yaml`、`bookmarks.yaml`）所在目錄 |
| `HOMEPAGE_BACKUP_PATH` | `<專案>/backups` | 備份目錄 |
| `HOMEPAGE_CMS_SETTINGS` | `<專案>/cms-settings.yaml` | 編輯器自身的設定檔 |
| `HOMEPAGE_PREVIEW_URL` | 無 | 預覽目標網址；未設定時需於介面設定 |
| `HOMEPAGE_CMS_PASSWORD` | 無 | 存取密碼；設定後所有寫入 API 都需要它 |
| `HOMEPAGE_CMS_LOCALES_PATH` | `<專案>/locales` | 語系檔目錄 |
| `HOMEPAGE_CMS_THEMES_PATH` | `<專案>/themes` | 配色方案目錄 |

同一組設定也能在介面的齒輪按鈕裡改，寫進 `cms-settings.yaml`。兩種來源的優先序
不同：**路徑與連接埠**是環境變數優先（部署通常就是用環境變數掛載目錄，介面不該
蓋掉它）；**訪問網址與監聽位址**是設定檔優先（介面上填代表使用者明確選過）。每個
欄位下方會顯示目前生效的值與來源。

Windows 上把值寫在 `start-editor.local.bat`（不進版控）：

```bat
set "HOMEPAGE_CONFIG_PATH=\\nas\share\homepage"
```

### 自訂語言與配色

語言檔在 `locales/`、配色檔在 `themes/`，都是 INI 格式。放一個檔案進去，介面就會
多出對應的選項，不必改任何程式碼。

語言檔：`[meta]` 放語言代碼與顯示名稱，其餘 section 放 `key = 文字`。缺少的翻譯會
退回繁體中文。

```ini
[meta]
code = zh-TW
name = 繁體中文

[topbar]
title = Homepage 編輯器
save = 儲存
```

配色檔：`[colors]` 的每個 key 都對應 `public/style.css` 裡的一個 CSS 變數（`bg` →
`--bg`），少寫就套用不進去；`[options]` 目前是圓角與陰影。

```ini
[meta]
id = midnight
name = 深空
builtin = true

[colors]
bg = #0f1117
bg-card = #1a1d27
text = #e4e6eb
text-dim = #8b8fa3
accent = #6c5ce7

[options]
radius = 8px
shadow = 0 2px 8px rgba(0,0,0,0.3)
```

介面裡的「匯出」會把配色存成 INI 檔，「匯入」則相反——兩個方向的檔案格式相同。

## 要注意的事

- **綁 `0.0.0.0` 代表任何能連到這台機器的人都能改寫你的 Homepage 設定。** 預設只
  綁 `127.0.0.1`；要讓區網內的裝置連進來才改成 `0.0.0.0`，或啟動時設
  `HOST=0.0.0.0`。要對外開放請一併設定 `HOMEPAGE_CMS_PASSWORD`。
- 監聽位址與連接埠在介面上改完要重新啟動才會生效，介面會標示出來。
- 若設定檔在你編輯期間被其他程式改過，儲存會被拒絕並提示重新載入，避免蓋掉那些
  變更。
- 前端資產全部來自 npm 依賴並由伺服器提供，頁面不會向外部網域載入任何東西，沒有
  外網的環境也能正常使用。
- 編輯器自己的 HTML／JS／CSS 以不快取的方式提供。遇到空白頁或奇怪的錯誤，先按一次
  Ctrl+F5 強制重新整理。
- **更新編輯器後要重新啟動後端。** 正在執行的後端若比頁面舊，介面會提示重新啟動，
  而不是空白頁或解析錯誤。

### 自訂樣式與快取代理

「首頁外觀」分頁的「自訂 CSS」寫進 Homepage 設定目錄的 `custom.css`，那是
Homepage 官方提供的客製樣式檔。有一個坑要注意：**儀表板若放在快取代理（CDN）之後，
`/api/config/custom.css` 會被快取數小時**，改完樣式看不到變化，看起來像功能壞掉。

編輯器把 `custom.css` 拆成三段再組回去：字型區塊永遠在最前面（`@import` 只在樣式表
的第一行才有效，寫在後面會被瀏覽器默默丟棄）、每個配色各自一個區塊、你自己寫的內容
原樣保留。選了配色就編輯那個配色的區塊，各配色的客製化互不影響。

字型可以填一個名稱（瀏覽器本機有的就用，沒有就自動退回），也可以再填一個來源網址，
例如 Google Fonts 的連結——填了網址就會一併載入字型檔。Homepage 內建的字型
（Manrope、IBM Plex Mono）優先級較高，下拉選了它們時自訂字型不會生效。

來源網址填的是樣式表時（副檔名 `.css`），編輯器會讀取它、找出裡面的
`@font-face` 家族名稱並填進名稱欄。填的是字型檔（`.woff2`、`.woff`、`.ttf`、
`.otf`）時則改用 `@font-face` 規則匯入，名稱由使用者填寫。

對應措施是在代理上讓這個路徑不快取。以 Cloudflare 為例，在 **Cache Rules** 加一條
優先於既有通配規則的規則：

| 比對 | 動作 |
| --- | --- |
| `http.request.uri.path eq "/api/config/custom.css"` | 不快取 |
| （原有的通配規則） | 快取 |

來源站台本身會送 `ETag`，不快取之後瀏覽器會用它重新驗證，沒改動就回 304、有改動
就拿到新內容。改完樣式記得重新載入頁面；還是沒變化就按一次 Ctrl+F5。

另有一點：Homepage 的 dashboard 資料會快取在伺服器行程的記憶體裡，只有
`/api/revalidate` 會清除。編輯器存檔外觀後會自動呼叫它，所以預覽會立刻更新；若
儀表板開啟了存取驗證而無法呼叫，編輯器會提示按儀表板頁腳的重新整理按鈕。

## 設定檔格式

服務設定沿用 Homepage 的 YAML 格式，編輯器讀寫的是同一份檔案，因此也能直接手改。
欄位說明見 [Homepage 設定文件](https://gethomepage.dev/configs/services/)。

視覺欄位（主題、配色、背景、字型等）寫在 `settings.yaml`，「首頁外觀」分頁就能改，
不必離開編輯器；存檔前同樣自動備份。

```yaml
- 開發工具:
    - code-server:
        href: https://code.example.com
        description: VS Code 網頁版
        icon: mdi-microsoft-visual-studio-code
        container: code-server
```

## Docker 部署

編輯器本身是一顆 Node 行程，可以直接 `npm start`，也可以用 Docker 跟 Homepage 放在
同一個 stack：Homepage 照舊在根路徑，編輯器掛在同一網域下一層 `/cms`，兩邊共用
同一份設定目錄。兩種跑法讀寫的是同一批 YAML，可以並存，切換只是停一邊、起另一邊。

### 建置與啟動

```bash
# 映像先本地 build，tag 用 git 短 SHA，讓同時跑著的兩顆實例看得出來
docker build -t homepage-cms:$(git rev-parse --short HEAD) .
```

把 [compose.example.yml](compose.example.yml) 複製進你的 Homepage stack，填上自己
機器的值再啟動：

```bash
docker compose up -d homepage-cms
```

### 容器相關環境變數

| 變數 | 預設 | 說明 |
| --- | --- | --- |
| `HOMEPAGE_CMS_BASE_PATH` | 空（掛根） | 編輯器的網址前綴，例如 `/cms`；前端與 API 都跟著前綴走 |
| `HOMEPAGE_CMS_REVALIDATE_URL` | 沿用預覽網址 | 存檔後重讀 Homepage 的目標；同 stack 內填服務名（`http://homepage:3000`）直連 |
| `HOST` | `127.0.0.1` | 容器內固定 `0.0.0.0`，對外由 tunnel／反代擋 |

`compose.example.yml` 把編輯器的自身設定檔與備份放在 Homepage 設定目錄下的 `cms/`
子目錄（`HOMEPAGE_CMS_SETTINGS`、`HOMEPAGE_BACKUP_PATH` 都指進 `cms/`），兩個容器
共用同一個設定目錄掛載。`cms/` 是機器相關資料，不進版控。

### 前綴 `/cms` 怎麼走通

編輯器自己認前綴，不需要加第三顆反代容器。設定 `HOMEPAGE_CMS_BASE_PATH=/cms` 後，
伺服器把靜態、`/vendor` 與 `/api` 全部掛在前綴下，並把前綴寫進 `window.__META__`，
前端的 asset 與 API 呼叫都跟著走。Cloudflare tunnel 的 path 規則要**保留完整路徑**
（`/cms/*` 原樣送容器，不要 strip），根路徑維持指 Homepage。未設前綴時行為與掛根
完全相同。

### 雙模式並存

- 單機版照舊 `npm start` 或 `start-editor.bat`，設定檔是專案根 `cms-settings.yaml`。
- 容器版跟 Homepage 同 stack，設定檔在 `cms/cms-settings.yaml`。
- 兩版讀寫同一批 Homepage YAML，同時改同一份檔時，後存的一方會拿到 409，重載再存
  即可（既有 hash 樂觀鎖的保護，不是 bug）。
- 同一個 tunnel hostname 一次只指一邊；要兩版都對外，就開兩個 hostname 各指各的。

### 存取保護

不要把密碼寫進 compose。啟用介面上的存取保護，雜湊（salt + scrypt）會存進 `cms/`
底下的設定檔，容器重建也不丟；對外的 `/cms` 就會要求密碼。`HOMEPAGE_CMS_PASSWORD`
環境變數另有一套啟動時直接設定的路徑，兩擇一即可。

## 開發

本專案以 OpenSpec 規格驅動，行為記錄在 `openspec/specs/`；要新增或變更行為，先在
`openspec/changes/` 寫一份變更提案。開發慣例見 [AGENTS.md](AGENTS.md)。

```bash
npm test    # 版面測試，需要本機有 Chrome 且編輯器正在執行
```

## License

MIT，詳見 [LICENSE](LICENSE)。使用的第三方元件：

| 元件 | 授權 | 取得方式 |
| --- | --- | --- |
| [Express](https://expressjs.com/) | MIT | npm 依賴 |
| [js-yaml](https://github.com/nodeca/js-yaml) | MIT | npm 依賴 |
| [Vue 3](https://vuejs.org/) | MIT | npm 依賴，由伺服器提供 |
| [Material Design Icons](https://pictogrammers.com/library/mdi/) | Apache-2.0 | npm 依賴，由伺服器提供 |
