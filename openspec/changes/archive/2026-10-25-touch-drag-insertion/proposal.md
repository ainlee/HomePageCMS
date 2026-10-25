# Change: touch-drag-insertion

## Why

桌面端的卡片拖曳排序在手機上看得到卻動不了。現有的引擎只綁滑鼠事件，觸控移動
產生的不是 `mousemove`；加上把手沒有標記 `touch-action: none`，瀏覽器會把手勢
拿去捲頁面，使用者點下後只要手指稍微移動就變成捲動而不是拖曳，看起來就像「不
能用觸控拖曳」。

## What Changes

- 把拖曳引擎由 `mousedown`/`mousemove`/`mouseup` 遷移到 Pointer Events，單一
  代碼同時承載滑鼠、觸控與手寫筆。
- 觸控按壓記錄原始座標，手指移動至少 5px 才真正起拖，避免輕點與長按選取
  被誤判成拖曳；滑鼠維持既有的即按即拖。
- 拖曳把手加上 `touch-action: none`，把手區不再被瀏覽器攬走捲動與手勢。
- 拖曳中的自動捲動改為跟著指標的 Y 座標工作，觸控與滑鼠共用同一條路徑。
- 無頭 Chrome 以觸控指標模擬手機拖曳：同組排序、跨組插入與指示條行為，
  並確認沒有拖曳時頁面捲動不受影響。

## Capabilities

### New Capabilities

（無）

### Modified Capabilities

- `config-editing`：拖曳排序與跨分組移動在觸控裝置上可用，行為與滑鼠一致；
  分組卡與項目卡的落點指示在觸控拖曳時同樣顯示。

## Impact

- Affected specs: `config-editing`（MODIFIED）
- Affected code: `public/app.js`（拖曳引擎）、`public/style.css`（把手的
  `touch-action`）、`tests/`（新增觸控拖曳驗證，併入 npm test）
- 不改動存檔流程：拖曳仍只移動記憶體中的物件，存檔照舊寫回 YAML。
