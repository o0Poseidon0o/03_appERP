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

' --- 7. RAM CHI TIET, LOAI DDR (DDR3/DDR4/DDR5) & DUNG LUONG CHINH XAC ---
WScript.Echo "[3/8] Quet RAM (Dung luong & DDR Generation)..."
Dim ramDetailsArr()
Dim ramSlotCount, sumStickBytes, detectedRamType
ramSlotCount = 0
sumStickBytes = 0
detectedRamType = ""

If wmiOK Then
    On Error Resume Next
    Dim colMem, objMem
    Set colMem = objWMI.ExecQuery("SELECT * FROM Win32_PhysicalMemory")
    For Each objMem In colMem
        Dim capBytes, capStr
        capBytes = 0
        If objMem.Capacity > 0 Then capBytes = CDbl(objMem.Capacity)
        If capBytes > 0 Then
            sumStickBytes = sumStickBytes + capBytes
            If capBytes >= 1073741824 Then
                capStr = CStr(Int(capBytes / 1073741824 + 0.5)) & "GB"
            Else
                capStr = CStr(Int(capBytes / 1048576 + 0.5)) & "MB"
            End If

            Dim partNum, rawMfg, mfgDisplay
            partNum = Trim(S(objMem.PartNumber))
            If LCase(partNum) = "unknown" Or LCase(partNum) = "none" Or partNum = "00000000" Or LCase(partNum) = "array" Then partNum = ""
            rawMfg = Trim(S(objMem.Manufacturer))
            mfgDisplay = ResolveRamMfg(rawMfg, partNum)

            Dim rawSpd, smbiosT, memT, ddrStr, speedDisplay
            rawSpd = 0
            smbiosT = 0
            memT = 0
            Err.Clear
            If objMem.ConfiguredClockSpeed > 0 Then rawSpd = CInt(objMem.ConfiguredClockSpeed)
            Err.Clear
            If rawSpd <= 0 And objMem.Speed > 0 Then rawSpd = CInt(objMem.Speed)
            Err.Clear
            If objMem.SMBIOSMemoryType > 0 Then smbiosT = CInt(objMem.SMBIOSMemoryType)
            Err.Clear
            If objMem.MemoryType > 0 Then memT = CInt(objMem.MemoryType)
            Err.Clear

            ddrStr = ResolveRamType(smbiosT, memT, rawSpd, partNum, cpuName)

            ' Chuan hoa xung nhip neu BIOS tra ve Half-Rate I/O Clock
            If InStr(ddrStr, "DDR3") > 0 And (rawSpd = 533 Or rawSpd = 667 Or rawSpd = 933) Then
                rawSpd = rawSpd * 2
                If rawSpd = 1334 Then rawSpd = 1333
            ElseIf InStr(ddrStr, "DDR4") > 0 And rawSpd >= 933 And rawSpd <= 1800 Then
                rawSpd = rawSpd * 2
                If rawSpd = 2132 Or rawSpd = 2134 Then rawSpd = 2133
                If rawSpd = 2668 Then rawSpd = 2666
                If rawSpd = 2932 Or rawSpd = 2934 Then rawSpd = 2933
            ElseIf InStr(ddrStr, "DDR5") > 0 And rawSpd >= 2000 And rawSpd <= 3600 Then
                rawSpd = rawSpd * 2
            End If

            If Len(detectedRamType) = 0 And Len(ddrStr) > 0 Then detectedRamType = ddrStr
            If rawSpd > 0 Then
                speedDisplay = ddrStr & " " & rawSpd & "MHz"
            Else
                speedDisplay = ddrStr
            End If

            Dim devLoc, bankLbl, slotName
            devLoc = Trim(S(objMem.DeviceLocator))
            bankLbl = Trim(S(objMem.BankLabel))
            If Len(devLoc) > 0 And LCase(devLoc) <> "unknown" And LCase(devLoc) <> "none" Then
                slotName = devLoc
            ElseIf Len(bankLbl) > 0 Then
                slotName = bankLbl
            Else
                slotName = "#" & (ramSlotCount + 1)
            End If
            If LCase(Left(slotName, 5)) = "slot " Then slotName = Trim(Mid(slotName, 6))

            ReDim Preserve ramDetailsArr(ramSlotCount)
            ramDetailsArr(ramSlotCount) = "{""Slot"":""" & EscJson(slotName) & """,""Capacity"":""" & capStr & """,""Type"":""" & EscJson(ddrStr) & """,""Speed"":""" & EscJson(speedDisplay) & """,""Manufacturer"":""" & EscJson(mfgDisplay) & """,""PartNumber"":""" & EscJson(partNum) & """}"
            ramSlotCount = ramSlotCount + 1
        End If
    Next
    On Error GoTo 0
End If

' Tinh tong dung luong RAM vat ly chinh xac (uu tien tong cac thanh RAM vat ly de khong bi hut do iGPU share RAM)
If sumStickBytes > 0 Then
    ramGB = Int(sumStickBytes / 1073741824 + 0.5)
End If
If ramTotalGB > 0 Then
    If ramGB <= 0 Or ramTotalGB > (ramGB + 0.8) Then
        If ramTotalGB > 2.8 And ramTotalGB <= 4.1 Then
            ramGB = 4
        ElseIf ramTotalGB > 5.1 And ramTotalGB <= 6.1 Then
            ramGB = 6
        ElseIf ramTotalGB > 6.5 And ramTotalGB <= 8.2 Then
            ramGB = 8
        ElseIf ramTotalGB > 10.5 And ramTotalGB <= 12.2 Then
            ramGB = 12
        ElseIf ramTotalGB > 13.8 And ramTotalGB <= 16.5 Then
            ramGB = 16
        ElseIf ramTotalGB > 22.0 And ramTotalGB <= 24.5 Then
            ramGB = 24
        ElseIf ramTotalGB > 28.0 And ramTotalGB <= 32.5 Then
            ramGB = 32
        ElseIf ramTotalGB > 60.0 And ramTotalGB <= 64.5 Then
            ramGB = 64
        Else
            ramGB = Int(ramTotalGB + 0.5)
        End If
    End If
End If

If Len(detectedRamType) = 0 Then
    detectedRamType = ResolveRamType(0, 0, 0, "", cpuName)
End If

If ramSlotCount = 0 And ramGB > 0 Then
    ReDim ramDetailsArr(0)
    ramDetailsArr(0) = "{""Slot"":""1"",""Capacity"":""" & ramGB & "GB"",""Type"":""" & EscJson(detectedRamType) & """,""Speed"":""" & EscJson(detectedRamType) & """,""Manufacturer"":""System RAM"",""PartNumber"":""""}"
    ramSlotCount = 1
