@echo off
REM =============================================================================
REM BO CAI DAT TU DONG TOWA ITAM AGENT - DANH RIENG CHO WINDOWS 7 / WINDOWS 8
REM Su dung VBSCRIPT (Khong can PowerShell - Chay tren moi Windows tu XP tro len)
REM =============================================================================

set "SERVER_IP=192.168.20.17"
set "INSTALL_DIR=C:\ProgramData\TowaITAM"

REM --- 1. KIEM TRA VA TU DONG NANG QUYEN ADMINISTRATOR ---
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo [!] Dang yeu cau quyen Administrator...
    powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "Start-Process -FilePath '%~f0' -Verb RunAs" 2>nul
    if %errorLevel% neq 0 (
        REM Fallback: Neu khong co PowerShell thi dung VBScript de nang quyen
        echo Set UAC = CreateObject("Shell.Application") > "%temp%\elevate.vbs"
        echo UAC.ShellExecute "%~f0", "", "", "runas", 1 >> "%temp%\elevate.vbs"
        cscript //nologo "%temp%\elevate.vbs"
        del "%temp%\elevate.vbs" >nul 2>&1
    )
    exit /b
)

echo =====================================================================
echo   CAI DAT TU DONG TOWA ITAM AGENT (WINDOWS 7 / 8 - VBSCRIPT)
echo   Khong can PowerShell - Chay tren moi Windows tu XP tro len
echo =====================================================================

REM --- 2. TAO THU MUC CAI DAT ---
if not exist "%INSTALL_DIR%" (
    mkdir "%INSTALL_DIR%"
)

REM --- 3. COPY HOAC TAI FILE VBSCRIPT AGENT ---
if exist "%~dp0vbscript_phancung.vbs" (
    echo [1/4] Dang sao chep vbscript_phancung.vbs vao %INSTALL_DIR%...
    copy /Y "%~dp0vbscript_phancung.vbs" "%INSTALL_DIR%\vbscript_phancung.vbs" >nul
) else (
    echo [1/4] Dang tai vbscript_phancung.vbs tu Server %SERVER_IP%...
    REM Su dung bitsadmin (co tren moi Windows tu Vista) hoac certutil
    bitsadmin /transfer "DownloadVBS" "http://%SERVER_IP%:90/agent/vbscript_phancung.vbs" "%INSTALL_DIR%\vbscript_phancung.vbs" >nul 2>&1
    if not exist "%INSTALL_DIR%\vbscript_phancung.vbs" (
        certutil -urlcache -split -f "http://%SERVER_IP%:90/agent/vbscript_phancung.vbs" "%INSTALL_DIR%\vbscript_phancung.vbs" >nul 2>&1
    )
    if not exist "%INSTALL_DIR%\vbscript_phancung.vbs" (
        echo [LOI] Khong tai duoc file vbscript_phancung.vbs tu Server!
        echo Vui long chep file vbscript_phancung.vbs thu cong vao %INSTALL_DIR%
        pause
        exit /b 1
    )
)

REM --- 4. TAO SCRIPT AUTO-UPDATE + RUNNER ---
(
echo On Error Resume Next
echo Dim objShell, objFSO, objHTTP
echo Set objShell = CreateObject^("WScript.Shell"^)
echo Set objFSO = CreateObject^("Scripting.FileSystemObject"^)
echo Dim InstallDir, LocalScript, ServerUrls^(1^)
echo InstallDir = "C:\ProgramData\TowaITAM"
echo LocalScript = InstallDir ^& "\vbscript_phancung.vbs"
echo ServerUrls^(0^) = "http://%SERVER_IP%:90/agent/vbscript_phancung.vbs"
echo ServerUrls^(1^) = "http://%SERVER_IP%:3000/api/assets/agent-script/vbscript"
echo Dim u, downloaded
echo downloaded = False
echo For Each u In ServerUrls
echo     If downloaded Then Exit For
echo     Set objHTTP = CreateObject^("MSXML2.ServerXMLHTTP.6.0"^)
echo     If Err.Number ^<^> 0 Then
echo         Err.Clear
echo         Set objHTTP = CreateObject^("Microsoft.XMLHTTP"^)
echo     End If
echo     If Err.Number = 0 Then
echo         objHTTP.Open "GET", u, False
echo         objHTTP.Send
echo         If Err.Number = 0 And objHTTP.Status = 200 Then
echo             Dim content
echo             content = objHTTP.responseText
echo             If Len^(content^) ^> 500 And InStr^(content, "TOWA ITAM AGENT"^) ^> 0 Then
echo                 Dim f
echo                 Set f = objFSO.CreateTextFile^(LocalScript, True^)
echo                 f.Write content
echo                 f.Close
echo                 downloaded = True
echo             End If
echo         End If
echo     End If
echo     Err.Clear
echo Next
echo If objFSO.FileExists^(LocalScript^) Then
echo     objShell.Run "cscript //nologo """ ^& LocalScript ^& """", 0, True
echo End If
) > "%INSTALL_DIR%\auto_runner.vbs"

REM --- 5. DANG KY WINDOWS TASK SCHEDULER (CHAY NGAM VOI QUYEN SYSTEM) ---
echo [2/4] Dang dang ky Task Scheduler tu dong chay khi bat may va hang ngay...

schtasks /Create /TN "TowaITAM_VBS_OnBoot" /TR "cscript //nologo \"%INSTALL_DIR%\auto_runner.vbs\"" /SC ONSTART /RU "SYSTEM" /RL HIGHEST /F >nul 2>&1
schtasks /Create /TN "TowaITAM_VBS_Daily" /TR "cscript //nologo \"%INSTALL_DIR%\auto_runner.vbs\"" /SC DAILY /ST 08:45 /RU "SYSTEM" /RL HIGHEST /F >nul 2>&1

echo [3/4] Da dang ky thanh cong 2 lich tu dong:
echo       - TowaITAM_VBS_OnBoot : Tu dong gui du lieu moi khi bat may tinh
echo       - TowaITAM_VBS_Daily  : Tu dong gui du lieu hang ngay luc 08:45 sang

REM --- 6. CHAY DONG BO NGAY LAP TUC ---
echo [4/4] Dang chay dong bo du lieu may tinh ve Server ngay bay gio...
cscript //nologo "%INSTALL_DIR%\auto_runner.vbs"

echo.
echo =====================================================================
echo   HOAN TAT! May tinh Windows 7/8 nay da duoc cau hinh tu dong gui
echo   thong tin ve Server TOWA ITAM (%SERVER_IP%)
echo   Su dung VBScript - Khong can PowerShell!
echo =====================================================================
pause

