# preview-panel

## MODIFIED Requirements

### Requirement: 可隱藏與顯示預覽

系統 SHALL 提供隱藏與顯示預覽的切換。隱藏時編輯面板取得完整寬度，顯示時恢復
分割。切換控制項 SHALL 以眼睛圖示呈現，MUST NOT 另加文字標籤；該控制項的名稱
SHALL 放在提示中，讓使用者在滑過時仍看得到它要做什麼。

#### Scenario: 隱藏預覽

- **WHEN** 使用者按下眼睛圖示
- **THEN** 預覽面板與分割線不再顯示，編輯面板佔滿可用寬度

#### Scenario: 顯示預覽

- **WHEN** 預覽已隱藏，使用者再次按下眼睛圖示
- **THEN** 預覽面板與分割線回來，恢復原本的分割比例

