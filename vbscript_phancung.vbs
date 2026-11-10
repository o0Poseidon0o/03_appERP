' =============================================================================
' TOWA ITAM AGENT - VBSCRIPT VERSION (KHONG CAN POWERSHELL)
' Danh cho: Windows XP, Windows 7, Windows 8 (Nhung HDH khong co/bi khoa PowerShell)
' Chuc nang: Thu thap thong tin phan cung, phan mem, mang, ban quyen va gui ve Server
' Ngon ngu: VBScript (chay tren moi Windows bang wscript.exe / cscript.exe)
' =============================================================================
Option Explicit

' --- 1. CAU HINH ---
Dim ServerIP, ServerPort, FallbackPort, AgentSecretKey
ServerIP       = "192.168.20.17"
ServerPort     = "3000"
FallbackPort   = "90"
AgentSecretKey = "@Towa2026!#Secure_Agent_998811_AbCdEf"

' --- 2. KHOI TAO BIEN ---
Dim objWMI, objShell, objFSO, objNetwork
Dim serialNumber, hostname, username, model, manufacturer
Dim osName, osVersion, cpuName, ramGB, ipAddress, macAddress
Dim deviceType, diskInfo, softwareInfo, monitorInfo, gpuInfo
Dim peripheralInfo, osLicenseStatus, osLicenseChannel, osLicenseKey
Dim officeLicenseName, officeLicenseStatus, officeLicenseChannel, officeLicenseKey
Dim softwareLicenses, hardwareAlerts
Dim ramDetails, ramTotalGB, ramFreeGB, ramUsedGB, ramUsagePct
Dim cpuLoad, cpuCores, cpuClockMHz, cpuTempC, cpuHealthStatus, cpuHealthText
Dim overallHealth, overallHealthText, diskHealthStatus, diskHealthText

Set objShell = CreateObject("WScript.Shell")
Set objFSO = CreateObject("Scripting.FileSystemObject")
Set objNetwork = CreateObject("WScript.Network")

hostname = objNetwork.ComputerName
username = objNetwork.UserDomain & "\" & objNetwork.UserName
deviceType = "PC"

' Khoi tao gia tri mac dinh
serialNumber = "N/A"
model = "Workstation"
manufacturer = "PC"
osName = "Windows"
osVersion = ""
cpuName = "Intel/AMD Processor"
ramGB = 0
ipAddress = "127.0.0.1"
macAddress = ""
diskInfo = "[]"
softwareInfo = "[]"
monitorInfo = "[]"
gpuInfo = "[]"
peripheralInfo = "[]"
softwareLicenses = "[]"
hardwareAlerts = "[]"
ramDetails = "[]"
cpuLoad = 0
cpuCores = 1
cpuClockMHz = 0
cpuTempC = -1
cpuHealthStatus = "GOOD"
cpuHealthText = "Tot (Hoat dong on dinh)"
overallHealth = "GOOD"
overallHealthText = "Phan cung hoat dong Tot"
diskHealthStatus = "GOOD"
diskHealthText = "Tot (S.M.A.R.T OK)"
osLicenseStatus = "UNLICENSED"
osLicenseChannel = "UNKNOWN"
osLicenseKey = ""
officeLicenseName = ""
officeLicenseStatus = ""
officeLicenseChannel = ""
officeLicenseKey = ""
ramTotalGB = 0
ramFreeGB = 0
ramUsedGB = 0
ramUsagePct = 50

WScript.Echo "--- KHOI DONG TOWA AGENT VBSCRIPT (WINDOWS 7/8) ---"

' --- 3. KET NOI WMI ---
Dim wmiOK
wmiOK = True
On Error Resume Next
Set objWMI = GetObject("winmgmts:\\.\root\cimv2")
If Err.Number <> 0 Then
    wmiOK = False
    Err.Clear
End If
On Error GoTo 0

