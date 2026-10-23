# Change: complete-service-bookmark-fields

## Why

使用者看到朋友的 Homepage 書籤有說明文字、服務有 Docker 主機與多個 widget，
回到我們的編輯器卻找不到對應的欄位，只能手改 YAML。書籤缺 description，
服務缺 server、weight、Kubernetes 欄位與複數 widgets，
編輯器與上游 Homepage 的欄位沒有對齊。

## What Changes

- 書籤對話框新增 description（說明）與 icon 欄位；列表顯示說明，
  未填說明時維持顯示連結。
- 書籤 YAML 讀寫保留 description 與 icon，與現有的未建模欄位保留行為一致。
- 服務對話框新增 server（Docker 主機）、weight（排序權重）、
  Kubernetes 用 namespace 加 app（另含 podSelector）欄位。
- 服務的 widget 擴充為可掛多個（複數 widgets），
  保留現有的單一 widget（container、ping、customapi）寫法。
- 四個內建語系檔同步新增上述欄位的字串；測試覆蓋新增欄位的讀寫。

## Capabilities

### New Capabilities

（無）

### Modified Capabilities

- `config-editing`：書籤與服務可編輯的欄位範圍擴大，存檔寫回對應的 YAML 欄位。

## Impact

- Affected specs: `config-editing`（MODIFIED）
- Affected code: `public/index.html`、`public/app.js`、`locales/*.ini`、
  `tests/verify-bookmarks.mjs`、服務相關的 verify 測試
- 不改動存檔流程：未建模欄位照舊保留，只覆蓋實際編輯過的欄位。
