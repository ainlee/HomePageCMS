# Change: widget-type-hints

## Why

服務卡片的 widget 型別下拉有 170 多個選項，全是參數名（docker、gatus、traefik……），
對不熟 Homepage 的人幾乎不可讀；而且清單有缺漏——上游服務層支援的 ping（ICMP 監控）
不在 public/widget-types.js 裡（產生器只掃 src/widgets 資料夾，ping 是服務層欄位而非
src/widgets 的型別），使用者根本選不到最基本的 ping 追蹤。

## What Changes

- 新增一個自繪的下拉元件：每個選項一行，左側是型別名稱、右側靠齊放一句話說明。
  替代服務卡片 dialog 與資訊小工具 dialog 的型別下拉；其他下拉維持原生不動。
- 說明文字走語系：widgets.<type>.hint，對型別清單裡的每一筆型別都寫入提示；檔案裡有、型別清單沒有的型別
  缺 key 時照舊退回、該列右側留空（既有慣例），版面不受影響。
- 說明文字超過欄位寬度時，該行右側做水平跑馬燈（CSS 動畫、文字重複一次、
  prefers-reduced-motion 時靜止不捲），而不是截斷省略。
- public/widget-types.js 補上 ping；widgetTypeLabel 對它給出本地化名稱、
  widgetValueHint 對它給出 IP 佔位提示。
- 自繪下拉照搬原生行為：鍵盤 ↑↓、Enter 確認、Esc 收起來、點外部收起來、
  focus 管理；與 .form-group 同寬同高，行動版欄位窄時跑馬燈照樣工作。

## Capabilities

### New Capabilities

- select-hints：自繪下拉的選項列版面（名稱＋右側說明、跑馬燈、鍵盤與焦點行為）
  與提示文字的語系化（缺譯退回、缺提示留空）。

### Modified Capabilities

- config-editing：服務 widget 型別清單補 ping；選 ping 時走既有 legacy-ping 路徑
  寫回 service.ping 欄位。
- widgets-panel：資訊小工具 dialog 的型別下拉與服務 dialog 共用同一元件與提示集。

## Impact

- Affected specs: select-hints（新）、config-editing、widgets-panel
- Affected code: public/app.js（元件與 widgetTypes 併入 ping）、public/widget-types.js、
  public/index.html、public/style.css、locales/*.ini、tests/verify-select-hints.mjs（新）
- 不改存檔流程；normalizeWidgets / writeWidgets 已認得 ping 的讀寫路徑，只補下拉選項。