' --- 4A. PHAN CUNG CO BAN (WMI) ---
If wmiOK Then
    WScript.Echo "[1/8] Quet he thong co ban (WMI)..."
    On Error Resume Next

    ' BIOS / Serial
    Dim colBIOS, objBIOS
    Set colBIOS = objWMI.ExecQuery("SELECT SerialNumber FROM Win32_BIOS")
    For Each objBIOS In colBIOS
        If Len(objBIOS.SerialNumber) > 0 Then serialNumber = Trim(objBIOS.SerialNumber)
    Next

    ' Computer System
    Dim colCS, objCS
    Set colCS = objWMI.ExecQuery("SELECT Model,Manufacturer,TotalPhysicalMemory,UserName FROM Win32_ComputerSystem")
    For Each objCS In colCS
        If Len(objCS.Model) > 0 Then model = Trim(objCS.Model)
        If Len(objCS.Manufacturer) > 0 Then manufacturer = Trim(objCS.Manufacturer)
        If objCS.TotalPhysicalMemory > 0 Then
            ramGB = Int(CDbl(objCS.TotalPhysicalMemory) / 1073741824 + 0.5)
            ramTotalGB = Round(CDbl(objCS.TotalPhysicalMemory) / 1073741824, 1)
        End If
        If Len(objCS.UserName) > 0 Then username = objCS.UserName
    Next

    ' OS
    Dim colOS, objOS
    Set colOS = objWMI.ExecQuery("SELECT Caption,Version,FreePhysicalMemory FROM Win32_OperatingSystem")
    For Each objOS In colOS
        If Len(objOS.Caption) > 0 Then osName = Trim(objOS.Caption)
        If Len(objOS.Version) > 0 Then osVersion = Trim(objOS.Version)
        If objOS.FreePhysicalMemory > 0 Then
            ramFreeGB = Round(CDbl(objOS.FreePhysicalMemory) * 1024 / 1073741824, 1)
        End If
    Next

    ' CPU
    Dim colCPU, objCPU
    Set colCPU = objWMI.ExecQuery("SELECT Name,NumberOfCores,NumberOfLogicalProcessors,MaxClockSpeed,LoadPercentage,Status FROM Win32_Processor")
    For Each objCPU In colCPU
        If Len(objCPU.Name) > 0 Then cpuName = Trim(objCPU.Name)
        If objCPU.NumberOfCores > 0 Then cpuCores = CInt(objCPU.NumberOfCores)
        If objCPU.MaxClockSpeed > 0 Then cpuClockMHz = CInt(objCPU.MaxClockSpeed)
        If objCPU.LoadPercentage >= 0 Then cpuLoad = CInt(objCPU.LoadPercentage)
        If Len(objCPU.Status) > 0 And objCPU.Status <> "OK" Then
            cpuHealthStatus = "CRITICAL"
            cpuHealthText = "Loi CPU (" & objCPU.Status & ")"
        End If
        Exit For
    Next

    On Error GoTo 0
End If

' --- 4B. FALLBACK REGISTRY (Neu WMI bi hong) ---
If manufacturer = "PC" Or Len(cpuName) = 0 Or cpuName = "Intel/AMD Processor" Then
    WScript.Echo "[1/8] Fallback: Doc tu Registry..."
    On Error Resume Next

    ' Hang may, Model, Serial tu Registry BIOS
    Dim regManuf, regModel, regSerial
    regManuf = objShell.RegRead("HKLM\HARDWARE\DESCRIPTION\System\BIOS\SystemManufacturer")
    If Err.Number = 0 And Len(regManuf) > 0 And InStr(LCase(regManuf), "default") = 0 Then
        manufacturer = regManuf
    End If
    Err.Clear

    regModel = objShell.RegRead("HKLM\HARDWARE\DESCRIPTION\System\BIOS\SystemProductName")
    If Err.Number = 0 And Len(regModel) > 0 And InStr(LCase(regModel), "default") = 0 Then
        model = regModel
    End If
    Err.Clear

    If serialNumber = "N/A" Then
        regSerial = objShell.RegRead("HKLM\HARDWARE\DESCRIPTION\System\BIOS\SystemSerialNumber")
        If Err.Number = 0 And Len(regSerial) > 0 And InStr(LCase(regSerial), "default") = 0 Then
            serialNumber = Trim(regSerial)
        End If
        Err.Clear
    End If

    ' CPU tu Registry
    If cpuName = "Intel/AMD Processor" Then
        Dim regCpuName
        regCpuName = objShell.RegRead("HKLM\HARDWARE\DESCRIPTION\System\CentralProcessor\0\ProcessorNameString")
        If Err.Number = 0 And Len(regCpuName) > 0 Then cpuName = Trim(regCpuName)
        Err.Clear
    End If

    ' OS tu Registry
    If osName = "Windows" Then
        Dim regOsName
        regOsName = objShell.RegRead("HKLM\SOFTWARE\Microsoft\Windows NT\CurrentVersion\ProductName")
        If Err.Number = 0 And Len(regOsName) > 0 Then osName = regOsName
        Err.Clear
    End If

    ' RAM fallback
    If ramGB = 0 Then
        Dim ramTotalKB
        ramTotalKB = objShell.RegRead("HKLM\HARDWARE\RESOURCEMAP\System Resources\Physical Memory\.Translated\0")
        Err.Clear
        ' Su dung systeminfo hoac wmic
        Dim execObj, execLine
        Set execObj = objShell.Exec("wmic ComputerSystem get TotalPhysicalMemory /format:list")
        Do While Not execObj.StdOut.AtEndOfStream
            execLine = Trim(execObj.StdOut.ReadLine)
            If Left(execLine, 20) = "TotalPhysicalMemory=" Then
                Dim ramBytes
                ramBytes = Mid(execLine, 21)
                If IsNumeric(ramBytes) And CDbl(ramBytes) > 0 Then
                    ramGB = Int(CDbl(ramBytes) / 1073741824 + 0.5)
                    ramTotalGB = Round(CDbl(ramBytes) / 1073741824, 1)
                End If
            End If
        Loop
        Err.Clear
    End If

    On Error GoTo 0
