@echo off
chcp 65001 >nul
REM =============================================================================
REM CONG CU 1-CLICK KHOI PHUC VA SUA LOI WMI (WINDOWS MANAGEMENT INSTRUMENTATION)
REM Khac phuc triet de loi: Get-WmiObject : Invalid class "Win32_..."
REM Ap dung cho: Windows 7, Windows 8, Windows 10, Windows 11, Windows Server
REM =============================================================================

echo =====================================================================
echo    DANG KIEM TRA VA KHOI PHUC DICH VU WMI WINDOWS (FIX INVALID CLASS)
echo =====================================================================

REM --- 1. KIEM TRA VA YEU CAU QUYEN ADMINISTRATOR ---
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo [!] Dang yeu cau quyen Administrator de sua he thong WMI...
    powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "Start-Process -FilePath '%~f0' -Verb RunAs"
    exit /b
)

echo [1/5] Dang dung cac dich vu lien quan den WMI...
net stop iphlpsvc /y >nul 2>&1
net stop wscsvc /y >nul 2>&1
net stop SharedAccess /y >nul 2>&1
net stop winmgmt /y >nul 2>&1

echo [2/5] Dang kiem tra va khoi phuc kho WMI Repository...
winmgmt /salvagerepository
winmgmt /verifyrepository
winmgmt /resetrepository

echo [3/5] Dang dang ky lai toan bo DLL cua WMI...
for /f "tokens=*" %%s in ('dir /b /s %windir%\system32\wbem\*.dll 2^>nul') do (
    regsvr32 /s "%%s"
)

echo [4/5] Dang bien dich lai toan bo MOF va MFL vao he thong...
for /f "tokens=*" %%s in ('dir /b /s %windir%\system32\wbem\*.mof 2^>nul') do (
    mofcomp "%%s" >nul 2>&1
)
for /f "tokens=*" %%s in ('dir /b /s %windir%\system32\wbem\*.mfl 2^>nul') do (
    mofcomp "%%s" >nul 2>&1
)

echo [5/5] Dang khoi dong lai dich vu WMI...
net start winmgmt
net start iphlpsvc >nul 2>&1

echo.
echo =====================================================================
echo  DA SUA WMI XONG! Dang kiem tra lai lenh Get-WmiObject Win32_BIOS...
powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "try { $b = Get-WmiObject Win32_BIOS; Write-Host '[THANH CONG] WMI da hoat dong binh thuong: Serial=' $b.SerialNumber -ForegroundColor Green } catch { Write-Host '[CANH BAO] ' $_.Exception.Message -ForegroundColor Yellow }"
echo =====================================================================
echo.
echo Ban co the chay lai script ITAM ngay bay gio.
pause