End If

If ramSlotCount > 0 Then
    ramDetails = "[" & JoinJson(ramDetailsArr) & "]"
Else
    ramDetails = "[]"
End If

' Suc khoe RAM
If ramTotalGB <= 0 And ramGB > 0 Then ramTotalGB = CDbl(ramGB)
ramUsedGB = Round(ramTotalGB - ramFreeGB, 1)
If ramUsedGB < 0 Then ramUsedGB = 0
If ramTotalGB > 0 Then
    ramUsagePct = Int((ramUsedGB / ramTotalGB) * 100)
End If

Dim ramHealthStatus, ramHealthText
ramHealthStatus = "GOOD"
ramHealthText = "Tot (Con trong " & Num(ramFreeGB) & " GB)"
If ramUsagePct >= 95 Then
    ramHealthStatus = "WARNING"
    ramHealthText = "Day RAM (" & ramUsagePct & "% - Can nang cap)"
ElseIf ramUsagePct >= 85 Or ramGB < 4 Then
    ramHealthStatus = "WARNING"
    ramHealthText = "Su dung cao (" & ramUsagePct & "%)"
End If

WScript.Echo "  -> RAM: " & ramGB & " GB " & detectedRamType

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
        gpuArr(gpuCount) = "{""Name"":""" & EscJson(S(objGPU.Name)) & """,""VRAM"":""" & vram & """,""DriverVersion"":""" & EscJson(S(objGPU.DriverVersion)) & """}"
        gpuCount = gpuCount + 1
    Next
    On Error GoTo 0
End If

If gpuCount > 0 Then
    gpuInfo = "[" & JoinJson(gpuArr) & "]"
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
        If InStr(LCase(S(objDisk.Model)), "ssd") > 0 Or InStr(LCase(S(objDisk.Model)), "nvme") > 0 Or InStr(LCase(S(objDisk.Model)), "solid") > 0 Then
            dMediaType = "SSD"
        End If
        dHealth = "GOOD"
        dHealthText = "Tot (S.M.A.R.T OK)"
        Dim dStatus
        dStatus = S(objDisk.Status)
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
        dSerial = Trim(S(objDisk.SerialNumber))
        If Len(dSerial) = 0 Then dSerial = "N/A"
        diskArr(diskCount) = "{""Index"":" & CInt(objDisk.Index) & ",""Model"":""" & EscJson(S(objDisk.Model)) & """,""MediaType"":""" & dMediaType & """,""SizeGB"":" & dSizeGB & ",""Interface"":""" & EscJson(S(objDisk.InterfaceType)) & """,""SerialNumber"":""" & EscJson(dSerial) & """,""HealthStatus"":""" & dHealth & """,""HealthText"":""" & EscJson(dHealthText) & """}"
        diskCount = diskCount + 1
    Next
    On Error GoTo 0
End If

If diskCount > 0 Then
    diskInfo = "[" & JoinJson(diskArr) & "]"
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

' --- 9B. KIEM TRA PIN LAPTOP (TUOI THO PIN, DO CHAI & SO LAN SAC) ---
Dim batteryHealthJson, batStatus, batStatusText
batteryHealthJson = "null"
batStatus = "GOOD"
batStatusText = ""

If wmiOK Then
    On Error Resume Next
    Dim colBat, objBat, hasBat
    hasBat = False
    Dim batName, batChargePct, batIsCharging
    batName = "Laptop Battery"
    batChargePct = -1
    batIsCharging = False

    Set colBat = objWMI.ExecQuery("SELECT * FROM Win32_Battery")
    For Each objBat In colBat
        hasBat = True
        If Len(S(objBat.Name)) > 0 Then batName = Trim(S(objBat.Name))
        If Not IsNull(objBat.EstimatedChargeRemaining) Then batChargePct = CInt(objBat.EstimatedChargeRemaining)
        If Not IsNull(objBat.BatteryStatus) Then
            Dim bs
            bs = CInt(objBat.BatteryStatus)
            If bs = 2 Or bs = 6 Or bs = 7 Or bs = 8 Or bs = 9 Then batIsCharging = True
        End If
        Exit For
    Next

    If hasBat Then
        If deviceType = "PC" Then deviceType = "LAPTOP"
        Dim objRootWMI, colBatStatic, objBatStatic, colBatFull, objBatFull, colBatCycle, objBatCycle
        Dim batDesignCap, batFullCap, batCycleCount, batMfg, batSerial
        batDesignCap = 0
        batFullCap = 0
        batCycleCount = 0
        batMfg = ""
        batSerial = ""

        Set objRootWMI = GetObject("winmgmts:\\.\root\wmi")
        If Err.Number = 0 Then
            Set colBatStatic = objRootWMI.ExecQuery("SELECT * FROM BatteryStaticData")
            For Each objBatStatic In colBatStatic
                If objBatStatic.DesignedCapacity > 0 Then batDesignCap = CLng(objBatStatic.DesignedCapacity)
                If Len(S(objBatStatic.ManufactureName)) > 0 Then batMfg = Trim(S(objBatStatic.ManufactureName))
                If Len(S(objBatStatic.SerialNumber)) > 0 Then batSerial = Trim(S(objBatStatic.SerialNumber))
                Exit For
            Next
            Err.Clear

            Set colBatFull = objRootWMI.ExecQuery("SELECT * FROM BatteryFullChargedCapacity")
            For Each objBatFull In colBatFull
                If objBatFull.FullChargedCapacity > 0 Then batFullCap = CLng(objBatFull.FullChargedCapacity)
                Exit For
            Next
            Err.Clear

            Set colBatCycle = objRootWMI.ExecQuery("SELECT * FROM BatteryCycleCount")
            For Each objBatCycle In colBatCycle
                If objBatCycle.CycleCount > 0 Then batCycleCount = CLng(objBatCycle.CycleCount)
                Exit For
            Next
            Err.Clear
        End If

        Dim batHealthPctStr, batWearPctStr, batHealthPctNum, batWearPctNum, batCycleJson, batChargeJson, batChargingJson
        batHealthPctStr = "null"
        batWearPctStr = "null"
        batHealthPctNum = -1
        batWearPctNum = -1
        If batDesignCap > 0 And batFullCap > 0 Then
            batHealthPctNum = Int((CDbl(batFullCap) / CDbl(batDesignCap)) * 100 + 0.5)
            If batHealthPctNum > 100 Then batHealthPctNum = 100
            If batHealthPctNum < 0 Then batHealthPctNum = 0
            batWearPctNum = 100 - batHealthPctNum
            batHealthPctStr = CStr(batHealthPctNum)
            batWearPctStr = CStr(batWearPctNum)
        End If

        If batCycleCount > 0 Then
            batCycleJson = CStr(batCycleCount)
        Else
            batCycleJson = "null"
        End If

        If batChargePct >= 0 Then
            batChargeJson = CStr(batChargePct)
        Else
            batChargeJson = "null"
        End If

        If batIsCharging Then
            batChargingJson = "true"
        Else
            batChargingJson = "false"
        End If

        batStatus = "GOOD"
        batStatusText = "Pin Tot"
        If (batHealthPctNum >= 0 And batHealthPctNum < 50) Or batCycleCount >= 800 Then
            batStatus = "CRITICAL"
            If batWearPctNum >= 0 Then
                batStatusText = "Can thay pin (Chai " & batWearPctNum & "%)"
            Else
                batStatusText = "Can thay pin (" & batCycleCount & " lan sac)"
            End If
            hardwareAlerts = "[""Pin Laptop chai nang (Tuoi tho con " & batHealthPctNum & "%, chai " & batWearPctNum & "%) - Can thay pin!""]"
        ElseIf (batHealthPctNum >= 0 And batHealthPctNum < 75) Or batCycleCount >= 500 Then
            batStatus = "WARNING"
            If batWearPctNum >= 0 Then
                batStatusText = "Pin da chai " & batWearPctNum & "% (Can chu y)"
            Else
                batStatusText = "So lan sac cao (" & batCycleCount & " lan)"
            End If
            hardwareAlerts = "[""Pin Laptop da chai " & batWearPctNum & "% (Tuoi tho con " & batHealthPctNum & "%)""]"
        ElseIf batHealthPctNum >= 0 Then
            batStatusText = "Pin Tot (Tuoi tho " & batHealthPctNum & "%)"
        End If

        batteryHealthJson = "{""hasBattery"":true,""name"":""" & EscJson(batName) & """,""manufacturer"":""" & EscJson(batMfg) & """,""serialNumber"":""" & EscJson(batSerial) & """,""designCapacityMWh"":" & batDesignCap & ",""fullChargeCapacityMWh"":" & batFullCap & ",""healthPercent"":" & batHealthPctStr & ",""wearLevelPercent"":" & batWearPctStr & ",""cycleCount"":" & batCycleJson & ",""chargePercent"":" & batChargeJson & ",""isCharging"":" & batChargingJson & ",""status"":""" & batStatus & """,""statusText"":""" & EscJson(batStatusText) & """}"
    End If
    Err.Clear
    On Error GoTo 0
End If

' Overall health
If anyDiskCritical Or cpuHealthStatus = "CRITICAL" Or batStatus = "CRITICAL" Then
    overallHealth = "CRITICAL"
    If anyDiskCritical Or cpuHealthStatus = "CRITICAL" Then
        overallHealthText = "NGUY HIEM: Co loi phan cung!"
    Else
        overallHealthText = "CAN THAY PIN: Pin Laptop da chai nang!"
    End If
ElseIf anyDiskWarning Or ramHealthStatus = "WARNING" Or cpuHealthStatus = "WARNING" Or batStatus = "WARNING" Then
    overallHealth = "WARNING"
    overallHealthText = "Can chu y (O dia / RAM / Pin Laptop)"
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
    softwareInfo = "[" & JoinJson(swArr) & "]"
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
            monArr(monCount) = "{""Manufacturer"":""" & EscJson(S(objMon.MonitorManufacturer)) & """,""Model"":""" & EscJson(S(objMon.Name)) & """,""SerialNumber"":""N/A"",""ScreenSize"":""N/A"",""Source"":""WMI""}"
            monCount = monCount + 1
        End If
    Next
    If monCount > 0 Then
        monitorInfo = "[" & JoinJson(monArr) & "]"
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
            If InStr(objLic.Name, "Windows") > 0 Or S(objLic.ApplicationId) = "55c92734-d682-4d71-983e-d6ec3f16059f" Then
                If osLicenseStatus <> "LICENSED" Or licStatus = "LICENSED" Then
                    osLicenseStatus = licStatus
                    osLicenseChannel = licChannel
                    If Len(licKey) > 0 Then osLicenseKey = "*****-" & licKey
                End If
            End If

            ' Office license
            If InStr(objLic.Name, "Office") > 0 Or InStr(objLic.Name, "Visio") > 0 Or InStr(objLic.Name, "Project") > 0 Then
                If Len(officeLicenseName) = 0 Or licStatus = "LICENSED" Then
                    officeLicenseName = S(objLic.Name)
                    officeLicenseStatus = licStatus
                    officeLicenseChannel = licChannel
                    If Len(licKey) > 0 Then officeLicenseKey = "*****-" & licKey
                End If
            End If

            ReDim Preserve licArr(licCount)
            Dim pkDisplay
            pkDisplay = ""
            If Len(licKey) > 0 Then pkDisplay = "*****-" & licKey
            licArr(licCount) = "{""softwareName"":""" & EscJson(S(objLic.Name)) & """,""status"":""" & licStatus & """,""statusText"":""" & licStatusText & """,""channel"":""" & licChannel & """,""partialKey"":""" & pkDisplay & """,""source"":""WMI_SPP""}"
            licCount = licCount + 1
        End If
    Next

    If licCount > 0 Then
        softwareLicenses = "[" & JoinJson(licArr) & "]"
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
hardwareHealthJson = "{""overallStatus"":""" & overallHealth & """,""overallText"":""" & overallHealthText & """,""cpu"":{""status"":""" & cpuHealthStatus & """,""statusText"":""" & cpuHealthText & """,""loadPercent"":" & cpuLoad & ",""cores"":" & cpuCores & ",""threads"":" & cpuCores & ",""clockSpeedMHz"":" & cpuClockMHz & ",""temperatureC"":" & cpuTempC & "},""ram"":{""status"":""" & ramHealthStatus & """,""statusText"":""" & ramHealthText & """,""totalGB"":" & Num(ramTotalGB) & ",""usedGB"":" & Num(ramUsedGB) & ",""freeGB"":" & Num(ramFreeGB) & ",""usagePercent"":" & ramUsagePct & ",""slotsUsed"":" & ramSlotCount & "},""battery"":" & batteryHealthJson & ",""diskStatus"":""" & diskHealthStatus & """,""diskText"":""" & diskHealthText & """,""logicalVolumes"":[],""alerts"":" & hardwareAlerts & ",""checkedAt"":""" & FormatDateTime_ISO() & """}"

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
    """ramType"":""" & EscJson(detectedRamType) & """," & _
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
                lastErr = "HTTP " & xmlHttp.Status & " - " & xmlHttp.statusText & " | " & Left(xmlHttp.responseText, 200)
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
    ' Luu payload de chan doan (xem C:\ProgramData\TowaITAM\last_payload.json hoac %TEMP%)
    On Error Resume Next
    Dim dumpPath, dumpFile
    dumpPath = objShell.ExpandEnvironmentStrings("%TEMP%") & "\towa_last_payload.json"
    If objFSO.FolderExists("C:\ProgramData\TowaITAM") Then dumpPath = "C:\ProgramData\TowaITAM\last_payload.json"
    Set dumpFile = objFSO.CreateTextFile(dumpPath, True)
    dumpFile.Write jsonPayload
    dumpFile.Close
    On Error GoTo 0
    WScript.Echo ""
    WScript.Echo "LOI: Khong gui duoc du lieu sau 3 lan thu. Loi cuoi: " & lastErr
    WScript.Echo "Da luu du lieu da gui tai: " & dumpPath