End If

' --- 5. MANG (IP & MAC) ---
WScript.Echo "[2/8] Quet mang..."
If wmiOK Then
    On Error Resume Next
    Dim colNic, objNic
    Set colNic = objWMI.ExecQuery("SELECT IPAddress,MACAddress,IPEnabled FROM Win32_NetworkAdapterConfiguration WHERE IPEnabled = True")
    For Each objNic In colNic
        If Not IsNull(objNic.IPAddress) Then
            Dim tmpIP
            tmpIP = objNic.IPAddress(0)
            If Len(tmpIP) > 0 And tmpIP <> "127.0.0.1" And Left(tmpIP, 8) <> "169.254." Then
                ipAddress = tmpIP
                macAddress = objNic.MACAddress
                Exit For
            End If
        End If
    Next
    On Error GoTo 0
End If

' Fallback: ipconfig
If ipAddress = "127.0.0.1" Then
    On Error Resume Next
    Dim execIp, ipLine
    Set execIp = objShell.Exec("ipconfig")
    Do While Not execIp.StdOut.AtEndOfStream
        ipLine = Trim(execIp.StdOut.ReadLine)
        If InStr(ipLine, "IPv4") > 0 Or InStr(ipLine, "IP Address") > 0 Then
            Dim parts, ip
            parts = Split(ipLine, ":")
            If UBound(parts) >= 1 Then
                ip = Trim(parts(UBound(parts)))
                If ip <> "127.0.0.1" And Left(ip, 8) <> "169.254." And Len(ip) > 6 Then
                    ipAddress = ip
                    Exit Do
                End If
            End If
        End If
    Loop
    On Error GoTo 0
End If

WScript.Echo "  -> IP: " & ipAddress

' --- 6. PHAN LOAI THIET BI ---
If InStr(LCase(osName), "server") > 0 Then
    deviceType = "SERVER"
ElseIf wmiOK Then
    On Error Resume Next
    Dim colChassis, objChassis
    Set colChassis = objWMI.ExecQuery("SELECT ChassisTypes FROM Win32_SystemEnclosure")
    For Each objChassis In colChassis
        If Not IsNull(objChassis.ChassisTypes) Then
            Dim ct
            For Each ct In objChassis.ChassisTypes
                If ct = 8 Or ct = 9 Or ct = 10 Or ct = 14 Then
                    deviceType = "LAPTOP"
                    Exit For
                End If
            Next
        End If
    Next
    On Error GoTo 0
End If

' --- 7. RAM CHI TIET ---
WScript.Echo "[3/8] Quet RAM..."
Dim ramDetailsArr()
Dim ramSlotCount
ramSlotCount = 0

If wmiOK Then
    On Error Resume Next
    Dim colMem, objMem
    Set colMem = objWMI.ExecQuery("SELECT BankLabel,Capacity,Speed,Manufacturer FROM Win32_PhysicalMemory")
    For Each objMem In colMem
        ReDim Preserve ramDetailsArr(ramSlotCount)
        Dim capGB
        capGB = 0
        If objMem.Capacity > 0 Then capGB = Int(CDbl(objMem.Capacity) / 1073741824 + 0.5)
        Dim spd
        spd = "Unknown"
        If objMem.Speed > 0 Then spd = CStr(objMem.Speed)
        ramDetailsArr(ramSlotCount) = "{""Slot"":""" & EscJson(CStr(objMem.BankLabel)) & """,""Capacity"":""" & capGB & "GB"",""Speed"":""" & spd & "MHz"",""Manufacturer"":""" & EscJson(CStr(objMem.Manufacturer)) & """}"
        ramSlotCount = ramSlotCount + 1
    Next
    On Error GoTo 0
End If

If ramSlotCount = 0 And ramGB > 0 Then
    ReDim ramDetailsArr(0)
    ramDetailsArr(0) = "{""Slot"":""Slot 1"",""Capacity"":""" & ramGB & "GB"",""Speed"":""Standard"",""Manufacturer"":""System RAM""}"
    ramSlotCount = 1
