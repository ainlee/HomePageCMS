# Change: preserve-config-fields

## Why

存檔時編輯器會從畫面模型重新產生整份 YAML，但模型只認得 7 個欄位
（href、target、description、icon、container、ping、customapi）。使用者檔案裡其他
欄位——上游 Homepage 支援的 `siteMonitor`、`widget`、`server`、`app`、`parameters`
等——會在第一次存檔時整批消失，而且沒有任何提示。分組層級的 `col-span` 也一樣：
介面可以選、畫面會顯示 `col-2`，但從來沒有被寫進檔案。

另外，編輯器寫出的 `customapi: <url>` 不是上游 Homepage 的語法：上游的自訂 API
小工具是 `widget: { type: customapi, url: <url> }`。範例檔教的是錯的寫法，開源後
別人照著填會得到沒有小工具的服務。

## What Changes

- 存檔改為「以使用者原本的 YAML 物件為底，覆蓋編輯器編輯過的欄位」，任何編輯器
  沒有建模的欄位都會保留。
- 保留分組層級的額外欄位（含 `col-span`），並讓分組寬度真的寫進檔案；上游會忽略
  它，但不會因此壞掉，支援該欄位的部署則可以正常使用。
- 巢狀分組（上游支援的分組內再分組）不再被存檔flatten 成普通服務，維持原樣。
- 狀態小工具的語法改為上游寫法：`widget: { type: customapi, url }`；既有檔案若是
  舊的 `customapi:` 寫法則沿用原寫法，不會被改寫成別種方言。
- YAML 改用 js-yaml 產生，值需要引號時自動引號化，不再有手寫字串拼接的風險。
- 範例檔改成上游語法。

## Impact

- Affected specs: `config-fidelity`（新增能力）、`config-editing`（MODIFIED）
- Affected code: `public/app.js`、`public/index.html`、`server.js`、
  `config/*.example.yaml`、`README.md`
- 前端需要 js-yaml；改由伺服器從 `node_modules` 提供，不連外部 CDN（見
  `vendor-frontend-assets` 變更）。