End If

WScript.Echo ""
WScript.Echo "HOAN TAT!"


' ===========================================================================
' HAM HO TRO
' ===========================================================================
' Giai ma hang san xuat RAM tu ma JEDEC Hex hoac PartNumber
Function ResolveRamMfg(rawMfg, partNum)
    Dim uMfg, uPart, mfgName, code4
    uMfg = UCase(Trim(rawMfg))
    uPart = UCase(Trim(partNum))
    mfgName = ""
    code4 = Left(uMfg, 4)

    Select Case code4
        Case "04CD", "CD04": mfgName = "G.Skill"
        Case "0198", "9801", "7F98": mfgName = "Kingston"
        Case "80AD", "AD80", "00AD", "AD00": mfgName = "SK Hynix"
        Case "80CE", "CE80", "00CE", "CE00": mfgName = "Samsung"
        Case "802C", "2C80", "002C", "2C00": mfgName = "Micron"
        Case "859B", "9B85", "059B": mfgName = "Crucial"
        Case "029E", "9E02": mfgName = "Corsair"
        Case "04CB", "CB04": mfgName = "ADATA"
        Case "04EF", "EF04": mfgName = "TeamGroup"
        Case "014F", "4F01": mfgName = "Transcend"
        Case "02FE", "FE02": mfgName = "Elpida"
        Case "830B", "0B83", "030B": mfgName = "Nanya"
        Case "075D", "86F1": mfgName = "Lexar"
        Case "017A", "7A01": mfgName = "Apacer"
        Case "8551", "0551", "80C1", "00C1": mfgName = "Infineon"
        Case "0420", "8502", "0502": mfgName = "Patriot"
        Case "0443": mfgName = "GeIL"
        Case "8313": mfgName = "Silicon Power"
        Case "0B92", "8B92": mfgName = "Kingbank"
        Case "07E9": mfgName = "Netac"
        Case "86D3": mfgName = "Puskill"
    End Select

    If Len(mfgName) = 0 Then
        If Len(uMfg) > 0 And uMfg <> "UNDEFINED" And uMfg <> "UNKNOWN" And Left(uMfg, 4) <> "0000" And Left(uMfg, 12) <> "MANUFACTURER" Then
            ' Kiem tra xem co phai chuoi Hex 4 ky tu khong
            Dim isHex, hi, hc
            isHex = (Len(uMfg) = 4 Or Len(uMfg) = 8 Or Len(uMfg) = 12)
            For hi = 1 To Len(uMfg)
                hc = Mid(uMfg, hi, 1)
                If InStr("0123456789ABCDEF", hc) = 0 Then isHex = False
            Next
            If Not isHex Then mfgName = rawMfg
        End If
    End If

    If Len(mfgName) = 0 And Len(uPart) > 0 Then
        If Left(uPart, 3) = "F2-" Or Left(uPart, 3) = "F3-" Or Left(uPart, 3) = "F4-" Or Left(uPart, 3) = "F5-" Or Left(uPart, 3) = "FA-" Then
            mfgName = "G.Skill"
        ElseIf Left(uPart, 3) = "KVR" Or Left(uPart, 3) = "KHX" Or Left(uPart, 2) = "HX" Or Left(uPart, 2) = "KF" Or Left(uPart, 3) = "ACR" Then
            mfgName = "Kingston"
        ElseIf Left(uPart, 4) = "M378" Or Left(uPart, 4) = "M471" Or Left(uPart, 4) = "M393" Or Left(uPart, 4) = "M323" Or Left(uPart, 4) = "M425" Then
            mfgName = "Samsung"
        ElseIf Left(uPart, 3) = "HMT" Or Left(uPart, 3) = "HMA" Or Left(uPart, 4) = "HMCG" Or Left(uPart, 4) = "HYMP" Then
            mfgName = "SK Hynix"
        ElseIf Left(uPart, 2) = "CT" Or Left(uPart, 2) = "BL" Then
            mfgName = "Crucial"
        ElseIf Left(uPart, 2) = "MT" Then
            mfgName = "Micron"
        ElseIf Left(uPart, 2) = "CM" Then
            mfgName = "Corsair"
        ElseIf Left(uPart, 2) = "AX" Or Left(uPart, 2) = "AD" Then
            mfgName = "ADATA"
        ElseIf Left(uPart, 3) = "TED" Or Left(uPart, 3) = "TLZ" Or Left(uPart, 2) = "TF" Then
            mfgName = "TeamGroup"
        ElseIf Left(uPart, 2) = "TS" Or Left(uPart, 2) = "JM" Then
            mfgName = "Transcend"
        ElseIf Left(uPart, 2) = "NT" Then
            mfgName = "Nanya"
        End If
    End If

    If Len(mfgName) = 0 Then mfgName = "Generic RAM"
    If Len(partNum) > 0 Then
        ResolveRamMfg = mfgName & " (" & partNum & ")"
    Else
        ResolveRamMfg = mfgName
    End If