End If

If ramSlotCount > 0 Then
    ramDetails = "[" & Join(ramDetailsArr, ",") & "]"
Else
    ramDetails = "[]"
End If

' Suc khoe RAM
ramUsedGB = Round(ramTotalGB - ramFreeGB, 1)
If ramUsedGB < 0 Then ramUsedGB = 0
If ramTotalGB > 0 Then
    ramUsagePct = Int((ramUsedGB / ramTotalGB) * 100)
End If

Dim ramHealthStatus, ramHealthText
ramHealthStatus = "GOOD"
ramHealthText = "Tot (Con trong " & ramFreeGB & " GB)"
If ramUsagePct >= 95 Then
    ramHealthStatus = "WARNING"
    ramHealthText = "Day RAM (" & ramUsagePct & "% - Can nang cap)"
ElseIf ramUsagePct >= 85 Or ramTotalGB < 4 Then
    ramHealthStatus = "WARNING"
    ramHealthText = "Su dung cao (" & ramUsagePct & "%)"
End If

WScript.Echo "  -> RAM: " & ramGB & " GB"

' --- 8. GPU ---
WScript.Echo "[4/8] Quet GPU..."
Dim gpuArr()
Dim gpuCount
gpuCount = 0

If wmiOK Then
    On Error Resume Next
    Dim colGPU, objGPU
    Set colGPU = objWMI.ExecQuery("SELECT Name,AdapterRAM,DriverVersion FROM Win32_VideoController")
    For Each objGPU In colGPU
        ReDim Preserve gpuArr(gpuCount)
        Dim vram
        vram = "N/A"
        If objGPU.AdapterRAM > 0 Then vram = CStr(Round(CDbl(objGPU.AdapterRAM) / 1073741824, 1)) & " GB"
        gpuArr(gpuCount) = "{""Name"":""" & EscJson(CStr(objGPU.Name)) & """,""VRAM"":""" & vram & """,""DriverVersion"":""" & EscJson(CStr(objGPU.DriverVersion)) & """}"
        gpuCount = gpuCount + 1
    Next
    On Error GoTo 0
End If

If gpuCount > 0 Then
    gpuInfo = "[" & Join(gpuArr, ",") & "]"
Else
    gpuInfo = "[]"
End If

' --- 9. O CUNG ---
WScript.Echo "[6/8] Quet o cung..."
Dim diskArr()
Dim diskCount, anyDiskCritical, anyDiskWarning
diskCount = 0
anyDiskCritical = False
anyDiskWarning = False

If wmiOK Then
    On Error Resume Next
    Dim colDisk, objDisk
    Set colDisk = objWMI.ExecQuery("SELECT * FROM Win32_DiskDrive")
    For Each objDisk In colDisk
        ReDim Preserve diskArr(diskCount)
        Dim dSizeGB, dMediaType, dHealth, dHealthText
        dSizeGB = 0
        If objDisk.Size > 0 Then dSizeGB = Int(CDbl(objDisk.Size) / 1073741824)
        dMediaType = "HDD"
        If InStr(LCase(CStr(objDisk.Model)), "ssd") > 0 Or InStr(LCase(CStr(objDisk.Model)), "nvme") > 0 Or InStr(LCase(CStr(objDisk.Model)), "solid") > 0 Then
            dMediaType = "SSD"
        End If
        dHealth = "GOOD"
        dHealthText = "Tot (S.M.A.R.T OK)"
        Dim dStatus
        dStatus = CStr(objDisk.Status)
        If InStr(LCase(dStatus), "fail") > 0 Or InStr(LCase(dStatus), "error") > 0 Or InStr(LCase(dStatus), "pred") > 0 Then
            dHealth = "CRITICAL"
            dHealthText = "NGUY HIEM: Sap hong (" & dStatus & ")"
            anyDiskCritical = True
        ElseIf dStatus <> "OK" And Len(dStatus) > 0 Then
            dHealth = "WARNING"
            dHealthText = "Canh bao (" & dStatus & ")"
            anyDiskWarning = True
        End If
        Dim dSerial
        dSerial = Trim(CStr(objDisk.SerialNumber))
        If Len(dSerial) = 0 Then dSerial = "N/A"
        diskArr(diskCount) = "{""Index"":" & CInt(objDisk.Index) & ",""Model"":""" & EscJson(CStr(objDisk.Model)) & """,""MediaType"":""" & dMediaType & """,""SizeGB"":" & dSizeGB & ",""Interface"":""" & EscJson(CStr(objDisk.InterfaceType)) & """,""SerialNumber"":""" & EscJson(dSerial) & """,""HealthStatus"":""" & dHealth & """,""HealthText"":""" & EscJson(dHealthText) & """}"
        diskCount = diskCount + 1
    Next
    On Error GoTo 0
End If

If diskCount > 0 Then
    diskInfo = "[" & Join(diskArr, ",") & "]"
Else
    diskInfo = "[]"
End If

If anyDiskCritical Then
    diskHealthStatus = "CRITICAL"
    diskHealthText = "Nguy co hong o cung (S.M.A.R.T)"
ElseIf anyDiskWarning Then
    diskHealthStatus = "WARNING"
    diskHealthText = "Can don dep dung luong"
End If

' Overall health
If anyDiskCritical Or cpuHealthStatus = "CRITICAL" Then
    overallHealth = "CRITICAL"
    overallHealthText = "NGUY HIEM: Co loi phan cung!"
ElseIf anyDiskWarning Or ramHealthStatus = "WARNING" Or cpuHealthStatus = "WARNING" Then
    overallHealth = "WARNING"
    overallHealthText = "Can chu y (Day o dia / Tai RAM cao)"
End If

WScript.Echo "[5/8] Quet phan mem..."
Dim swArr()
Dim swCount, swSeen
swCount = 0
Set swSeen = CreateObject("Scripting.Dictionary")

Const HKCU_H = &H80000001
Const HKLM_H = &H80000002
Dim objReg, swIdx, swHive, swPath, arrSubKeys, swSubKey
Dim swName, swVer, swPub, swSysComp, swFullPath
On Error Resume Next
Set objReg = GetObject("winmgmts:\\.\root\default:StdRegProv")
If Err.Number = 0 Then
    For swIdx = 0 To 2
        If swIdx = 0 Then
            swHive = HKLM_H
            swPath = "SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall"
        ElseIf swIdx = 1 Then
            swHive = HKLM_H
            swPath = "SOFTWARE\Wow6432Node\Microsoft\Windows\CurrentVersion\Uninstall"
        Else
            swHive = HKCU_H
            swPath = "SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall"
        End If

        arrSubKeys = Null
        objReg.EnumKey swHive, swPath, arrSubKeys
        If Not IsNull(arrSubKeys) Then
            For Each swSubKey In arrSubKeys
                swFullPath = swPath & "\" & swSubKey
                swName = "": swVer = "": swPub = "": swSysComp = 0
                objReg.GetStringValue swHive, swFullPath, "DisplayName", swName
                objReg.GetStringValue swHive, swFullPath, "DisplayVersion", swVer
                objReg.GetStringValue swHive, swFullPath, "Publisher", swPub
                objReg.GetDWORDValue swHive, swFullPath, "SystemComponent", swSysComp
                If IsNull(swName) Then swName = ""
                If IsNull(swVer) Then swVer = ""
                If IsNull(swPub) Then swPub = ""
                If IsNull(swSysComp) Then swSysComp = 0
                swName = Trim(swName)
                If Len(swName) > 2 And swSysComp <> 1 Then
                    If Not IsExcludedSoftware(swName) Then
                        If Not swSeen.Exists(UCase(swName)) Then
                            swSeen.Add UCase(swName), True
                            ReDim Preserve swArr(swCount)
                            swArr(swCount) = "{""Name"":""" & EscJson(swName) & """,""Version"":""" & EscJson(swVer) & """,""Publisher"":""" & EscJson(swPub) & """}"
                            swCount = swCount + 1
                        End If
                    End If
                End If
            Next
        End If
    Next
End If
Err.Clear
On Error GoTo 0

If swCount > 0 Then
    softwareInfo = "[" & Join(swArr, ",") & "]"
Else
    softwareInfo = "[]"
End If

WScript.Echo "  -> " & swCount & " phan mem da cai"

' --- 11. MAN HINH ---
WScript.Echo "[7/8] Quet man hinh..."
If wmiOK Then
    On Error Resume Next
    Dim colMon, objMon, monArr(), monCount
    monCount = 0
    Set colMon = objWMI.ExecQuery("SELECT * FROM Win32_DesktopMonitor")
    For Each objMon In colMon
        If Len(objMon.Name) > 0 And objMon.Name <> "Default Monitor" Then
            ReDim Preserve monArr(monCount)
            monArr(monCount) = "{""Manufacturer"":""" & EscJson(CStr(objMon.MonitorManufacturer)) & """,""Model"":""" & EscJson(CStr(objMon.Name)) & """,""SerialNumber"":""N/A"",""ScreenSize"":""N/A"",""Source"":""WMI""}"
            monCount = monCount + 1
        End If
    Next
    If monCount > 0 Then
        monitorInfo = "[" & Join(monArr, ",") & "]"
    End If
    On Error GoTo 0
End If

' --- 12. BAN QUYEN WINDOWS & OFFICE ---
WScript.Echo "[8/8] Quet ban quyen..."
If wmiOK Then
    On Error Resume Next
    Dim colSLS, objSLS
    Set colSLS = objWMI.ExecQuery("SELECT OA3xOriginalProductKey FROM SoftwareLicensingService")
    For Each objSLS In colSLS
        If Len(objSLS.OA3xOriginalProductKey) > 0 Then
            osLicenseKey = Trim(objSLS.OA3xOriginalProductKey)
        End If
    Next

    Dim colLic, objLic, licArr(), licCount
    licCount = 0
    Set colLic = objWMI.ExecQuery("SELECT Name,Description,LicenseStatus,PartialProductKey,ApplicationId FROM SoftwareLicensingProduct WHERE PartialProductKey IS NOT NULL")
    For Each objLic In colLic
        If Len(objLic.Name) > 0 Then
            Dim licStatus, licStatusText, licChannel, licKey
            If objLic.LicenseStatus = 1 Then
                licStatus = "LICENSED"
                licStatusText = "Da kich hoat (Licensed)"
            ElseIf objLic.LicenseStatus = 2 Or objLic.LicenseStatus = 3 Then
                licStatus = "UNLICENSED"
                licStatusText = "Dung thu (Grace/Trial)"
            Else
                licStatus = "UNLICENSED"
                licStatusText = "Chua kich hoat (Unlicensed)"
            End If

            licChannel = "RETAIL"
            If InStr(objLic.Description, "OEM") > 0 Then
                licChannel = "OEM"
            ElseIf InStr(objLic.Description, "KMS") > 0 Or InStr(objLic.Description, "VOLUME_KMSCLIENT") > 0 Then
                licChannel = "VOLUME_KMS"
            ElseIf InStr(objLic.Description, "MAK") > 0 Then
                licChannel = "VOLUME_MAK"
            End If

            licKey = ""
            If Len(objLic.PartialProductKey) > 0 Then licKey = Trim(objLic.PartialProductKey)

            ' Windows license
            If InStr(objLic.Name, "Windows") > 0 Or CStr(objLic.ApplicationId) = "55c92734-d682-4d71-983e-d6ec3f16059f" Then
                If osLicenseStatus <> "LICENSED" Or licStatus = "LICENSED" Then
                    osLicenseStatus = licStatus
                    osLicenseChannel = licChannel
                    If Len(licKey) > 0 Then osLicenseKey = "*****-" & licKey
                End If
            End If

            ' Office license
            If InStr(objLic.Name, "Office") > 0 Or InStr(objLic.Name, "Visio") > 0 Or InStr(objLic.Name, "Project") > 0 Then
                If Len(officeLicenseName) = 0 Or licStatus = "LICENSED" Then
                    officeLicenseName = CStr(objLic.Name)
                    officeLicenseStatus = licStatus
                    officeLicenseChannel = licChannel
                    If Len(licKey) > 0 Then officeLicenseKey = "*****-" & licKey
                End If
            End If

            ReDim Preserve licArr(licCount)
            Dim pkDisplay
            pkDisplay = ""
            If Len(licKey) > 0 Then pkDisplay = "*****-" & licKey
            licArr(licCount) = "{""softwareName"":""" & EscJson(CStr(objLic.Name)) & """,""status"":""" & licStatus & """,""statusText"":""" & licStatusText & """,""channel"":""" & licChannel & """,""partialKey"":""" & pkDisplay & """,""source"":""WMI_SPP""}"
            licCount = licCount + 1
        End If
    Next

    If licCount > 0 Then
        softwareLicenses = "[" & Join(licArr, ",") & "]"
    End If

    On Error GoTo 0
End If

WScript.Echo "  -> OS: " & osLicenseStatus

' --- 13. TAO JSON PAYLOAD ---
WScript.Echo ""
WScript.Echo ">>> DANG GUI DU LIEU VE SERVER..."

Dim officeLicenseJson
If Len(officeLicenseName) > 0 Then
    officeLicenseJson = "{""productName"":""" & EscJson(officeLicenseName) & """,""status"":""" & officeLicenseStatus & """,""channel"":""" & officeLicenseChannel & """,""partialKey"":""" & officeLicenseKey & """}"
Else
    officeLicenseJson = "null"
End If

Dim hardwareHealthJson
hardwareHealthJson = "{""overallStatus"":""" & overallHealth & """,""overallText"":""" & overallHealthText & """,""cpu"":{""status"":""" & cpuHealthStatus & """,""statusText"":""" & cpuHealthText & """,""loadPercent"":" & cpuLoad & ",""cores"":" & cpuCores & ",""threads"":" & cpuCores & ",""clockSpeedMHz"":" & cpuClockMHz & ",""temperatureC"":" & cpuTempC & "},""ram"":{""status"":""" & ramHealthStatus & """,""statusText"":""" & ramHealthText & """,""totalGB"":" & Num(ramTotalGB) & ",""usedGB"":" & Num(ramUsedGB) & ",""freeGB"":" & Num(ramFreeGB) & ",""usagePercent"":" & ramUsagePct & ",""slotsUsed"":" & ramSlotCount & "},""diskStatus"":""" & diskHealthStatus & """,""diskText"":""" & diskHealthText & """,""logicalVolumes"":[],""alerts"":" & hardwareAlerts & ",""checkedAt"":""" & FormatDateTime_ISO() & """}"

Dim jsonPayload
jsonPayload = "{" & _
    """serialNumber"":""" & EscJson(serialNumber) & """," & _
    """hostname"":""" & EscJson(hostname) & """," & _
    """username"":""" & EscJson(username) & """," & _
    """model"":""" & EscJson(model) & """," & _
    """manufacturer"":""" & EscJson(manufacturer) & """," & _
    """osName"":""" & EscJson(osName) & """," & _
    """osVersion"":""" & EscJson(osVersion) & """," & _
    """cpuName"":""" & EscJson(cpuName) & """," & _
    """ramGB"":" & ramGB & "," & _
    """ramDetails"":" & ramDetails & "," & _
    """gpus"":" & gpuInfo & "," & _
    """peripherals"":" & peripheralInfo & "," & _
    """osLicense"":{""productName"":""" & EscJson(osName) & """,""status"":""" & osLicenseStatus & """,""channel"":""" & osLicenseChannel & """,""partialKey"":""" & osLicenseKey & """,""oemKey"":""""}," & _
    """officeLicense"":" & officeLicenseJson & "," & _
    """softwareLicenses"":" & softwareLicenses & "," & _
    """hardwareHealth"":" & hardwareHealthJson & "," & _
    """disks"":" & diskInfo & "," & _
    """monitors"":" & monitorInfo & "," & _
    """software"":" & softwareInfo & "," & _
    """ipAddress"":""" & ipAddress & """," & _
    """macAddress"":""" & EscJson(macAddress) & """," & _
    """deviceType"":""" & deviceType & """," & _
    """timestamp"":""" & FormatDateTime_ISO() & """" & _
"}"

' --- 14. GUI DU LIEU VE SERVER ---
Dim apiUrls(2), success, lastErr, i
apiUrls(0) = "http://" & ServerIP & ":" & ServerPort & "/api/assets/sync"
apiUrls(1) = "http://" & ServerIP & ":" & FallbackPort & "/api/assets/sync"
success = False
lastErr = ""

Dim retryCount
For retryCount = 1 To 3
    For i = 0 To 1
        If success Then Exit For
        On Error Resume Next
        Dim xmlHttp
        Set xmlHttp = CreateObject("MSXML2.ServerXMLHTTP.6.0")
        If Err.Number <> 0 Then
            Err.Clear
            Set xmlHttp = CreateObject("MSXML2.XMLHTTP.6.0")
            If Err.Number <> 0 Then
                Err.Clear
                Set xmlHttp = CreateObject("Microsoft.XMLHTTP")
            End If
        End If

        If Err.Number = 0 Then
            xmlHttp.Open "POST", apiUrls(i), False
            xmlHttp.setRequestHeader "Content-Type", "application/json; charset=utf-8"
            xmlHttp.setRequestHeader "X-Agent-Secret-Key", AgentSecretKey
            xmlHttp.setRequestHeader "x-api-key", AgentSecretKey
            xmlHttp.setTimeouts 5000, 10000, 10000, 30000
            xmlHttp.Send jsonPayload

            If Err.Number = 0 And (xmlHttp.Status >= 200 And xmlHttp.Status < 300) Then
                WScript.Echo " SUCCESS: Dong bo thanh cong (" & hostname & " -> " & apiUrls(i) & ")!"
                success = True
            Else
                lastErr = "HTTP " & xmlHttp.Status & " - " & xmlHttp.statusText
                If Err.Number <> 0 Then lastErr = Err.Description
            End If
        Else
            lastErr = "Khong the tao XMLHTTP Object"
        End If
        Err.Clear
        On Error GoTo 0
        Set xmlHttp = Nothing
    Next

    If success Then Exit For
    WScript.Echo " FAILED (" & retryCount & "/3): " & lastErr
    If retryCount < 3 Then WScript.Sleep 5000 * retryCount
Next

If Not success Then
    WScript.Echo ""
    WScript.Echo "LOI: Khong gui duoc du lieu sau 3 lan thu. Loi cuoi: " & lastErr
End If

WScript.Echo ""
WScript.Echo "HOAN TAT!"


' ===========================================================================
' HAM HO TRO
' ===========================================================================
' Doi so thap phan sang dang JSON (dau cham) - tranh loi dau phay tren Windows tieng Viet
Function Num(n)
    Num = Replace(CStr(n), ",", ".")
End Function

Function EscJson(s)
    If IsNull(s) Or IsEmpty(s) Then
        EscJson = ""
        Exit Function
    End If
    Dim result
    result = CStr(s)
    result = Replace(result, "\", "\\")
    result = Replace(result, """", "\""")
    result = Replace(result, vbCr, "\r")
    result = Replace(result, vbLf, "\n")
    result = Replace(result, vbTab, "\t")
    ' Ky tu ngoai ASCII (tieng Viet, (R), (TM)...) -> \uXXXX de JSON luon hop le
    Dim ci, ch, code, outStr
    outStr = ""
    For ci = 1 To Len(result)
        ch = Mid(result, ci, 1)
        code = AscW(ch) And 65535
        If code < 32 Then
            outStr = outStr & " "
        ElseIf code > 126 Then
            outStr = outStr & "\u" & Right("0000" & Hex(code), 4)
        Else
            outStr = outStr & ch
        End If
    Next
    EscJson = outStr
End Function

Function FormatDateTime_ISO()
    Dim d
    d = Now
    FormatDateTime_ISO = Year(d) & "-" & Right("0" & Month(d), 2) & "-" & Right("0" & Day(d), 2) & " " & Right("0" & Hour(d), 2) & ":" & Right("0" & Minute(d), 2) & ":" & Right("0" & Second(d), 2)
End Function

Function IsExcludedSoftware(name)
    Dim excludeList
    excludeList = Array("Click-to-Run", "MUI", "Proofing", "Localization", "Extensibility", _
        "Licensing Component", "Setup Metadata", "Tools for Office", "Primary Interop", _
        "Database Engine", "Shared 64-bit", "Shared 32-bit", "Redistributable", _
        "Edge Update", "WebView2", "Google Update", "Auto Updater", "Update Helper", _
        "Language Pack", "Material Library", "Content Pack", "Documentation", _
        "Core Interpreter", "Development Libraries", "Executables", "pip Bootstrap", _
        "Standard Library", "Tcl/Tk", "Test Suite", "Utility Scripts", "Python Launcher", _
        "SDK", "CefSharp", "Genuine Service", "Bonjour", "Hotfix", _
        "Security Update", "Service Pack", "Driver", "Add-in", _
        "Meeting Add-in", "Teams Meeting", "Connector", "Helper", _
        "Host", "Telemetry", "Diagnostic", "C++ 20")
    Dim ex
    For Each ex In excludeList
        If InStr(name, ex) > 0 Then
            IsExcludedSoftware = True
            Exit Function
        End If
    Next
    IsExcludedSoftware = False
End Function

