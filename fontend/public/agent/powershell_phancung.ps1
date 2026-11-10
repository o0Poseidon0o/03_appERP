# =============================================================================
# TOWA ITAM AGENT - V3.22 (MULTI-WINDOWS: WINDOWS 7 PS 2.0 -> WINDOWS 11 PS 5.1+)
# Features: Win7/PS2.0 + Hardware Health (CPU/RAM/SMART Disk) + Multi-Software License Scan
# =============================================================================

# --- 1. CẤU HÌNH ---
$IsDevMode      = $false                     # $true = Localhost, $false = Server
$ServerIP       = "192.168.20.17"
$ServerPort     = "3000"
$FallbackPort   = "90"
$AgentSecretKey = "@Towa2026!#Secure_Agent_998811_AbCdEf"
$ApiKey         = $AgentSecretKey

# --- 2. URL & TLS (Tương thích cả Windows 7 .NET 2.0/3.5 và Windows 10/11) ---
if ($IsDevMode) {
    $BaseUrl = "http://127.0.0.1:$ServerPort"
    $CandidateApiUrls = @("$BaseUrl/api/assets/sync")
} else {
    $BaseUrl = "http://${ServerIP}:${ServerPort}"
    $CandidateApiUrls = @(
        "http://${ServerIP}:${ServerPort}/api/assets/sync",
        "http://${ServerIP}:${FallbackPort}/api/assets/sync"
    )
}
$ApiUrl = $CandidateApiUrls[0]
try {
    [Net.ServicePointManager]::SecurityProtocol = [Enum]::ToObject([Net.SecurityProtocolType], 3072)
} catch {}

# --- 2B. HÀM HỖ TRỢ TƯƠNG THÍCH WINDOWS 7 (POWERSHELL 2.0) ---
function ConvertFrom-WmiChars {
    param ($CharArray)
    if ($null -eq $CharArray) { return "" }
    try {
        $chars = @($CharArray | Where-Object { $_ -gt 0 } | ForEach-Object { [char][int]$_ })
        return ($chars -join "").Trim()
    } catch {
        return ""
    }
}

