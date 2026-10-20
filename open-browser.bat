@echo off
REM Waits a few seconds so the server is up, then opens the URL in the default
REM browser. ASCII only: cmd.exe mis-parses batch files with multi-byte
REM characters when they are called from another batch file.
REM Usage: call open-browser.bat http://localhost:3456
ping -n 4 127.0.0.1 >nul
start "" "%~1"
