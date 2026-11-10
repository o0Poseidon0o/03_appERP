@echo off
REM =============================================================================
REM FILE CHẠY TỰ ĐỘNG CHO CẢ WINDOWS 7, WINDOWS 8, WINDOWS 10, WINDOWS 11
REM Bỏ qua rào cản ExecutionPolicy Restricted mặc định trên Windows 7
REM =============================================================================
cd /d "%~dp0"
echo Dang khoi chay TOWA ITAM Agent...
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0powershell_phancung.ps1"

