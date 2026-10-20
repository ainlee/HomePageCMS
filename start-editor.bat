@echo off
chcp 65001 >nul
title Homepage 編輯器
cd /d %~dp0

REM 設定檔位置與連接埠。已設定時沿用傳入的值，否則使用預設值。
if "%HOMEPAGE_CONFIG_PATH%"=="" set "HOMEPAGE_CONFIG_PATH=\\Rgm-88x\disk1\projects\homepage"
if "%PORT%"=="" set "PORT=3899"

echo ========================================
echo   Homepage 編輯器
echo ========================================
echo.
echo   設定路徑: %HOMEPAGE_CONFIG_PATH%
echo   訪問地址: http://localhost:%PORT%
echo   或區域網: http://<本機IP>:%PORT%
echo.
echo   按 Ctrl+C 或關閉此窗口即可停止
echo ========================================
echo.

node server.js

pause
