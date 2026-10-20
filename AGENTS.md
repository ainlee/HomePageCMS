# HomePageCMS

Homepage 的 YAML 設定後台。左側編輯、右側即時預覽，存檔前自動備份。

## 執行

```bash
npm install
npm start          # http://localhost:3456
```

執行期設定全部由環境變數決定，預設值都相對於專案目錄：

```
PORT                    編輯器連接埠（預設 3456）
HOST                    綁定位址（預設 0.0.0.0）
HOMEPAGE_CONFIG_PATH    Homepage 設定檔目錄（預設 config/）
HOMEPAGE_BACKUP_PATH    備份目錄（預設 backups/）
HOMEPAGE_CMS_SETTINGS   編輯器自身設定檔（預設 <設定檔目錄>/.homepage-cms.yaml）
HOMEPAGE_PREVIEW_URL    預覽目標（未設定時於介面設定）
```

首次啟動且設定檔不存在時，會由 `config/*.example.yaml` 建立初始設定。範例檔是
唯一該進版控的設定內容，實際設定檔不進版控。預覽網址可在介面的齒輪按鈕修改，
寫入編輯器設定檔。

## 測試

```bash
npm test
```

三組無頭 Chrome 測試，覆蓋折疊與分割線行為、行動版版面、可見範圍量測。
需要本機有 Chrome，且編輯器正在執行（預設 `http://localhost:3456`，可用
`APP_URL` 覆寫，Chrome 路徑可用 `CHROME_PATH` 覆寫）。

測試驗證的是**版面行為**，不是實作細節。改動版面時，測試失敗多半代表行為
真的變了，請先確認是不是預期中的改動。

## 慣例

- **設定格式就是 Homepage 的 YAML 格式。** 不要發明私有格式，編輯器與
  Homepage 直接共用同一份檔案。
- **面板尺寸由 Vue 的 computed 決定**，不要在拖曳時直接寫內嵌 `width`/`height`。
  內嵌樣式的優先級會蓋掉 `.collapsed` 類別，導致折疊時分割線不動。
- **高度來自實測的可見範圍**，不要用 `100vh` 或 `dvh` 當最終答案。手機瀏覽器
  這兩個值指的是網址列收起時的高版本畫面，會讓畫面底部永遠捲不到。
- **後端 API 很薄。** 設定檔就是磁碟上的 YAML，沒有一層資料庫要同步。
- **備份是自動的。** 寫入前一定先複製一份到備份目錄（預設 `backups/`），
  不要手動改流程繞開它。
- **不要把特定部署的值寫進程式碼。** 網域、路徑、埠號一律走環境變數或設定檔，
  預設值相對於專案目錄。預覽網址的決定順序是設定檔 > 環境變數 > 尚未設定，
  不要加內建預設值——猜錯只會在預覽區顯示無關的錯誤頁。

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

