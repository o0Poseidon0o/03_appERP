@echo off
REM =============================================================================
REM FILE CHẠY TỰ ĐỘNG & MỞ KHÓA POWERSHELL CHO WINDOWS 7, 8, 10, 11, SERVER
REM Tự động mở khóa ExecutionPolicy + Registry Policy + Unblock File trước khi chạy
REM =============================================================================
cd /d "%~dp0"

REM --- 1. MỞ KHÓA TRIỆT ĐỂ POWERSHELL TRONG REGISTRY (64-BIT, 32-BIT & GPO) ---
reg add "HKLM\SOFTWARE\Microsoft\PowerShell\1\ShellIds\Microsoft.PowerShell" /v ExecutionPolicy /t REG_SZ /d Unrestricted /f >nul 2>&1
reg add "HKLM\SOFTWARE\Wow6432Node\Microsoft\PowerShell\1\ShellIds\Microsoft.PowerShell" /v ExecutionPolicy /t REG_SZ /d Unrestricted /f >nul 2>&1
reg add "HKCU\SOFTWARE\Microsoft\PowerShell\1\ShellIds\Microsoft.PowerShell" /v ExecutionPolicy /t REG_SZ /d Unrestricted /f >nul 2>&1
reg add "HKLM\SOFTWARE\Policies\Microsoft\Windows\PowerShell" /v EnableScripts /t REG_DWORD /d 1 /f >nul 2>&1
reg add "HKLM\SOFTWARE\Policies\Microsoft\Windows\PowerShell" /v ExecutionPolicy /t REG_SZ /d Unrestricted /f >nul 2>&1
reg add "HKCU\SOFTWARE\Policies\Microsoft\Windows\PowerShell" /v EnableScripts /t REG_DWORD /d 1 /f >nul 2>&1
reg add "HKCU\SOFTWARE\Policies\Microsoft\Windows\PowerShell" /v ExecutionPolicy /t REG_SZ /d Unrestricted /f >nul 2>&1

REM --- 2. GỠ CHẶN FILE TẢI TỪ MẠNG (ZONE.IDENTIFIER) & CHẠY SCRIPT ---
echo Dang mo khoa PowerShell va khoi chay TOWA ITAM Agent...
powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "try { Unblock-File -Path '%~dp0powershell_phancung.ps1' -ErrorAction SilentlyContinue } catch {}; & '%~dp0powershell_phancung.ps1'"


