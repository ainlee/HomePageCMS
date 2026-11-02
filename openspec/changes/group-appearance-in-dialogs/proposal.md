# Change: group-appearance-in-dialogs

## Why

群組的版面欄位（分頁、排列、欄數、標題、初始折疊、等高卡片）目前藏在
「版面」分頁的群組列裡，跟分組本身的對話框拆開，使用者要改一個群組的外觀
得跑兩個地方、靠名稱對上，掉鏈時只有一個孤兒標籤。這些欄位的操作對象都是
群組本身，應該在編輯群組時一次完成；版面分頁的角色應縮回到頁面級設定與
結構總覽。

## What Changes

- 服務與書籤的分組對話框新增「外觀」區：分頁（tab）、排列樣式（style）、
  欄數（columns）、標題顯示（header）、初始折疊（initiallyCollapsed）、
  等高卡片（useEqualHeights）。資料照舊寫進 settings.yaml 的 layout 區塊、
  以群組名稱為鍵；存檔走既有的 saveAll layout 寫入，保留未建模欄位。
- 分頁欄位是可輸入的文字框，下方 datalist 列出所有已存在的分頁名（服務與
  書籤共用同一個 layout 名空間）；有值時顯示成一顆可刪除的標籤卡，卡後
  的 X 清空該群組的分頁。
- 清空某群組的分頁只影響該群組自身：該群組退回「顯示在所有分頁」。分頁
  值在其他群組仍在用它時維持存活，當沒有任何群組使用它時自然消失——
  從不主動清除其他群組的值（無級聯）。
- 刪除分組時連同它對應的 layout 條目一起移除。
- 版面分頁瘦身为頁面級：全域開關維持；群組列改為只列「未綁定條目」（無
  對應群組的自動發現群組等，照舊可編輯可刪）；新增「分頁結構總覽」：依
  layout 順序列出每個分頁桶與「未指派」桶、桶內群組可點，點 known 群組
  直接跳開對應的分組對話框。

## Capabilities

### Modified Capabilities

- config-editing：服務／書籤分組可管理的欄位擴充至外觀區；群組刪除連同
  layout 條目；清空分頁只影響該群組自身。
- layout-editing：layout 群組列限縮為未綁定條目；新增分頁結構總覽（唯讀）。

## Impact

- Affected specs: config-editing, layout-editing
- Affected code: public/app.js、public/index.html、public/style.css、
  locales/*.ini（四個內建語系檔）、tests/verify-group-appearance.mjs（新）、
  tests/verify-layout.mjs（跟隨版面分頁重構調整）
- 不改 server 與 lib：layout API 已建模全部欄位，分頁清空是純客戶端邏輯。