End Function

' Xac dinh the he RAM (DDR2 / DDR3 / DDR4 / DDR5 / LPDDR)
Function ResolveRamType(smbiosT, memT, rawSpd, partNum, cpuStr)
    Dim ddr, uPart, uCpu
    ddr = ""
    uPart = UCase(Trim(partNum))
    uCpu = UCase(Trim(cpuStr))

    Select Case smbiosT
        Case 34: ddr = "DDR5"
        Case 35: ddr = "LPDDR5"
        Case 26: ddr = "DDR4"
        Case 30: ddr = "LPDDR4"
        Case 24: ddr = "DDR3"
        Case 29: ddr = "LPDDR3"
        Case 21, 22: ddr = "DDR2"
        Case 28: ddr = "LPDDR2"
        Case 20: ddr = "DDR"
    End Select

    If Len(ddr) = 0 Then
        Select Case memT
            Case 26: ddr = "DDR4"
            Case 24: ddr = "DDR3"
            Case 21, 22: ddr = "DDR2"
            Case 20: ddr = "DDR"
        End Select
    End If

    If Len(ddr) = 0 And Len(uPart) > 0 Then
        If InStr(uPart, "DDR5") > 0 Or InStr(uPart, "PC5") > 0 Or Left(uPart, 3) = "F5-" Or Left(uPart, 3) = "KF5" Or Left(uPart, 4) = "M323" Or Left(uPart, 4) = "HMCG" Then
            ddr = "DDR5"
        ElseIf InStr(uPart, "DDR4") > 0 Or InStr(uPart, "PC4") > 0 Or Left(uPart, 3) = "F4-" Or Left(uPart, 3) = "KF4" Or Left(uPart, 3) = "HX4" Or Left(uPart, 5) = "M378A" Or Left(uPart, 5) = "M471A" Or Left(uPart, 4) = "HMA8" Or Left(uPart, 4) = "HMAA" Or Left(uPart, 3) = "MTA" Then
            ddr = "DDR4"
        ElseIf InStr(uPart, "DDR3") > 0 Or InStr(uPart, "PC3") > 0 Or Left(uPart, 3) = "F3-" Or Left(uPart, 4) = "KHX1" Or Left(uPart, 3) = "HX3" Or Left(uPart, 5) = "M378B" Or Left(uPart, 5) = "M471B" Or Left(uPart, 3) = "HMT" Or Left(uPart, 4) = "KVR1" Then
            ddr = "DDR3"
        ElseIf InStr(uPart, "DDR2") > 0 Or InStr(uPart, "PC2") > 0 Or Left(uPart, 3) = "F2-" Or Left(uPart, 5) = "M378T" Or Left(uPart, 4) = "HYMP" Then
            ddr = "DDR2"
        End If
    End If

    If Len(ddr) = 0 And rawSpd > 0 Then
        If rawSpd >= 3800 Then
            ddr = "DDR5"
        ElseIf rawSpd >= 1867 Then
            ddr = "DDR4"
        ElseIf rawSpd >= 800 Then
            If rawSpd = 800 And (InStr(uCpu, "CORE(TM)2") > 0 Or InStr(uCpu, "PENTIUM(R) DUAL") > 0) Then
                ddr = "DDR2"
            Else
                ddr = "DDR3"
            End If
        ElseIf rawSpd >= 400 Then
            If InStr(uCpu, "I3-") > 0 Or InStr(uCpu, "I5-") > 0 Or InStr(uCpu, "I7-") > 0 Then
                ddr = "DDR3"
            Else
                ddr = "DDR2"
            End If
        Else
            ddr = "DDR"
        End If
    End If

    If Len(ddr) = 0 Then
        If InStr(uCpu, "-12") > 0 Or InStr(uCpu, "-13") > 0 Or InStr(uCpu, "-14") > 0 Or InStr(uCpu, "CORE ULTRA") > 0 Then
            ddr = "DDR4/DDR5"
        ElseIf InStr(uCpu, "-6") > 0 Or InStr(uCpu, "-7") > 0 Or InStr(uCpu, "-8") > 0 Or InStr(uCpu, "-9") > 0 Or InStr(uCpu, "-10") > 0 Or InStr(uCpu, "-11") > 0 Or InStr(uCpu, "RYZEN") > 0 Then
            ddr = "DDR4"
        ElseIf InStr(uCpu, "CORE(TM)2") > 0 Or InStr(uCpu, "PENTIUM(R) DUAL") > 0 Then
            ddr = "DDR2"
        Else
            ddr = "DDR3"
        End If
    End If

    ResolveRamType = ddr
End Function

' Chuyen gia tri WMI (co the Null/Empty) thanh chuoi an toan - CStr(Null) gay loi
Function S(v)
    If IsNull(v) Or IsEmpty(v) Then
        S = ""
    Else
        S = CStr(v)
    End If
End Function

' Noi mang JSON, bo qua phan tu rong (tranh JSON sai dang [,{...}])
Function JoinJson(arr)
    Dim i, r
    r = ""
    On Error Resume Next
    For i = LBound(arr) To UBound(arr)
        If Len(arr(i)) > 0 Then
            If Len(r) > 0 Then r = r & ","
            r = r & arr(i)
        End If
    Next
    On Error GoTo 0
    JoinJson = r
End Function

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

