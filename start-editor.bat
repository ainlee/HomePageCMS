@echo off
chcp 65001 >nul
title Homepage 編輯器
cd /d %~dp0

REM 本機專屬設定（不進版控）：start-editor.local.bat
REM 要指向 NAS 共用資料夾、換連接埠等，在那個檔案裡設定，這裡只留共用預設值。
if exist "%~dp0start-editor.local.bat" call "%~dp0start-editor.local.bat"

REM 設定檔位置、連接埠與綁定位址。已設定時沿用傳入的值，否則使用預設值。
REM HOMEPAGE_CONFIG_PATH 留空時使用專案下的 config 目錄；要指向 NAS 共用資料夾，
REM 請在環境變數或自己的啟動捷徑裡設定，不要寫在這個檔案裡。
if "%HOST%"=="" set "HOST=0.0.0.0"
if "%HOMEPAGE_CONFIG_PATH%"=="" set "HOMEPAGE_CONFIG_PATH=%~dp0config"
if "%PORT%"=="" set "PORT=3899"

echo ========================================
echo   Homepage 編輯器
echo ========================================
echo.
echo   設定路徑: %HOMEPAGE_CONFIG_PATH%
echo   訪問地址: http://localhost:%PORT%
echo   或區域網: http://<本機IP>:%PORT%
echo.
echo   注意: 對外開放後，任何能連到這台機器的人都能改寫你的 Homepage 設定。
echo   請在設定畫面開啟存取密碼，或設定 HOMEPAGE_CMS_PASSWORD。
echo.
echo   按 Ctrl+C 或關閉此窗口即可停止
echo ========================================
echo.

node server.js

pause
