@echo off
REM =============================================================================
REM BO CAI DAT TU DONG TOWA ITAM AGENT (KHONG CAN JOIN DOMAIN / WORKGROUP)
REM Ho tro: Windows 7, Windows 8, Windows 10, Windows 11, Windows Server
REM Chuc nang:
REM   1. Tu dong xin quyen Administrator (UAC) khi nhap dup chuot
REM   2. Cai dat Agent vao C:\ProgramData\TowaITAM
REM   3. Dang ky Task Scheduler chay ngam voi quyen SYSTEM:
REM      - Tu dong chay moi khi bat may tinh (ONSTART)
REM      - Tu dong chay dinh ky hang ngay luc 08:45 sang (DAILY)
REM   4. Tu dong cap nhat script moi nhat tu Server neu Server co ban cap nhat
REM   5. Dong bo ngay lap tuc lan dau tien ve Server
REM =============================================================================

set "SERVER_IP=192.168.20.17"
set "INSTALL_DIR=C:\ProgramData\TowaITAM"

REM --- 1. KIEM TRA VA TU DONG NANG QUYEN ADMINISTRATOR ---
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo [!] Dang yeu cau quyen Administrator de dang ky Task chay ngam...
    powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "Start-Process -FilePath '%~f0' -Verb RunAs"
    exit /b
)

echo =====================================================================
echo   CAI DAT TU DONG TOWA ITAM AGENT (WINDOWS 7 / 10 / 11 - WORKGROUP)
echo =====================================================================

REM --- 1B. MO KHOA TRIET DE POWERSHELL TRONG REGISTRY (64-BIT, 32-BIT & GPO) ---
echo [0/4] Dang mo khoa toan bo chinh sach PowerShell (ExecutionPolicy & GPO)...
reg add "HKLM\SOFTWARE\Microsoft\PowerShell\1\ShellIds\Microsoft.PowerShell" /v ExecutionPolicy /t REG_SZ /d Unrestricted /f >nul 2>&1
reg add "HKLM\SOFTWARE\Wow6432Node\Microsoft\PowerShell\1\ShellIds\Microsoft.PowerShell" /v ExecutionPolicy /t REG_SZ /d Unrestricted /f >nul 2>&1
reg add "HKCU\SOFTWARE\Microsoft\PowerShell\1\ShellIds\Microsoft.PowerShell" /v ExecutionPolicy /t REG_SZ /d Unrestricted /f >nul 2>&1
reg add "HKLM\SOFTWARE\Policies\Microsoft\Windows\PowerShell" /v EnableScripts /t REG_DWORD /d 1 /f >nul 2>&1
reg add "HKLM\SOFTWARE\Policies\Microsoft\Windows\PowerShell" /v ExecutionPolicy /t REG_SZ /d Unrestricted /f >nul 2>&1
reg add "HKCU\SOFTWARE\Policies\Microsoft\Windows\PowerShell" /v EnableScripts /t REG_DWORD /d 1 /f >nul 2>&1
reg add "HKCU\SOFTWARE\Policies\Microsoft\Windows\PowerShell" /v ExecutionPolicy /t REG_SZ /d Unrestricted /f >nul 2>&1

REM --- 2. TAO THU MUC CAI DAT C:\ProgramData\TowaITAM ---
if not exist "%INSTALL_DIR%" (
    mkdir "%INSTALL_DIR%"
)

REM --- 3. COPY HOAC TAI FILE POWERSHELL_PHANCUNG.PS1 VE MAY ---
if exist "%~dp0powershell_phancung.ps1" (
    echo [1/4] Dang sao chep powershell_phancung.ps1 vao %INSTALL_DIR%...
    copy /Y "%~dp0powershell_phancung.ps1" "%INSTALL_DIR%\powershell_phancung.ps1" >nul
) else (
    echo [1/4] Dang tai powershell_phancung.ps1 truc tiep tu Server %SERVER_IP%...
    powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "$wc = New-Object System.Net.WebClient; $wc.Encoding = [System.Text.Encoding]::UTF8; try { $wc.DownloadFile('http://%SERVER_IP%:90/agent/powershell_phancung.ps1', '%INSTALL_DIR%\powershell_phancung.ps1') } catch { $wc.DownloadFile('http://%SERVER_IP%:3000/api/assets/agent-script/windows', '%INSTALL_DIR%\powershell_phancung.ps1') }"
)

REM --- 4. TAO SCRIPT AUTO-UPDATE + RUNNER (TU CAP NHAT TU SERVER KHI CHAY) ---
(
echo $ErrorActionPreference = "SilentlyContinue"
echo $InstallDir = "C:\ProgramData\TowaITAM"
echo $LocalScript = "$InstallDir\powershell_phancung.ps1"
echo $ServerUrls = @^("http://%SERVER_IP%:90/agent/powershell_phancung.ps1", "http://%SERVER_IP%:90/api/assets/agent-script/windows"^)
echo foreach ^($u in $ServerUrls^) {
echo     try {
echo         $req = [System.Net.HttpWebRequest]::Create^($u^)
echo         $req.Timeout = 5000
echo         $resp = $req.GetResponse^(^)
echo         $stream = $resp.GetResponseStream^(^)
echo         $reader = New-Object System.IO.StreamReader^($stream, [System.Text.Encoding]::UTF8^)
echo         $content = $reader.ReadToEnd^(^)
echo         $reader.Close^(^); $resp.Close^(^)
echo         if ^($content -and $content.Length -gt 1000 -and $content -match "TOWA ITAM AGENT"^) {
echo             [System.IO.File]::WriteAllText^($LocalScript, $content, [System.Text.Encoding]::UTF8^)
echo             break
echo         }
echo     } catch {}
echo }
echo if ^(Test-Path $LocalScript^) {
echo     ^& powershell.exe -NoProfile -ExecutionPolicy Bypass -File $LocalScript
echo }
) > "%INSTALL_DIR%\auto_runner.ps1"

REM --- 5. DANG KY WINDOWS TASK SCHEDULER (CHAY NGAM VOI QUYEN SYSTEM) ---
echo [2/4] Dang dang ky Task Scheduler tu dong chay khi bat may va hang ngay...

schtasks /Create /TN "TowaITAM_OnBoot" /TR "powershell.exe -NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File \"%INSTALL_DIR%\auto_runner.ps1\"" /SC ONSTART /RU "SYSTEM" /RL HIGHEST /F >nul 2>&1
schtasks /Create /TN "TowaITAM_Daily" /TR "powershell.exe -NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File \"%INSTALL_DIR%\auto_runner.ps1\"" /SC DAILY /ST 08:45 /RU "SYSTEM" /RL HIGHEST /F >nul 2>&1

echo [3/4] Da dang ky thanh cong 2 lich tu dong:
echo       - TowaITAM_OnBoot : Tu dong gui du lieu moi khi bat may tinh
echo       - TowaITAM_Daily  : Tu dong gui du lieu hang ngay luc 08:45 sang

REM --- 6. CHAY DONG BO NGAY LAP TUC LAN DAU TIEN ---
echo [4/4] Dang chay dong bo du lieu may tinh ve Server ngay bay gio...
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%INSTALL_DIR%\auto_runner.ps1"

echo.
echo =====================================================================
echo   HOAN TAT! May tinh nay da duoc cau hinh tu dong gui thong tin ve
echo   Server TOWA ITAM (%SERVER_IP%) ma KHONG can Join Domain!
echo =====================================================================
pause
