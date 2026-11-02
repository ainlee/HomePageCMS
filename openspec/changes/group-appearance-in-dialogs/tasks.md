# Tasks

## 1. 前端：分組對話框外觀區
- [ ] 1.1 app.js：editingGroup 與 editingBookmarkGroup 擴充 tab、style、columns、
      header、initiallyCollapsed、useEqualHeights；開對話框時從該群組的 layout
      條目帶入，儲存時以同一個 sync 助手一次寫回 layoutGroups（改名同步沿用）
- [ ] 1.2 app.js：availableTabs computed——掃描 layoutGroups 全部 tab 值去重
      （服務與書籤共用同一 layout 名空間）
- [x] 1.3 app.js：清空群組分頁只影響該群組自身（chip 的 X 清空該群組的
      tab 值）；其他群組仍在用同一 tab 時該 tab 維持存活，無群組使用時
      該 tab 自然消失——不主動級聯清空其他群組
- [ ] 1.4 app.js：deleteGroup / deleteBookmarkGroup 刪除群組時連同該群組名
      的 layout 條目（含 source）移除
- [ ] 1.5 index.html：服務與書籤的分組對話框加「外觀」區——tab 輸入框加
      datalist（existing 分頁名）加已選分頁的可刪 chip（X 只清空該群組
      自身指派，見 1.3）、
      style select、columns 數字、header / initiallyCollapsed / useEqualHeights
      三態；對話框改用寬版（modal-wide）容納 form-grid
- [ ] 1.6 style.css：chip 與 X、datalist 相容、form-grid 窄螢幕兩欄換行
      （沿用窄螢幕格線慣例）

## 2. 前端：版面分頁重構
- [ ] 2.1 app.js：layoutOrphans computed——layoutGroups 中名稱不在
      knownGroupNames 的條目；版面分頁群組列改列 orphan 列
- [ ] 2.2 app.js＋index.html：分頁結構總覽——依 layoutGroups 順序列出 tab
      桶與未指派桶、桶內群組 chip 可點；known 群組點開對應分組對話框，
      orphan 點開 layout 群組對話框
- [ ] 2.3 index.html：版面分頁群組列只留 orphan 列（含既有孤兒標籤與編輯
      刪除鈕）；未綁定條目照舊可編輯可刪

## 3. 語系
- [ ] 3.1 四份語系檔新增 [group] 外觀區 key（tab、style、columns、header、
      initiallyCollapsed、useEqualHeights、chip 提示文字、清空提示、新增分頁
      選項）與 [layout] 總覽 key；key 名稱帶所屬區域前綴
- [ ] 3.2 verify-i18n 的 key 一致性通過（四 pack 同 key）

## 4. 測試
- [ ] 4.1 tests/verify-group-appearance.mjs（新）：對話框外觀區填入與存檔後
      settings.yaml layout 條目內容正確；tab chip 的 X 只清空該群組自身指派、
      其他仍在使用該 tab 的群組不受影響；刪群組連同 layout 條目；改名同步；
      未指派群組在所有 tab 出現的
      說明文字存在
- [ ] 4.2 tests/verify-layout.mjs 跟隨重構調整：群組列改為 orphan 列，
      既有 assertion 依新版面改寫
- [ ] 4.3 npm test 全數通過（以既有 baseline 失敗為下限，不新增失敗）
