# Change: service-widget-fields

## Why

服務卡片的可顯示欄位、多組 widget、widget 的標頭與高亮規則、服務的監測開關
（siteMonitor、statusStyle、showStats）與圖示前綴（si-、sh-、dashboard-icons、
自訂顏色），上游全都支援，編輯器卻只能以「其它 widget 不動」帶過。widget 型別
下拉也只有四種，實際上有 200 多種。

## What Changes

- 服務對話框的 widget 型別改成完整清單（由上游 src/widgets 目錄產出的常數檔
  public/widget-types.js 提供，伺服器注入；未建模的型別以原值保留並提示）。
- 每個服務可掛多組 widget：以清單呈現、可新增／刪除／排序；每組可選型別與
  該型別常見的欄位（url、key、container、host、fields、headers、highlight、
  hideErrors 等通用欄位）。
- 服務欄位補上 siteMonitor、statusStyle（dot/basic/未設）、showStats（true/false/
  未設）。
- 圖示欄位接受 si-、sh-、dashboard-icons 名稱與自訂顏色綴記（mdi-XX-#hex），
  預覽以 CDN 圖示呈現；未填時維持 abbr／佔位圖。
- 書籤項目補上 target 欄位。
- 介面遵循既有 design token 與 Minimalism 路線。

## Capabilities

### New Capabilities

（無）

### Modified Capabilities

- config-editing：服務 widget 支援多組、完整型別清單與通用欄位；書籤支援 target。

## Impact

- Affected specs: config-editing（MODIFIED）
- Affected code: public/app.js、public/index.html、public/style.css、
  public/widget-types.js（新）、server.js（注入 widget 型別清單）、locales/*.ini
- 新增 tests/verify-service-widget-fields.mjs
