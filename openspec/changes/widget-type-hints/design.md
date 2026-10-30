# Design

## Context

型別下拉是 170 多個原生 select 選項，列只有名稱；提示需要「名稱左、說明右」的
兩欄版面，原生 option 做不到。提示要走語系，但 lib/ini.js 的 flatten 只展開一層
「section.key」，為每個型別開一個 INI section 不現實。ping 是上游服務層欄位
（src/components/services/ping.jsx 讀 service.ping），不在 src/widgets 資料夾，
產生器 docs/tmp/gen-widget-types.cjs 掃不到，需併入。

## Goals / Non-Goals

Goal：自繪下拉元件（Vue 3、trigger 按鈕加絕對定位選單），選項列兩欄，鍵盤與
焦點行為對齊原生；提示隨語系切換即時更新（catalogue 是 reactive，換 pack 後
跟著變，不需重載頁面）。
Non-goal：不改其他欄位的原生下拉；不改存檔、hash、備份流程。

## Decisions

- 提示放語系檔的 [widgets] section：每份內建語系檔加一個 [widgets] section，
  key 是型別名、值是一句話提示；flatten 後 catalogue 裡就是 widgets.docker
  這類 key。前端查 t('widgets.' + type)，缺 key 照現行慣例退回繁中再退回 key。
  170 個 key 集中在一個 section，語系檔不膨爆；使用者自訂語系檔沿用「丟檔
  進來」的慣例。
  （考慮過的替代：每個型別一個 section——INI 一層 flatten 撐不住三層 key，
  否決；另開 widget-hints.js 資料檔——提示是介面文字，慣例上應走語系檔，
  否決。）
- ping 併進 widget-types.js：產生器改為「目錄掃描結果加固定服務層型別
  （目前只 ping）」合併後寫入，重跑可重現、不覆蓋手動行。
- ping 的存檔路徑零改動：normalizeWidgets、buildWidgetObject、writeWidgets
  已認得 ping 型別與 legacy-ping 語法（host 值寫回 service.ping），只補
  下拉選項與提示。
- 跑馬燈：選單展開時量測提示渲染寬度，超過右側可用寬度才加 marquee class；
  CSS keyframes 平移兩份重複文字；prefers-reduced-motion 時不捲、改省略號
  截斷。量測失敗（例如字體未載入）時靜止顯示，不影響選取。
- 鍵盤與無障礙：trigger 按 Enter 或 Space 開啟、上下鍵移動、Enter 選定、
  Esc 收起、Tab 或點外部收起；選單 role 為 listbox、選項 role 為 option、
  用 aria-activedescendant 標記；收起後焦點回 trigger。

## Risks / Trade-offs

- 自繪下拉觸控目標比原生小：trigger 高度與 form-group 控制件一致、選單設
  最大高度與捲動；行動版無頭測試加斷言。
- 跑馬燈量測時機錯（語系剛切完、字體載入慢）：展開與語系切換時重量測；
  失敗時靜止顯示。
- 產生器重跑覆蓋手動行：產生器改為合併寫入，重跑結果可重現。

## Migration Plan

純前端：部署即生效；YAML 格式與存檔流程零變動。回退等於還原前端檔案。

## Open Questions

- 無。
