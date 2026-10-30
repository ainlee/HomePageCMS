# Tasks

## 1. 資料與提示

 [x] 1.1 public/widget-types.js 補上 ping；docs/tmp/gen-widget-types.cjs 改為
      「目錄掃描加固定服務層型別（ping）」合併寫入，重跑可重現
- [x] 1.2 四份內建語系檔（en、ja、zh-CN、zh-TW）各加 [widgets] section：
      常用型別（docker、ping、gatus、traefik、customapi、grafana、uptimekuma、
      plex、jellyfin、nextcloud、syncthing、pihole、proxmox、kubernetes 等）
      先寫入一筆提示；未覆蓋型別缺 key 照慣例退回
- [x] 1.3 app.js 的 widgetTypeLabel 與 widgetValueHint 對 ping 給出本地化名稱
      與 IP 佔位提示

## 2. 前端元件

- [x] 2.1 app.js 新增 select-hint 元件（trigger 加 listbox 選單、選項列左名稱
      右提示、跑馬燈 class 與量測、鍵盤與焦點、aria）；註冊到元件清單
- [x] 2.2 index.html：服務卡片 dialog 的 widget 型別下拉與資訊小工具 dialog 的
      型別下拉改用 select-hint；未建模型別的「原值保留」選項保留行為
- [x] 2.3 style.css：選項列兩欄版面、跑馬燈 keyframes、prefers-reduced-motion
      靜止截斷、選單最大高度與捲動；不動其他原生 select

## 3. 驗證

- [x] 3.1 tests/verify-select-hints.mjs：展開顯示名稱加提示、缺 key 退回、
      長提示跑馬燈（量測斷言）、鍵盤選定、點外部收起、行動版窄欄不溢出；
      納入 npm test 主鏈
- [x] 3.2 ping 存檔路徑測試：選 ping 填 host 存檔後 YAML 含 ping 欄位（或
      widget 物件）、複數 widgets 時不含遗留的 host 欄位錯誤
- [x] 3.3 npm test 全數通過