function Escape-JsonString {
    param ([string]$Str)
    if ($null -eq $Str) { return "" }
    $s = $Str.Replace('\', '\\').Replace('"', '\"').Replace("`r", '\r').Replace("`n", '\n').Replace("`t", '\t')
    return $s
}

function ConvertTo-JsonManual {
    param ($Obj)
    if ($null -eq $Obj) { return "null" }
    if ($Obj -is [bool]) { if ($Obj) { return "true" } else { return "false" } }
    if ($Obj -is [int] -or $Obj -is [long] -or $Obj -is [double] -or $Obj -is [decimal]) {
        return [string]::Format([System.Globalization.CultureInfo]::InvariantCulture, "{0}", $Obj)
    }
    if ($Obj -is [string]) {
        return '"' + (Escape-JsonString $Obj) + '"'
    }
    if ($Obj -is [System.Collections.IDictionary]) {
        $pairs = @()
        foreach ($k in $Obj.Keys) {
            $valJson = ConvertTo-JsonManual $Obj[$k]
            $pairs += ('"' + (Escape-JsonString ([string]$k)) + '":' + $valJson)
        }
        return '{' + ($pairs -join ',') + '}'
    }
    if ($Obj -is [System.Collections.IEnumerable]) {
        $items = @()
        foreach ($item in $Obj) {
            $items += (ConvertTo-JsonManual $item)
        }
        return '[' + ($items -join ',') + ']'
    }
    return '"' + (Escape-JsonString ($Obj.ToString())) + '"'
}

function ConvertTo-JsonCompat {
    param ($InputObject)
    if (Get-Command ConvertTo-Json -ErrorAction SilentlyContinue) {
        return ($InputObject | ConvertTo-Json -Depth 5 -Compress)
    }
    try {
        Add-Type -AssemblyName System.Web.Extensions -ErrorAction Stop
        $serializer = New-Object System.Web.Script.Serialization.JavaScriptSerializer
        $serializer.MaxJsonLength = 67108864
        return $serializer.Serialize($InputObject)
    } catch {
        return (ConvertTo-JsonManual $InputObject)
    }
}

function Send-AgentPayload {
    param (
        [string]$Uri,
        [string]$JsonBody,
        [string]$SecretKey
    )
    $utf8Bytes = [System.Text.Encoding]::UTF8.GetBytes($JsonBody)
    $req = [System.Net.HttpWebRequest]::Create($Uri)
    $req.Method = "POST"
    $req.ContentType = "application/json; charset=utf-8"
    $req.Timeout = 30000
    $req.ReadWriteTimeout = 30000
    $req.Headers.Add("X-Agent-Secret-Key", $SecretKey)
    $req.Headers.Add("x-api-key", $SecretKey)
    $req.ContentLength = $utf8Bytes.Length

    $reqStream = $req.GetRequestStream()
    $reqStream.Write($utf8Bytes, 0, $utf8Bytes.Length)
    $reqStream.Flush()
    $reqStream.Close()

    $resp = $req.GetResponse()
    $respStream = $resp.GetResponseStream()
    $reader = New-Object System.IO.StreamReader($respStream, [System.Text.Encoding]::UTF8)
    $respText = $reader.ReadToEnd()
    $reader.Close()
    $resp.Close()
    return $respText
}

# --- 3. DANH SÁCH VID (MỞ RỘNG - ĐÃ SỬA LỖI TRÙNG LẶP) ---
$VendorLookup = @{
    "046D" = "Logitech"; "413C" = "Dell"; "03F0" = "HP"; "17EF" = "Lenovo"
    "045E" = "Microsoft"; "1532" = "Razer"; "1B1C" = "Corsair"; "1038" = "SteelSeries"
    "0B05" = "ASUS"; "093A" = "Pixart"; "05AC" = "Apple"; "258A" = "Sino wealth"
    "18F8" = "Rapoo"; "09DA" = "A4Tech"; "24AE" = "Rapoo"; "04F2" = "Chicony"
    "0461" = "Primax"; "04CA" = "Lite-On"
}

# --- 4. CẤU HÌNH LỌC & GOM NHÓM PHẦN MỀM ---
# Các mẫu tên phần mềm rác / gói phụ trợ đi kèm cần loại bỏ
$ExcludeSoftwarePatterns = @(
    "Click-to-Run", "MUI", "Proofing", "Localization", "Extensibility",
    "Licensing Component", "Setup Metadata", "Tools for Office", "Primary Interop",
    "Database Engine", "Shared 64-bit", "Shared 32-bit", "OSM ", "Office 16 ", "Office 15 ",
    "Redistributable", "Minimum Runtime", "Additional Runtime", "C\+\+ 20",
    "Edge Update", "WebView2", "Google Update", "Auto Updater", "Update Helper",
    "Language Pack", "Material Library", "Content Pack", "Documentation",
    "Core Interpreter", "Development Libraries", "Executables", "pip Bootstrap",
    "Standard Library", "Tcl/Tk", "Test Suite", "Utility Scripts", "Python Launcher",
    "Windows Software Development Kit", "SDK", "CefSharp", "Genuine Service",
    "Bonjour", "Hotfix", "Security Update", "Service Pack", "Driver", "Add-in",
    "Meeting Add-in", "Teams Meeting", "Add-in for Microsoft",
    "Connector", "Helper", "Host", " Telemetry", "Diagnostic"
)

function Get-NormalizedSoftware {
    param (
        [string]$RawName,
        [string]$RawVersion,
        [string]$RawPublisher
    )

    $name = $RawName.Trim()

    # 1. Loại bỏ các gói phụ trợ / thành phần con
    foreach ($pattern in $ExcludeSoftwarePatterns) {
        if ($name -match $pattern) { return $null }
    }

    # 2. Chuẩn hóa Microsoft Office / Microsoft 365 (Chỉ lấy bộ cài chính)
    if ($name -match "^(Microsoft Office|Microsoft 365|Office 365)") {
        # Bỏ qua các công cụ lẻ hoặc thành phần phụ của Office
        if ($name -match "(Project|Visio)") {
            $cleanProjectVisio = ($name -replace "\s*-\s*[a-z]{2}-[a-z]{2}.*$", "" -replace "\s*\([0-9]+-bit\)", "").Trim()
            return @{ Key = $cleanProjectVisio; Name = $cleanProjectVisio; Version = $RawVersion; Publisher = "Microsoft Corporation" }
        }
        if ($name -notmatch "(Professional|Standard|Home|Business|Enterprise|Personal|LTSC|365|Apps|2007|2010|2013|2016|2019|2021|2024)") {
            return $null
        }
        # Làm gọn tên: Bỏ mã ngôn ngữ (vd: " - en-us", " - vi-vn")
        $cleanOffice = ($name -replace "\s*-\s*[a-z]{2}-[a-z]{2}.*$", "").Trim()
        if ($cleanOffice -match "Microsoft 365|Office 365") {
            $cleanOffice = "Microsoft 365 (Office)"
        }
        # Dùng chung Key "MS_OFFICE_SUITE" để mỗi máy chỉ ghi nhận 1 bộ Office chính duy nhất
        return @{ Key = "MS_OFFICE_SUITE"; Name = $cleanOffice; Version = $RawVersion; Publisher = "Microsoft Corporation" }
    }

    # 3. Chuẩn hóa Visual Studio Code vs Visual Studio
    if ($name -match "Visual Studio Code") {
        return @{ Key = "VSCODE"; Name = "Visual Studio Code"; Version = $RawVersion; Publisher = "Microsoft Corporation" }
    }
    if ($name -match "^(Microsoft )?Visual Studio (Community|Professional|Enterprise|20\d{2})") {
        $cleanVS = ($name -replace "^Microsoft ", "").Trim()
        return @{ Key = $cleanVS; Name = $cleanVS; Version = $RawVersion; Publisher = "Microsoft Corporation" }
    }

    # 4. Chuẩn hóa Python (Chỉ lấy bản Python chính, bỏ các module MSI lẻ)
    if ($name -match "^Python (\d+\.\d+)(\.\d+)?(\s*\(\d+-bit\))?$") {
        $pyMajorMinor = $matches[1]
        return @{ Key = "PYTHON_$pyMajorMinor"; Name = "Python $pyMajorMinor"; Version = $RawVersion; Publisher = "Python Software Foundation" }
    }

    # 5. Chuẩn hóa Thiết kế / Kỹ thuật (AutoCAD, SolidWorks, Revit, SketchUp, CorelDRAW, Adobe)
    if ($name -match "^(Autodesk )?AutoCAD (LT )?\d{4}") {
        $cleanCad = $matches[0].Trim()
        return @{ Key = $cleanCad; Name = $cleanCad; Version = $RawVersion; Publisher = "Autodesk" }
    }
    if ($name -match "^(Autodesk )?Revit \d{4}") {
        $cleanRevit = $matches[0].Trim()
        return @{ Key = $cleanRevit; Name = $cleanRevit; Version = $RawVersion; Publisher = "Autodesk" }
    }
    if ($name -match "^SOLIDWORKS \d{4}") {
        $cleanSw = ($name -replace "^(SOLIDWORKS \d{4}).*$", '$1').Trim()
        return @{ Key = $cleanSw; Name = $cleanSw; Version = $RawVersion; Publisher = "Dassault Systemes" }
    }
    if ($name -match "^SketchUp (Pro )?\d{4}") {
        $cleanSkp = $matches[0].Trim()
        return @{ Key = $cleanSkp; Name = $cleanSkp; Version = $RawVersion; Publisher = $RawPublisher }
    }
    if ($name -match "^CorelDRAW( Graphics Suite)?( \d{4}| X\d+)?") {
        $cleanCorel = $matches[0].Trim()
        return @{ Key = "CORELDRAW"; Name = $cleanCorel; Version = $RawVersion; Publisher = "Corel Corporation" }
    }
    if ($name -match "^Adobe Photoshop") {
        return @{ Key = "PHOTOSHOP"; Name = ($name -replace "\s*\(.*\)$", "").Trim(); Version = $RawVersion; Publisher = "Adobe Inc." }
    }
    if ($name -match "^Adobe Illustrator") {
        return @{ Key = "ILLUSTRATOR"; Name = ($name -replace "\s*\(.*\)$", "").Trim(); Version = $RawVersion; Publisher = "Adobe Inc." }
    }

    # 6. Trình duyệt & Tiện ích văn phòng phổ biến
    if ($name -match "^Google Chrome") { return @{ Key = "CHROME"; Name = "Google Chrome"; Version = $RawVersion; Publisher = "Google LLC" } }
    if ($name -match "^Mozilla Firefox") { return @{ Key = "FIREFOX"; Name = "Mozilla Firefox"; Version = $RawVersion; Publisher = "Mozilla" } }
    if ($name -eq "Microsoft Edge") { return @{ Key = "EDGE"; Name = "Microsoft Edge"; Version = $RawVersion; Publisher = "Microsoft Corporation" } }
    if ($name -match "Cốc Cốc|CocCoc") { return @{ Key = "COCCOC"; Name = "Cốc Cốc Browser"; Version = $RawVersion; Publisher = "CocCoc" } }

    if ($name -match "^Zalo") { return @{ Key = "ZALO"; Name = "Zalo"; Version = $RawVersion; Publisher = "VNG Corp." } }
    if ($name -match "^Telegram") { return @{ Key = "TELEGRAM"; Name = "Telegram Desktop"; Version = $RawVersion; Publisher = $RawPublisher } }
    if ($name -match "^Skype") { return @{ Key = "SKYPE"; Name = "Skype"; Version = $RawVersion; Publisher = "Microsoft Corporation" } }
    if ($name -match "^Viber") { return @{ Key = "VIBER"; Name = "Viber"; Version = $RawVersion; Publisher = $RawPublisher } }
    if ($name -match "^WhatsApp") { return @{ Key = "WHATSAPP"; Name = "WhatsApp"; Version = $RawVersion; Publisher = $RawPublisher } }

    if ($name -match "^TeamViewer") { return @{ Key = "TEAMVIEWER"; Name = "TeamViewer"; Version = $RawVersion; Publisher = "TeamViewer" } }
    if ($name -match "^UltraViewer") { return @{ Key = "ULTRAVIEWER"; Name = "UltraViewer"; Version = $RawVersion; Publisher = "DucFabulous" } }
    if ($name -match "^AnyDesk") { return @{ Key = "ANYDESK"; Name = "AnyDesk"; Version = $RawVersion; Publisher = "AnyDesk Software" } }

    if ($name -match "^(UniKey|EVKey)") {
        $imeName = if ($name -match "EVKey") { "EVKey" } else { "UniKey" }
        return @{ Key = $imeName; Name = $imeName; Version = $RawVersion; Publisher = $RawPublisher }
    }
    if ($name -match "^(Foxit (PDF )?(Reader|Editor)|Adobe Acrobat (Reader|DC|Pro))") {
        $pdfName = ($name -replace "\s*\(.*\)$", "" -replace "\s*-\s*[A-Za-z]+$", "").Trim()
        return @{ Key = "PDF_APP_$pdfName"; Name = $pdfName; Version = $RawVersion; Publisher = $RawPublisher }
    }
    if ($name -match "^WinRAR") { return @{ Key = "WINRAR"; Name = "WinRAR"; Version = $RawVersion; Publisher = "win.rar GmbH" } }
    if ($name -match "^7-Zip") { return @{ Key = "7ZIP"; Name = "7-Zip"; Version = $RawVersion; Publisher = "Igor Pavlov" } }
    if ($name -match "^Node\.js") { return @{ Key = "NODEJS"; Name = "Node.js"; Version = $RawVersion; Publisher = "Node.js Foundation" } }
    if ($name -match "^Java (\d+|SE Development Kit)") { return @{ Key = "JAVA"; Name = ($name -replace "\s*\(\d+-bit\)", "").Trim(); Version = $RawVersion; Publisher = "Oracle Corporation" } }

    # 7. Chuẩn hóa Kaspersky & Phần mềm Diệt Virus / Bảo mật
    if ($name -match "Kaspersky") {
        if ($name -match "(Network Agent|Administration Kit|Security Center|Plugin|Patch|Updater|Management|Connection)") {
            return $null
        }
        $cleanKaspersky = ($name -replace "\s*\(.*\)$", "").Trim()
        if ($cleanKaspersky -match "Kaspersky Endpoint Security") {
            $cleanKaspersky = "Kaspersky Endpoint Security"
        }
        return @{ Key = "KASPERSKY_AV"; Name = $cleanKaspersky; Version = $RawVersion; Publisher = "Kaspersky" }
    }

    return @{ Key = $name.ToUpper(); Name = $name; Version = $RawVersion; Publisher = $RawPublisher }
}

Write-Host "--- KHOI DONG TOWA AGENT V3.15 (FIXED) ---" -ForegroundColor Cyan

try {
    # BƯỚC 0: JITTER (CHỐNG NGHẼN)
    $jitter = Get-Random -Minimum 2 -Maximum 30
    Write-Host "[0/8] Delay $jitter giay..." -ForegroundColor DarkGray
    Start-Sleep -Seconds $jitter

    # A. PHẦN CỨNG CƠ BẢN (DUAL ENGINE: WMI + REGISTRY / .NET FALLBACK KHI WMI BỊ HỎNG)
    Write-Host "[1/8] Quet he thong co ban..." -NoNewline
    $bios = $null; $comp = $null; $os = $null; $cpu = $null
    try { $bios = @(Get-WmiObject Win32_BIOS -ErrorAction SilentlyContinue)[0] } catch {}
    try { $comp = @(Get-WmiObject Win32_ComputerSystem -ErrorAction SilentlyContinue)[0] } catch {}
    try { $os   = @(Get-WmiObject Win32_OperatingSystem -ErrorAction SilentlyContinue)[0] } catch {}
    try { $cpu  = @(Get-WmiObject Win32_Processor -ErrorAction SilentlyContinue)[0] } catch {}

    # TỰ ĐỘNG CỨU HỘ: NẾU KHO WMI BỊ LỖI (INVALID CLASS NHƯ MÁY PC37)
    $isWmiCorrupted = ($null -eq $os -and $null -eq $cpu)
    if ($isWmiCorrupted) {
        try {
            Start-Process -FilePath "winmgmt" -ArgumentList "/salvagerepository" -WindowStyle Hidden -ErrorAction SilentlyContinue
        } catch {}
    }

    # FALLBACK REGISTRY: Hãng, Model, Serial
    $regBios = Get-ItemProperty 'HKLM:\HARDWARE\DESCRIPTION\System\BIOS' -ErrorAction SilentlyContinue
    $manufacturer = if ($comp -and $comp.Manufacturer) { [string]$comp.Manufacturer } `
                    elseif ($regBios.SystemManufacturer -and $regBios.SystemManufacturer -notmatch "Default|To be filled") { [string]$regBios.SystemManufacturer } `
                    elseif ($regBios.BaseBoardManufacturer) { [string]$regBios.BaseBoardManufacturer } `
                    else { "PC" }

    $model = if ($comp -and $comp.Model) { [string]$comp.Model } `
             elseif ($regBios.SystemProductName -and $regBios.SystemProductName -notmatch "Default|To be filled") { [string]$regBios.SystemProductName } `
             elseif ($regBios.BaseBoardProduct) { [string]$regBios.BaseBoardProduct } `
             else { "Workstation" }

    $serialNum = if ($bios -and $bios.SerialNumber) { ([string]$bios.SerialNumber).Trim() } `
                 elseif ($regBios.SystemSerialNumber -and $regBios.SystemSerialNumber -notmatch "Default|To be filled") { ([string]$regBios.SystemSerialNumber).Trim() } `
                 elseif ($regBios.BaseBoardSerialNumber -and $regBios.BaseBoardSerialNumber -notmatch "Default|To be filled") { ([string]$regBios.BaseBoardSerialNumber).Trim() } `
                 else { "N/A" }

    # FALLBACK REGISTRY: CPU
    $regCpu = Get-ItemProperty 'HKLM:\HARDWARE\DESCRIPTION\System\CentralProcessor\0' -ErrorAction SilentlyContinue
    $cpuName = if ($cpu -and $cpu.Name) { ([string]$cpu.Name).Trim() } `
               elseif ($regCpu.ProcessorNameString) { ([string]$regCpu.ProcessorNameString).Trim() } `
               elseif ($env:PROCESSOR_IDENTIFIER) { $env:PROCESSOR_IDENTIFIER } `
               else { "Intel/AMD Processor" }

    # FALLBACK REGISTRY: OS
    $regOs = Get-ItemProperty 'HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion' -ErrorAction SilentlyContinue
    $osName = if ($os -and $os.Caption) { [string]$os.Caption } `
              elseif ($regOs.ProductName) { [string]$regOs.ProductName } `
              else { "Windows" }

    $osVersion = if ($os -and $os.Version) { [string]$os.Version } `
                 elseif ($regOs.DisplayVersion) { "$($regOs.DisplayVersion) ($($regOs.CurrentBuild))" } `
                 elseif ($regOs.CurrentBuild) { [string]$regOs.CurrentBuild } `
                 else { "" }

    $currentUser = if ($comp -and $comp.UserName) { [string]$comp.UserName } else { "$env:USERDOMAIN\$env:USERNAME" }
    Write-Host " OK" -ForegroundColor Green

    # B. MẠNG (ƯU TIÊN .NET NETWORKINTERFACE - CHẠY 100% KHÔNG CẦN WMI, TRÁNH LỖI 127.0.0.1)
    Write-Host "[2/8] Quet mang (Active)..." -NoNewline
    $finalIP = "127.0.0.1"; $finalMac = ""
    
    try {
        # 1. Quét bằng .NET NetworkInterface (Chuẩn trên mọi bản Windows, không bao giờ bị Invalid Class WMI)
        $nics = [System.Net.NetworkInformation.NetworkInterface]::GetAllNetworkInterfaces() | Where-Object {
            $_.OperationalStatus.ToString() -eq "Up" -and `
            $_.NetworkInterfaceType.ToString() -ne "Loopback" -and `
            $_.NetworkInterfaceType.ToString() -ne "Tunnel"
        }
        foreach ($n in $nics) {
            $ipProps = $n.GetIPProperties()
            $hasGateway = ($ipProps.GatewayAddresses | Where-Object { $_.Address.ToString() -ne "0.0.0.0" }).Count -gt 0
            $ipv4Obj = $ipProps.UnicastAddresses | Where-Object {
                $_.Address.AddressFamily.ToString() -eq "InterNetwork" -and `
                $_.Address.ToString() -notmatch "^169\.254\." -and `
                $_.Address.ToString() -ne "127.0.0.1"
            } | Select-Object -First 1

            if ($ipv4Obj) {
                $candidateIP = $ipv4Obj.Address.ToString()
                $rawMac = $n.GetPhysicalAddress().ToString()
                $formattedMac = if ($rawMac.Length -eq 12) { ($rawMac -split '(?<=\G..)(?=.)' -join ':') } else { $rawMac }
                
                # Ưu tiên card mạng có Default Gateway (kết nối ra router/LAN thật)
                if ($hasGateway) {
                    $finalIP = $candidateIP
                    $finalMac = $formattedMac
                    break
                } elseif ($finalIP -eq "127.0.0.1") {
                    $finalIP = $candidateIP
                    $finalMac = $formattedMac
                }
            }
        }
    } catch {}

    # 2. Fallback WMI nếu .NET chưa lấy được
    if ($finalIP -eq "127.0.0.1") {
        try {
            $activeNics = Get-WmiObject Win32_NetworkAdapter -ErrorAction SilentlyContinue | Where-Object { $_.NetConnectionStatus -eq 2 }
            foreach ($nic in $activeNics) {
                $config = Get-WmiObject Win32_NetworkAdapterConfiguration -ErrorAction SilentlyContinue | Where-Object { $_.Index -eq $nic.Index }
                if ($config.DefaultIPGateway) {
                    $finalIP = $config.IPAddress | Where-Object { $_ -match '\.' } | Select-Object -First 1
                    $finalMac = $nic.MACAddress
                    break
                }
            }
        } catch {}
    }
    Write-Host " OK ($finalIP)" -ForegroundColor Green

    # C. PHÂN LOẠI
    $detectedType = "PC"
    if ($osName -match "Server") { $detectedType = "SERVER" }
    else {
        try {
            $chassis = (Get-WmiObject Win32_SystemEnclosure -ErrorAction SilentlyContinue).ChassisTypes
            if ($chassis -contains 8 -or $chassis -contains 9 -or $chassis -contains 10 -or $chassis -contains 14) {
                $detectedType = "LAPTOP"
            }
        } catch {}
    }

    # D. RAM CHI TIẾT & TỔNG DUNG LƯỢNG RAM (KHÔNG BAO GIỜ BỊ 0 GB KHI WMI HỎNG)
    Write-Host "[3/8] Quet RAM..." -NoNewline
    $ramGB = 0
    if ($comp -and $comp.TotalPhysicalMemory) {
        $ramGB = [math]::Round($comp.TotalPhysicalMemory / 1GB, 0)
    }
    if ($ramGB -le 0) {
        try {
            Add-Type -AssemblyName Microsoft.VisualBasic -ErrorAction SilentlyContinue
            $ci = New-Object Microsoft.VisualBasic.Devices.ComputerInfo
            if ($ci.TotalPhysicalMemory) {
                $ramGB = [math]::Round($ci.TotalPhysicalMemory / 1GB, 0)
            }
        } catch {}
    }

    $ramDetails = @()
    try {
        $pMem = Get-WmiObject Win32_PhysicalMemory -ErrorAction SilentlyContinue
        if ($pMem) {
            foreach ($stick in $pMem) {
                $busSpeed = if ($stick.Speed) { $stick.Speed } else { "Unknown" }
                $capacityGB = [math]::Round($stick.Capacity / 1GB, 0)
                $ramDetails += @{ Slot = $stick.BankLabel; Capacity = "${capacityGB}GB"; Speed = "${busSpeed}MHz"; Manufacturer = $stick.Manufacturer }
            }
        }
    } catch {}

    if ($ramDetails.Count -eq 0 -and $ramGB -gt 0) {
        $ramDetails += @{ Slot = "Slot 1"; Capacity = "${ramGB}GB"; Speed = "Standard"; Manufacturer = "System RAM" }
    }
    Write-Host " OK (${ramGB}GB)" -ForegroundColor Green

    # E. GPU
    Write-Host "[4/8] Quet GPU..." -NoNewline
    $gpuList = @()
    try {
        $gpus = Get-WmiObject Win32_VideoController -ErrorAction SilentlyContinue
        if ($gpus) {
            foreach ($g in $gpus) {
                $vram = "N/A"
                if ($g.AdapterRAM -gt 0) { $vram = "$([math]::Round($g.AdapterRAM / 1GB, 1)) GB" }
                $gpuList += @{ Name = $g.Name; VRAM = $vram; DriverVersion = $g.DriverVersion }
            }
        }
    } catch {}
    if ($gpuList.Count -eq 0) {
        # Fallback Registry Display Adapters nếu WMI lỗi
        try {
            $videoReg = Get-ItemProperty 'HKLM:\SYSTEM\CurrentControlSet\Control\Class\{4d36e968-e325-11ce-bfc1-08002be10318}\0*' -ErrorAction SilentlyContinue | Where-Object { $_.DriverDesc }
            foreach ($v in $videoReg) {
                $gpuList += @{ Name = [string]$v.DriverDesc; VRAM = "N/A"; DriverVersion = [string]$v.DriverVersion }
            }
        } catch {}
    }
    Write-Host " OK" -ForegroundColor Green

    # =========================================================================
    # F. THIẾT BỊ NGOẠI VI (DEEP SCAN - PnP Entity)
    # =========================================================================
    Write-Host "[5/8] Quet Chuot/Phim (Deep Scan)..." -NoNewline
    $peripheralList = @()
    try {
        # Dùng Win32_PnPEntity thay vì Get-PnpDevice để lấy tên chuẩn hơn
        $pnpEntities = Get-WmiObject Win32_PnPEntity -ErrorAction SilentlyContinue | Where-Object { 
            ($_.PNPClass -eq "Keyboard" -or $_.PNPClass -eq "Mouse") -and $_.Status -eq "OK" 
        }
        
        if ($pnpEntities) {
            foreach ($p in $pnpEntities) {
                # Lọc bỏ thiết bị ảo
                if ($p.Name -notmatch "Terminal Server" -and $p.Name -notmatch "Remote Desktop") {
                    
                    $rawName = $p.Name
                    $brand = "Unknown"
                    $connType = "Other"

                    # 1. Phân tích VID để lấy Brand
                    if ($p.DeviceID -match "VID_([0-9A-F]{4})") {
                        $vid = $matches[1]
                        if ($VendorLookup.ContainsKey($vid)) { $brand = $VendorLookup[$vid] }
                    }

                    # 2. Xác định kết nối
                    if ($p.DeviceID -match "USB") { $connType = "USB" }
                    elseif ($p.DeviceID -match "BTH") { $connType = "Bluetooth" }
                    elseif ($p.DeviceID -match "Unifying") { $connType = "Wireless (Unifying)" }

                    # 3. Xử lý tên hiển thị
                    if ($rawName -match "HID-compliant" -or $rawName -match "Standard") {
                        if ($brand -ne "Unknown") {
                            $rawName = "$brand Device ($rawName)"
                        }
                    }
                    
                    $exists = $false
                    foreach ($item in $peripheralList) {
                        if ($item.Id -eq $p.DeviceID) { $exists = $true; break }
                    }

                    if (-not $exists) {
                        $peripheralList += @{ 
                            Name = $rawName
                            Type = $p.PNPClass 
                            Brand = $brand 
                            Connection = $connType 
                            Id = $p.DeviceID 
                        }
                    }
                }
            }
        }
    } catch {}
    Write-Host " OK" -ForegroundColor Green

    # G. PHẦN MỀM (ĐÃ TỐI ƯU: GOM NHÓM OFFICE & LOẠI BỎ GÓI PHỤ TRỢ, TƯƠNG THÍCH WIN7 32/64-BIT)
    Write-Host "[6/8] Quet phan mem..." -NoNewline
    $softwareList = @()
    $softwareMap = @{}
    $regPaths = @(
        "HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\*",
        "HKLM:\SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall\*",
        "HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\*"
    )
    $rawInstalled = @()
    foreach ($rp in $regPaths) {
        $parentPath = $rp -replace "\\\*$", ""
        if (Test-Path $parentPath) {
            $rawInstalled += @(Get-ItemProperty $rp -ErrorAction SilentlyContinue)
        }
    }
    $installed = $rawInstalled | Where-Object {
        $_ -ne $null -and $_.DisplayName -ne $null -and $_.SystemComponent -ne 1 -and -not $_.ParentKeyName
    } | Sort-Object -Property DisplayName -Unique

    foreach ($app in $installed) {
        $norm = Get-NormalizedSoftware -RawName $app.DisplayName -RawVersion $app.DisplayVersion -RawPublisher $app.Publisher
        if ($norm -ne $null) {
            $key = $norm.Key
            if (-not $softwareMap.ContainsKey($key)) {
                $softwareMap[$key] = @{
                    Name      = $norm.Name
                    Version   = if ($norm.Version) { $norm.Version } else { "" }
                    Publisher = if ($norm.Publisher) { $norm.Publisher } else { "" }
                }
            }
        }
    }

    # Fallback: Nếu máy cài Office (Click-to-Run hoặc MSI ẩn) mà chưa bắt được tên bộ chính
    if (-not $softwareMap.ContainsKey("MS_OFFICE_SUITE")) {
        $c2rPaths = @(
            "HKLM:\SOFTWARE\Microsoft\Office\ClickToRun\Configuration",
            "HKLM:\SOFTWARE\WOW6432Node\Microsoft\Office\ClickToRun\Configuration"
        )
        foreach ($c2rPath in $c2rPaths) {
            $c2r = Get-ItemProperty $c2rPath -ErrorAction SilentlyContinue
            if ($c2r -and ($c2r.ProductReleaseIds -or $c2r.VersionToReport)) {
                $relId = if ($c2r.ProductReleaseIds) { ($c2r.ProductReleaseIds -split ",")[0].Trim() } else { "" }
                $ver = if ($c2r.VersionToReport) { $c2r.VersionToReport } else { $c2r.ClientVersionToReport }
                $officeTitle = "Microsoft Office"
                if ($relId -match "O365|M365") { $officeTitle = "Microsoft 365 (Office)" }
                elseif ($relId -match "2024") { $officeTitle = "Microsoft Office 2024" }
                elseif ($relId -match "2021") { $officeTitle = "Microsoft Office 2021" }
                elseif ($relId -match "2019") { $officeTitle = "Microsoft Office 2019" }
                elseif ($relId -match "2016") { $officeTitle = "Microsoft Office 2016" }
                $softwareMap["MS_OFFICE_SUITE"] = @{
                    Name      = $officeTitle
                    Version   = if ($ver) { $ver } else { "" }
                    Publisher = "Microsoft Corporation"
                }
                break
            }
        }
    }

    # Nếu vẫn chưa có trong ClickToRun nhưng có gói MUI/Word/Excel của Office MSI cũ (2010/2013/2016)
    if (-not $softwareMap.ContainsKey("MS_OFFICE_SUITE")) {
        $officeComp = $installed | Where-Object { $_.DisplayName -match "^Microsoft Office .*(MUI|Proofing|Shared|Word|Excel|Outlook)" } | Select-Object -First 1
        if ($officeComp) {
            $ver = $officeComp.DisplayVersion
            $year = ""
            if ($ver -match "^16\.") { $year = "2016/2019" }
            elseif ($ver -match "^15\.") { $year = "2013" }
            elseif ($ver -match "^14\.") { $year = "2010" }
            elseif ($ver -match "^12\.") { $year = "2007" }
            $officeName = if ($year) { "Microsoft Office $year" } else { "Microsoft Office" }
            $softwareMap["MS_OFFICE_SUITE"] = @{
                Name      = $officeName
                Version   = if ($ver) { $ver } else { "" }
                Publisher = "Microsoft Corporation"
            }
        }
    }

    $softwareList = @($softwareMap.Values | Sort-Object { $_.Name })
    Write-Host " OK ($($softwareList.Count) apps)" -ForegroundColor Green

    # H. Ổ CỨNG, SỨC KHỎE PHẦN CỨNG (CPU/RAM/DISK S.M.A.R.T) & MÀN HÌNH
    Write-Host "[7/8] Quet Suc khoe CPU, RAM, O cung (S.M.A.R.T) & Man hinh..." -NoNewline
    $hardwareAlerts = @()

    # 1. Kiểm tra S.M.A.R.T PredictFailure từ WMI (Hoạt động trên cả Win 7, 10, 11)
    $smartFailureDetected = $false
    try {
        $smartStatuses = @(Get-WmiObject -Namespace root\wmi -Class MSStorageDriver_FailurePredictStatus -ErrorAction SilentlyContinue)
        foreach ($st in $smartStatuses) {
            if ($null -ne $st -and $st.PredictFailure -eq $true) {
                $smartFailureDetected = $true
            }
        }
    } catch {}

    # 2. Quét danh sách Ổ cứng vật lý + Trạng thái Sức khỏe từng ổ
    $diskList = @()
    $usedPhysicalDisk = $false
    $anyDiskCritical = $false
    $anyDiskWarning = $false

    if (Get-Command Get-PhysicalDisk -ErrorAction SilentlyContinue) {
        try {
            $pDisks = @(Get-PhysicalDisk | Sort-Object DeviceId -ErrorAction Stop)
            foreach ($d in $pDisks) {
                $rawHealth = if ($d.HealthStatus) { [string]$d.HealthStatus } else { "Healthy" }
                $opStatus  = if ($d.OperationalStatus) { ([string]$d.OperationalStatus) } else { "OK" }
                $dHealth   = "GOOD"
                $dHealthText = "Tot (Healthy)"

                if ($rawHealth -match "Unhealthy" -or $opStatus -match "Error|Failed|Lost|Predictive" -or $smartFailureDetected) {
                    $dHealth = "CRITICAL"
                    $dHealthText = "NGUY HIEM: Sap hong ($rawHealth)"
                    $anyDiskCritical = $true
                    $hardwareAlerts += "O cung [$($d.FriendlyName)] bao loi S.M.A.R.T ($rawHealth) - Can sao luu ngay!"
                } elseif ($rawHealth -match "Warning" -or $opStatus -match "Degraded|Stressed") {
                    $dHealth = "WARNING"
                    $dHealthText = "Canh bao ($rawHealth)"
                    $anyDiskWarning = $true
                    $hardwareAlerts += "O cung [$($d.FriendlyName)] o trang thai Canh bao ($rawHealth)"
                }

                $diskList += @{
                    Index        = [int]$d.DeviceId
                    Model        = [string]$d.FriendlyName
                    MediaType    = [string]$d.MediaType
                    SizeGB       = [math]::Round($d.Size / 1GB, 0)
                    Interface    = [string]$d.BusType
                    SerialNumber = if ($d.SerialNumber) { $d.SerialNumber.Trim() } else { "N/A" }
                    HealthStatus = $dHealth
                    HealthText   = $dHealthText
                }
            }
            if ($diskList.Count -gt 0) { $usedPhysicalDisk = $true }
        } catch {}
    }
    if (-not $usedPhysicalDisk) {
        # Fallback WMI chuẩn cho Windows 7 / Windows Server 2008 R2
        try {
            $wmiDisks = @(Get-WmiObject Win32_DiskDrive -ErrorAction SilentlyContinue | Sort-Object Index)
            foreach ($d in $wmiDisks) {
                $mediaType = if ($d.Model -match "SSD|NVMe|Solid") { "SSD" } else { "HDD" }
                $wmiStatus = if ($d.Status) { ([string]$d.Status).Trim() } else { "OK" }
                $dHealth = "GOOD"
                $dHealthText = "Tot (S.M.A.R.T OK)"

                if ($wmiStatus -match "Pred Fail|Error|Fail" -or $smartFailureDetected) {
                    $dHealth = "CRITICAL"
                    $dHealthText = "NGUY HIEM: Sap hong ($wmiStatus)"
                    $anyDiskCritical = $true
                    $hardwareAlerts += "O cung [$($d.Model)] bao loi S.M.A.R.T ($wmiStatus) - Can kiem tra/thay the!"
                } elseif ($wmiStatus -ne "OK") {
                    $dHealth = "WARNING"
                    $dHealthText = "Canh bao ($wmiStatus)"
                    $anyDiskWarning = $true
                }

                $diskList += @{
                    Index        = [int]$d.Index
                    Model        = [string]$d.Model
                    MediaType    = $mediaType
                    SizeGB       = [math]::Round($d.Size / 1GB, 0)
                    Interface    = [string]$d.InterfaceType
                    SerialNumber = if ($d.SerialNumber) { ([string]$d.SerialNumber).Trim() } else { "N/A" }
                    HealthStatus = $dHealth
                    HealthText   = $dHealthText
                }
            }
        } catch {}
    }

    # 3. Quét Dung lượng & Sức khỏe các phân vùng ổ đĩa (C:, D:, E:...)
    $logicalVolumes = @()
    try {
        $lDisks = @(Get-WmiObject Win32_LogicalDisk -Filter "DriveType=3" -ErrorAction SilentlyContinue)
        foreach ($ld in $lDisks) {
            if ($null -eq $ld -or -not $ld.Size -or $ld.Size -le 0) { continue }
            $totalGB = [math]::Round($ld.Size / 1GB, 1)
            $freeGB  = [math]::Round($ld.FreeSpace / 1GB, 1)
            $usedPct = [math]::Round((($ld.Size - $ld.FreeSpace) / $ld.Size) * 100, 0)
            $vStatus = "GOOD"
            if ($usedPct -ge 95 -or $freeGB -lt 3) {
                $vStatus = "CRITICAL"
                $anyDiskWarning = $true
                $hardwareAlerts += "Phan vung $($ld.DeviceID) sap het dung luong (Con trong ${freeGB} GB / ${totalGB} GB - Da dung ${usedPct}%)"
            } elseif ($usedPct -ge 88 -or $freeGB -lt 10) {
                $vStatus = "WARNING"
                $anyDiskWarning = $true
                $hardwareAlerts += "Phan vung $($ld.DeviceID) con it dung luong trong (${freeGB} GB - Da dung ${usedPct}%)"
            }
            $logicalVolumes += @{
                drive       = [string]$ld.DeviceID
                label       = if ($ld.VolumeName) { [string]$ld.VolumeName } else { "Local Disk" }
                totalGB     = $totalGB
                freeGB      = $freeGB
                usedPercent = [int]$usedPct
                status      = $vStatus
            }
        }
    } catch {}

    # 4. Chẩn đoán Sức khỏe CPU
    $cpuLoad = if ($null -ne $cpu.LoadPercentage) { [int]$cpu.LoadPercentage } else { 10 }
    $cpuWmiStatus = if ($cpu.Status) { ([string]$cpu.Status).Trim() } else { "OK" }
    $cpuTempC = $null
    try {
        $tz = @(Get-WmiObject -Namespace root\wmi -Class MSAcpi_ThermalZoneTemperature -ErrorAction SilentlyContinue)[0]
        if ($tz -and $tz.CurrentTemperature -gt 2732) {
            $cpuTempC = [math]::Round(($tz.CurrentTemperature / 10.0) - 273.15, 0)
        }
    } catch {}

    $cpuHealthStatus = "GOOD"
    $cpuHealthText   = "Tot (Hoat dong on dinh)"
    if ($cpuWmiStatus -ne "OK" -and $cpuWmiStatus -ne "") {
        $cpuHealthStatus = "CRITICAL"
        $cpuHealthText   = "Loi CPU ($cpuWmiStatus)"
        $hardwareAlerts += "CPU bao trang thai bat thuong: $cpuWmiStatus"
    } elseif (($null -ne $cpuTempC -and $cpuTempC -ge 88) -or $cpuLoad -ge 95) {
        $cpuHealthStatus = "WARNING"
        $cpuHealthText   = if ($cpuTempC) { "Tai cao (${cpuLoad}% - ${cpuTempC}C)" } else { "Tai cao (${cpuLoad}%)" }
    }

    $cpuHealth = @{
        status        = $cpuHealthStatus
        statusText    = $cpuHealthText
        loadPercent   = $cpuLoad
        cores         = if ($cpu.NumberOfCores) { [int]$cpu.NumberOfCores } else { 1 }
        threads       = if ($cpu.NumberOfLogicalProcessors) { [int]$cpu.NumberOfLogicalProcessors } else { 1 }
        clockSpeedMHz = if ($cpu.MaxClockSpeed) { [int]$cpu.MaxClockSpeed } else { 0 }
        temperatureC  = $cpuTempC
    }

    # 5. Chẩn đoán Sức khỏe RAM
    $totalRamGB = [math]::Round($comp.TotalPhysicalMemory / 1GB, 1)
    $freeRamGB  = if ($os.FreePhysicalMemory) { [math]::Round(($os.FreePhysicalMemory * 1KB) / 1GB, 1) } else { [math]::Round($totalRamGB * 0.4, 1) }
    $usedRamGB  = [math]::Max(0, [math]::Round($totalRamGB - $freeRamGB, 1))
    $ramUsagePct = if ($totalRamGB -gt 0) { [int][math]::Round(($usedRamGB / $totalRamGB) * 100, 0) } else { 50 }

    $ramHealthStatus = "GOOD"
    $ramHealthText   = "Tot (Con trong ${freeRamGB} GB)"
    if ($ramUsagePct -ge 95) {
        $ramHealthStatus = "WARNING"
        $ramHealthText   = "Day RAM (${ramUsagePct}% - Can nang cap)"
        $hardwareAlerts += "RAM dang su dung ${ramUsagePct}% (${usedRamGB}/${totalRamGB} GB) - De gay treo lag may"
    } elseif ($ramUsagePct -ge 85 -or $totalRamGB -lt 4) {
        $ramHealthStatus = "WARNING"
        $ramHealthText   = "Su dung cao (${ramUsagePct}%)"
    }

    $ramHealth = @{
        status       = $ramHealthStatus
        statusText   = $ramHealthText
        totalGB      = $totalRamGB
        usedGB       = $usedRamGB
        freeGB       = $freeRamGB
        usagePercent = $ramUsagePct
        slotsUsed    = $ramDetails.Count
    }

    # 6. Tổng hợp Sức khỏe Toàn máy (Overall Hardware Health)
    $overallHealthStatus = "GOOD"
    $overallHealthText   = "Phan cung hoat dong Tot"
    if ($anyDiskCritical -or $cpuHealthStatus -eq "CRITICAL") {
        $overallHealthStatus = "CRITICAL"
        $overallHealthText   = "NGUY HIEM: Co loi phan cung (O cung/CPU)!"
    } elseif ($anyDiskWarning -or $ramHealthStatus -eq "WARNING" -or $cpuHealthStatus -eq "WARNING") {
        $overallHealthStatus = "WARNING"
        $overallHealthText   = "Can chu y (Day o dia / Tai RAM cao)"
    }

    $diskOverallStatus = if ($anyDiskCritical) { "CRITICAL" } elseif ($anyDiskWarning) { "WARNING" } else { "GOOD" }
    $diskOverallText   = if ($anyDiskCritical) { "Nguy co hong o cung (S.M.A.R.T)" } elseif ($anyDiskWarning) { "Can don dep dung luong" } else { "Tot (S.M.A.R.T OK)" }

    $hardwareHealth = @{
        overallStatus  = $overallHealthStatus
        overallText    = $overallHealthText
        cpu            = $cpuHealth
        ram            = $ramHealth
        diskStatus     = $diskOverallStatus
        diskText       = $diskOverallText
        logicalVolumes = $logicalVolumes
        alerts         = $hardwareAlerts
        checkedAt      = (Get-Date).ToString("yyyy-MM-dd HH:mm:ss")
    }

    $monitorList = @()
    try {
        $wmiMonitors = @(Get-WmiObject -Namespace root\wmi -Class WmiMonitorID -ErrorAction SilentlyContinue)
        $wmiSizes    = @(Get-WmiObject -Namespace root\wmi -Class WmiMonitorBasicDisplayParams -ErrorAction SilentlyContinue)
        if ($wmiMonitors.Count -gt 0) {
            foreach ($m in $wmiMonitors) {
                if ($null -eq $m) { continue }
                $Manufacturer = ConvertFrom-WmiChars $m.ManufacturerName
                $Model        = ConvertFrom-WmiChars $m.UserFriendlyName
                $Serial       = ConvertFrom-WmiChars $m.SerialNumberID
                if (-not $Model) { $Model = "Generic Monitor" }
                if (-not $Serial) { $Serial = "N/A" }
                $sizeInfo = $wmiSizes | Where-Object { $_.InstanceName -eq $m.InstanceName } | Select-Object -First 1
                $screenSize = "N/A"
                if ($sizeInfo) {
                    $width = $sizeInfo.MaxHorizontalImageSize; $height = $sizeInfo.MaxVerticalImageSize
                    if ($width -gt 0 -and $height -gt 0) { $diag = [math]::Sqrt([math]::Pow($width, 2) + [math]::Pow($height, 2)) / 2.54; $screenSize = "$([math]::Round($diag, 1)) inch" }
                }
                $monitorList += @{ Manufacturer = $Manufacturer; Model = $Model; SerialNumber = $Serial; ScreenSize = $screenSize; Source = "WMI" }
            }
        }
    } catch {}
    Write-Host " OK ($overallHealthStatus)" -ForegroundColor Green

    # H2. QUÉT BẢN QUYỀN WINDOWS, OFFICE & CÁC PHẦN MỀM ĐƯỢC CÀI TRÊN MÁY
    Write-Host "[8/8] Quet ban quyen Windows, Office & Phan mem tren may..." -NoNewline
    $osLicenseInfo = @{
        productName = [string]$os.Caption
        status      = "UNLICENSED"
        channel     = "UNKNOWN"
        partialKey  = ""
        oemKey      = ""
    }
    $officeLicenseInfo = $null
    $detectedSoftwareLicenses = @()

    try {
        $sls = @(Get-WmiObject SoftwareLicensingService -ErrorAction SilentlyContinue)[0]
        if ($sls -and $sls.OA3xOriginalProductKey) {
            $osLicenseInfo.oemKey = ([string]$sls.OA3xOriginalProductKey).Trim()
        }

        $licProducts = @(Get-WmiObject SoftwareLicensingProduct -Filter "PartialProductKey IS NOT NULL" -ErrorAction SilentlyContinue)
        foreach ($lp in $licProducts) {
            if ($null -eq $lp -or -not $lp.Name) { continue }
            $lpName = [string]$lp.Name
            $lpDesc = [string]$lp.Description
            $lpStatus = if ($lp.LicenseStatus -eq 1) { "LICENSED" } else { "UNLICENSED" }
            $lpStatusText = if ($lp.LicenseStatus -eq 1) { "Da kich hoat (Licensed)" } elseif ($lp.LicenseStatus -eq 2 -or $lp.LicenseStatus -eq 3) { "Dung thu (Grace/Trial)" } else { "Chua kich hoat (Unlicensed)" }
            $lpKey = if ($lp.PartialProductKey) { ([string]$lp.PartialProductKey).Trim() } else { "" }

            $channel = "RETAIL"
            if ($lpDesc -match "OEM") { $channel = "OEM" }
            elseif ($lpDesc -match "VOLUME_KMSCLIENT|KMS") { $channel = "VOLUME_KMS" }
            elseif ($lpDesc -match "VOLUME_MAK|MAK") { $channel = "VOLUME_MAK" }

            if ($lpName -match "Windows" -or ([string]$lp.ApplicationId) -eq "55c92734-d682-4d71-983e-d6ec3f16059f") {
                if ($osLicenseInfo.status -ne "LICENSED" -or $lpStatus -eq "LICENSED") {
                    $osLicenseInfo.productName = $lpName
                    $osLicenseInfo.status      = $lpStatus
                    $osLicenseInfo.channel     = $channel
                    $osLicenseInfo.partialKey  = $lpKey
                }
            } elseif ($lpName -match "Office|Visio|Project") {
                if ($null -eq $officeLicenseInfo -or $lpStatus -eq "LICENSED") {
                    $officeLicenseInfo = @{
                        productName = $lpName
                        status      = $lpStatus
                        channel     = $channel
                        partialKey  = $lpKey
                    }
                }
            }

            $detectedSoftwareLicenses += @{
                softwareName = $lpName
                status       = $lpStatus
                statusText   = $lpStatusText
                channel      = $channel
                partialKey   = if ($lpKey) { "*****-$lpKey" } else { "" }
                source       = "WMI_SPP"
            }
        }
    } catch {}

    # Quét trạng thái bảo vệ & bản quyền Kaspersky trên máy (nếu có cài Kaspersky)
    try {
        $hasKaspersky = $softwareList | Where-Object { $_.Name -match "Kaspersky" } | Select-Object -First 1
        $kaspService  = @(Get-Service -Name "AVP*","kes*","klnagent" -ErrorAction SilentlyContinue | Where-Object { $_.Status -eq "Running" })[0]
        if ($hasKaspersky -or $kaspService) {
            $kaspStatus = if ($kaspService) { "LICENSED" } else { "WARNING" }
            $kaspText   = if ($kaspService) { "Dang bao ve (Service Running)" } else { "Da cai nhung Dich vu dang tat" }
            $detectedSoftwareLicenses += @{
                softwareName = if ($hasKaspersky) { [string]$hasKaspersky.Name } else { "Kaspersky Endpoint Security" }
                status       = $kaspStatus
                statusText   = $kaspText
                channel      = "ENDPOINT_AGENT"
                partialKey   = if ($hasKaspersky -and $hasKaspersky.Version) { "v$($hasKaspersky.Version)" } else { "" }
                source       = "SERVICE_CHECK"
            }
        }
    } catch {}

    # Quét bản quyền Autodesk (AutoCAD / Inventor / Revit) từ Registry (nếu có cài)
    try {
        $adskPaths = @("HKLM:\SOFTWARE\Autodesk\AutoCAD", "HKLM:\SOFTWARE\WOW6432Node\Autodesk\AutoCAD")
        foreach ($ap in $adskPaths) {
            if (Test-Path $ap) {
                $subKeys = @(Get-ChildItem -Path $ap -Recurse -ErrorAction SilentlyContinue)
                foreach ($sk in $subKeys) {
                    try {
                        $props = Get-ItemProperty -Path $sk.PSPath -ErrorAction SilentlyContinue
                        if ($props -and ($props.SerialNumber -or $props.ProductName)) {
                            $sn = [string]$props.SerialNumber
                            if ($sn -and $sn -ne "000-00000000") {
                                $detectedSoftwareLicenses += @{
                                    softwareName = if ($props.ProductName) { [string]$props.ProductName } else { "Autodesk AutoCAD" }
                                    status       = "LICENSED"
                                    statusText   = "Co Serial tren may"
                                    channel      = if ($props.StandaloneNetworkType -eq 1) { "STANDALONE" } else { "VOLUME" }
                                    partialKey   = $sn
                                    source       = "REGISTRY"
                                }
                                break
                            }
                        }
                    } catch {}
                }
            }
        }
    } catch {}

    Write-Host " OK ($($osLicenseInfo.status), $($detectedSoftwareLicenses.Count) licenses)" -ForegroundColor Green

    # I. GỬI DỮ LIỆU (HỖ TRỢ CẢ POWERSHELL 2.0 WINDOWS 7 & POWERSHELL 5.1 WINDOWS 10/11)
    $hostNameStr = if ($comp -and $comp.Name) { [string]$comp.Name } else { $env:COMPUTERNAME }

    $payload = @{
        serialNumber = [string]$serialNum
        hostname     = [string]$hostNameStr
        username     = [string]$currentUser
        model        = [string]$model
        manufacturer = [string]$manufacturer
        osName       = [string]$osName
        osVersion    = [string]$osVersion
        cpuName      = [string]$cpuName
        ramGB        = [int]$ramGB
        
        ramDetails       = $ramDetails      
        gpus             = $gpuList         
        peripherals      = $peripheralList 
        osLicense        = $osLicenseInfo
        officeLicense    = $officeLicenseInfo
        softwareLicenses = $detectedSoftwareLicenses
        hardwareHealth   = $hardwareHealth
        
        disks        = $diskList
        monitors     = $monitorList
        software     = $softwareList
        ipAddress    = [string]$finalIP
        macAddress   = [string]$finalMac
        deviceType   = [string]$detectedType 
        timestamp    = (Get-Date).ToString("yyyy-MM-dd HH:mm:ss")
    }

    $jsonPayload = ConvertTo-JsonCompat -InputObject $payload
    Write-Host "`n>>> GUI DU LIEU VE SERVER ($ApiUrl)..." -ForegroundColor Yellow
    
    # Retry Logic (3 Times, tự động dự phòng qua cổng 90 nếu cổng 3000 bị chặn)
    $maxRetries = 3; $retryCount = 0; $success = $false
    while (-not $success -and $retryCount -lt $maxRetries) {
        foreach ($targetUrl in $CandidateApiUrls) {
            if ($success) { break }
            try {
                $respText = Send-AgentPayload -Uri $targetUrl -JsonBody $jsonPayload -SecretKey $AgentSecretKey
                Write-Host " SUCCESS: Dong bo thanh cong ($hostNameStr -> $targetUrl)!" -ForegroundColor Green
                $success = $true
            } catch {
                $lastErr = $_.Exception.Message
            }
        }
        if (-not $success) {
            $retryCount++
            Write-Host " FAILED ($retryCount/$maxRetries): $lastErr" -ForegroundColor Red
            if ($retryCount -lt $maxRetries) { Start-Sleep -Seconds (5 * $retryCount) }
        }
    }

} catch {
    Write-Host "ERROR: $($_.Exception.Message)" -ForegroundColor Red
    Read-Host "Press Enter..."
}