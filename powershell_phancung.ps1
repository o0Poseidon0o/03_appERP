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

    # D. RAM CHI TIẾT, LOẠI DDR (DDR3/DDR4/DDR5) & TỔNG DUNG LƯỢNG RAM CHÍNH XÁC
    Write-Host "[3/8] Quet RAM (Dung luong & DDR Generation)..." -NoNewline

    # Bảng mã JEDEC Manufacturer ID (Hex) phổ biến trong SMBIOS/SPD của thanh RAM
    $RamJedecMap = @{
        "04CD" = "G.Skill";     "CD04" = "G.Skill"
        "0198" = "Kingston";    "9801" = "Kingston"; "7F98" = "Kingston"; "019800000000" = "Kingston"
        "80AD" = "SK Hynix";    "AD80" = "SK Hynix"; "00AD" = "SK Hynix"; "AD00" = "SK Hynix"
        "80CE" = "Samsung";     "CE80" = "Samsung";  "00CE" = "Samsung";  "CE00" = "Samsung"
        "802C" = "Micron";      "2C80" = "Micron";   "002C" = "Micron";   "2C00" = "Micron"
        "859B" = "Crucial";     "9B85" = "Crucial";  "059B" = "Crucial"
        "029E" = "Corsair";     "9E02" = "Corsair"
        "04CB" = "ADATA";       "CB04" = "ADATA"
        "04EF" = "TeamGroup";   "EF04" = "TeamGroup"
        "014F" = "Transcend";   "4F01" = "Transcend"
        "02FE" = "Elpida";      "FE02" = "Elpida"
        "830B" = "Nanya";       "0B83" = "Nanya";    "030B" = "Nanya"
        "075D" = "Lexar";       "86F1" = "Lexar"
        "017A" = "Apacer";      "7A01" = "Apacer"
        "8551" = "Qimonda";     "0551" = "Qimonda";  "80C1" = "Infineon"; "00C1" = "Infineon"
        "0420" = "Patriot";     "8502" = "Patriot";  "0502" = "Patriot"
        "0443" = "GeIL";        "8313" = "Silicon Power"
        "0B92" = "Kingbank";    "8B92" = "Kingbank"; "07E9" = "Netac";    "86D3" = "Puskill"
    }

    function Resolve-RamTypeFromCpu {
        param ([string]$CpuStr)
        if ($CpuStr -match "i[3579]-1[234]\d{2}|Core Ultra|Ryzen [3579] [789]\d{3}") { return "DDR4/DDR5" }
        if ($CpuStr -match "i[3579]-(6|7|8|9|10|11)\d{2}|Ryzen [3579] [12345]\d{3}|Pentium.*G[456]\d{3}|Celeron.*G[3456]\d{3}") { return "DDR4" }
        if ($CpuStr -match "i[357]-[2345]\d{2}|i[357]-\d{3}\b|Pentium.*G[6823]\d{2}|Celeron.*G1\d{2}|Xeon.*E[35]-") { return "DDR3" }
        if ($CpuStr -match "Core\(TM\)2|Pentium\(R\) Dual|Pentium\(R\) 4|Celeron\(R\) CPU E") { return "DDR2" }
        return "DDR4"
    }

    $ciObj = $null
    try {
        Add-Type -AssemblyName Microsoft.VisualBasic -ErrorAction SilentlyContinue
        $ciObj = New-Object Microsoft.VisualBasic.Devices.ComputerInfo
    } catch {}

    $compBytes = 0
    if ($comp -and $comp.TotalPhysicalMemory) {
        $compBytes = [double]$comp.TotalPhysicalMemory
    } elseif ($ciObj -and $ciObj.TotalPhysicalMemory) {
        $compBytes = [double]$ciObj.TotalPhysicalMemory
    }

    $ramDetails = @()
    $sumStickBytes = 0
    $detectedRamType = ""
    $stickIndex = 0

    try {
        $pMem = @(Get-WmiObject Win32_PhysicalMemory -ErrorAction SilentlyContinue)
        foreach ($stick in $pMem) {
            if ($null -eq $stick -or -not $stick.Capacity) { continue }
            $stickIndex++
            $capBytes = [double]$stick.Capacity
            $sumStickBytes += $capBytes

            $capStr = if ($capBytes -ge 1GB) { "$([math]::Round($capBytes / 1GB, 0))GB" } else { "$([math]::Round($capBytes / 1MB, 0))MB" }
            $partNum = if ($stick.PartNumber) { ([string]$stick.PartNumber).Trim() } else { "" }
            if ($partNum -match "^(Unknown|None|0000+|Array|N/A|ToBeFilled|NotSpecified)$") { $partNum = "" }

            # 1. Giải mã hãng sản xuất RAM (Tránh hiển thị mã Hex như 04CD, 80AD, 0198)
            $rawMfg = if ($stick.Manufacturer) { ([string]$stick.Manufacturer).Trim() } else { "" }
            $cleanMfg = $rawMfg.ToUpper()
            if ($RamJedecMap.ContainsKey($cleanMfg)) {
                $mfgName = $RamJedecMap[$cleanMfg]
            } elseif ($cleanMfg.Length -ge 4 -and $RamJedecMap.ContainsKey($cleanMfg.Substring(0, 4))) {
                $mfgName = $RamJedecMap[$cleanMfg.Substring(0, 4)]
            } elseif ($rawMfg -match "^(0000+|Undefined|Unknown|Manufacturer.*|[0-9A-Fa-f]{4,})$" -or $rawMfg -eq "") {
                $mfgName = ""
            } else {
                $mfgName = $rawMfg
            }

            if (-not $mfgName -and $partNum) {
                if ($partNum -match "^(F[2345]-|FA-)") { $mfgName = "G.Skill" }
                elseif ($partNum -match "^(KVR|KHX|HX[34]|KF[45]|ACR|CBD|HP\d)") { $mfgName = "Kingston" }
                elseif ($partNum -match "^(M378|M471|M393|M323|M425|M470)") { $mfgName = "Samsung" }
                elseif ($partNum -match "^(HMT|HMA|HMCG|HYMP|H5)") { $mfgName = "SK Hynix" }
                elseif ($partNum -match "^(CT\d|BL[ES2]?|BALLISTIX)") { $mfgName = "Crucial" }
                elseif ($partNum -match "^(MT\d|MTA|MTC)") { $mfgName = "Micron" }
                elseif ($partNum -match "^(CM[KZXWHS4V]|VENGEANCE|DOMINATOR)") { $mfgName = "Corsair" }
                elseif ($partNum -match "^(AX[45]U|AD[345]|AM[12])") { $mfgName = "ADATA" }
                elseif ($partNum -match "^(TED[345]|TLZ|TF|TEAM)") { $mfgName = "TeamGroup" }
                elseif ($partNum -match "^(TS\d|JM\d)") { $mfgName = "Transcend" }
                elseif ($partNum -match "^NT\d") { $mfgName = "Nanya" }
            }
            if (-not $mfgName) { $mfgName = "Generic RAM" }
            $mfgDisplay = if ($partNum) { "$mfgName ($partNum)" } else { $mfgName }

            # 2. Xác định tốc độ Bus thực tế (Ưu tiên ConfiguredClockSpeed nếu có)
            $rawSpd = 0
            try { if ($stick.ConfiguredClockSpeed -gt 0) { $rawSpd = [int]$stick.ConfiguredClockSpeed } } catch {}
            if ($rawSpd -le 0 -and $stick.Speed -gt 0) { $rawSpd = [int]$stick.Speed }

            # 3. Xác định thế hệ RAM (DDR2 / DDR3 / DDR4 / DDR5 / LPDDR)
            $smbiosType = 0; $memType = 0
            try { if ($stick.SMBIOSMemoryType) { $smbiosType = [int]$stick.SMBIOSMemoryType } } catch {}
            try { if ($stick.MemoryType) { $memType = [int]$stick.MemoryType } } catch {}

            $ddrStr = ""
            if ($smbiosType -eq 34) { $ddrStr = "DDR5" }
            elseif ($smbiosType -eq 35) { $ddrStr = "LPDDR5" }
            elseif ($smbiosType -eq 26) { $ddrStr = "DDR4" }
            elseif ($smbiosType -eq 30) { $ddrStr = "LPDDR4" }
            elseif ($smbiosType -eq 24) { $ddrStr = "DDR3" }
            elseif ($smbiosType -eq 29) { $ddrStr = "LPDDR3" }
            elseif ($smbiosType -eq 21 -or $smbiosType -eq 22) { $ddrStr = "DDR2" }
            elseif ($smbiosType -eq 28) { $ddrStr = "LPDDR2" }
            elseif ($smbiosType -eq 20) { $ddrStr = "DDR" }

            if (-not $ddrStr) {
                if ($memType -eq 26) { $ddrStr = "DDR4" }
                elseif ($memType -eq 24) { $ddrStr = "DDR3" }
                elseif ($memType -eq 21 -or $memType -eq 22) { $ddrStr = "DDR2" }
                elseif ($memType -eq 20) { $ddrStr = "DDR" }
            }

            if (-not $ddrStr -and $partNum) {
                if ($partNum -match "DDR5|PC5|^F5-|^KF5|^M323|^M425|^HMCG|^MTC|D5") { $ddrStr = "DDR5" }
                elseif ($partNum -match "DDR4|PC4|^F4-|^KF4|^HX4|^KVR2[146]|^KVR32|^M378A|^M471A|^HMA[48A]|^MTA|D4") { $ddrStr = "DDR4" }
                elseif ($partNum -match "DDR3|PC3|^F3-|^KHX1|^HX3|^KVR1[036]|^M378B|^M471B|^HMT[134]|D3") { $ddrStr = "DDR3" }
                elseif ($partNum -match "DDR2|PC2|^F2-|^KVR[568]|^M378T|^M470T|^HYMP|D2") { $ddrStr = "DDR2" }
            }

            if (-not $ddrStr -and $rawSpd -gt 0) {
                if ($rawSpd -ge 3800) { $ddrStr = "DDR5" }
                elseif ($rawSpd -ge 1867) { $ddrStr = "DDR4" }
                elseif ($rawSpd -ge 800) {
                    if ($rawSpd -eq 800 -and $cpuName -match "Core\(TM\)2|Pentium\(R\) Dual|Celeron\(R\) CPU E") { $ddrStr = "DDR2" }
                    else { $ddrStr = "DDR3" }
                }
                elseif ($rawSpd -ge 400) {
                    if ($cpuName -match "i[357]-[2345]\d{2}|i[357]-\d{3}\b") { $ddrStr = "DDR3" }
                    else { $ddrStr = "DDR2" }
                }
                else { $ddrStr = "DDR" }
            }

            if (-not $ddrStr) {
                $ddrStr = Resolve-RamTypeFromCpu $cpuName
            }

            # 4. Chuẩn hóa xung nhịp nếu BIOS trả về Half-Rate I/O Clock (ví dụ 667MHz cho DDR3-1333, 1333MHz cho DDR4-2666)
            if ($ddrStr -match "DDR3" -and ($rawSpd -eq 533 -or $rawSpd -eq 667 -or $rawSpd -eq 933)) {
                $rawSpd = $rawSpd * 2
                if ($rawSpd -eq 1334) { $rawSpd = 1333 }
            } elseif ($ddrStr -match "DDR4" -and $rawSpd -ge 933 -and $rawSpd -le 1800) {
                $rawSpd = $rawSpd * 2
                if ($rawSpd -eq 2132 -or $rawSpd -eq 2134) { $rawSpd = 2133 }
                elseif ($rawSpd -eq 2668) { $rawSpd = 2666 }
                elseif ($rawSpd -eq 2932 -or $rawSpd -eq 2934) { $rawSpd = 2933 }
            } elseif ($ddrStr -match "DDR5" -and $rawSpd -ge 2000 -and $rawSpd -le 3600) {
                $rawSpd = $rawSpd * 2
            }

            if (-not $detectedRamType -and $ddrStr) { $detectedRamType = $ddrStr }

            $speedDisplay = if ($rawSpd -gt 0) { "$ddrStr ${rawSpd}MHz" } else { $ddrStr }

            # 5. Tên khe cắm vật lý chuẩn (Ưu tiên DeviceLocator như ChannelA-DIMM0, DIMM 1)
            $devLoc = if ($stick.DeviceLocator) { ([string]$stick.DeviceLocator).Trim() } else { "" }
            $bankLbl = if ($stick.BankLabel) { ([string]$stick.BankLabel).Trim() } else { "" }
            $slotName = if ($devLoc -and $devLoc -notmatch "^(Unknown|None)$") { $devLoc } `
                        elseif ($bankLbl) { $bankLbl } `
                        else { "#$stickIndex" }
            $slotName = ($slotName -replace "^Slot\s*", "").Trim()

            $ramDetails += @{
                Slot         = $slotName
                Capacity     = $capStr
                Type         = $ddrStr
                Speed        = $speedDisplay
                Manufacturer = $mfgDisplay
                PartNumber   = $partNum
            }
        }
    } catch {}

    # 6. Tính tổng dung lượng RAM vật lý chuẩn xác (Ưu tiên tổng các thanh RAM vật lý để không bị hụt do iGPU share RAM)
    $ramGB = 0
    if ($sumStickBytes -gt 0) {
        $ramGB = [int][math]::Round($sumStickBytes / 1GB, 0)
    }
    if ($compBytes -gt 0) {
        $rawCompGB = $compBytes / 1GB
        # Nếu không đọc được từng thanh RAM hoặc máy hàn chết RAM không báo đầy đủ trong SMBIOS
        if ($ramGB -le 0 -or $rawCompGB -gt ($ramGB + 0.8)) {
            if ($rawCompGB -gt 2.8 -and $rawCompGB -le 4.1) { $ramGB = 4 }
            elseif ($rawCompGB -gt 5.1 -and $rawCompGB -le 6.1) { $ramGB = 6 }
            elseif ($rawCompGB -gt 6.5 -and $rawCompGB -le 8.2) { $ramGB = 8 }
            elseif ($rawCompGB -gt 10.5 -and $rawCompGB -le 12.2) { $ramGB = 12 }
            elseif ($rawCompGB -gt 13.8 -and $rawCompGB -le 16.5) { $ramGB = 16 }
            elseif ($rawCompGB -gt 22.0 -and $rawCompGB -le 24.5) { $ramGB = 24 }
            elseif ($rawCompGB -gt 28.0 -and $rawCompGB -le 32.5) { $ramGB = 32 }
            elseif ($rawCompGB -gt 60.0 -and $rawCompGB -le 64.5) { $ramGB = 64 }
            else { $ramGB = [int][math]::Round($rawCompGB, 0) }
        }
    }

    if (-not $detectedRamType) {
        $detectedRamType = Resolve-RamTypeFromCpu $cpuName
    }

    if ($ramDetails.Count -eq 0 -and $ramGB -gt 0) {
        $ramDetails += @{
            Slot         = "1"
            Capacity     = "${ramGB}GB"
            Type         = $detectedRamType
            Speed        = $detectedRamType
            Manufacturer = "System RAM"
            PartNumber   = ""
        }
    }
    Write-Host " OK (${ramGB}GB $detectedRamType)" -ForegroundColor Green

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

    # H. Ổ CỨNG, SỨC KHỎE PHẦN CỨNG CHUYÊN SÂU (S.M.A.R.T ATTRIBUTES + RELIABILITY + EVENT LOG 30 NGÀY)
    Write-Host "[7/8] Quet Suc khoe CPU, RAM, O cung (S.M.A.R.T Chi tiet & EventLog) & Man hinh..." -NoNewline
    $hardwareAlerts = @()

    # 1A. Quét WMI Win32_DiskDrive để ánh xạ PNPDeviceID <-> Disk Index
    $wmiDiskByIndex = @{}
    try {
        $allWmiDrives = @(Get-WmiObject Win32_DiskDrive -ErrorAction SilentlyContinue)
        foreach ($wd in $allWmiDrives) {
            if ($null -ne $wd) { $wmiDiskByIndex[[int]$wd.Index] = $wd }
        }
    } catch {}

    # 1B. Quét S.M.A.R.T PredictFailure theo từng ổ (root\wmi)
    $smartFailByInstance = @{}
    $anyGlobalSmartFail = $false
    try {
        $smartStatuses = @(Get-WmiObject -Namespace root\wmi -Class MSStorageDriver_FailurePredictStatus -ErrorAction SilentlyContinue)
        foreach ($st in $smartStatuses) {
            if ($null -ne $st -and $st.PredictFailure -eq $true) {
                $anyGlobalSmartFail = $true
                if ($st.InstanceName) { $smartFailByInstance[[string]$st.InstanceName] = $true }
            }
        }
    } catch {}

    # 1C. Giải mã chi tiết Raw S.M.A.R.T Attributes (ID 05 Bad Sector, C5 Pending, C6 Uncorrectable, C7 Cáp SATA, 09 Giờ chạy, C2 Nhiệt độ, E7/E9 Tuổi thọ SSD)
    $smartDataList = @()
    try {
        $rawSmartRows = @(Get-WmiObject -Namespace root\wmi -Class MSStorageDriver_ATAPISmartData -ErrorAction SilentlyContinue)
        foreach ($row in $rawSmartRows) {
            $vs = $row.VendorSpecific
            if (-not $vs -or $vs.Length -lt 362) { continue }
            $parsed = @{
                InstanceName         = [string]$row.InstanceName
                ReallocatedSectors   = 0
                PendingSectors       = 0
                UncorrectableSectors = 0
                CrcErrors            = 0
                ReportedUncorrect    = 0
                PowerOnHours         = 0
                TemperatureC         = $null
                SsdLifeRemainingPct  = $null
            }
            for ($idxB = 2; $idxB -lt 362; $idxB += 12) {
                $attrId = [int]$vs[$idxB]
                if ($attrId -eq 0) { continue }
                $curVal = [int]$vs[$idxB + 3]
                $rawVal = [uint64]$vs[$idxB + 5] + ([uint64]$vs[$idxB + 6] * 256) + ([uint64]$vs[$idxB + 7] * 65536) + ([uint64]$vs[$idxB + 8] * 16777216)

                if ($attrId -eq 5)   { $parsed.ReallocatedSectors   = [int][math]::Min($rawVal, 1000000) }
                elseif ($attrId -eq 9)   { $parsed.PowerOnHours     = [int][math]::Min($rawVal, 500000) }
                elseif ($attrId -eq 187) { $parsed.ReportedUncorrect = [int][math]::Min($rawVal, 1000000) }
                elseif ($attrId -eq 197) { $parsed.PendingSectors   = [int][math]::Min($rawVal, 1000000) }
                elseif ($attrId -eq 198) { $parsed.UncorrectableSectors = [int][math]::Min($rawVal, 1000000) }
                elseif ($attrId -eq 199) { $parsed.CrcErrors        = [int][math]::Min($rawVal, 1000000) }
                elseif ($attrId -eq 194 -or $attrId -eq 190) {
                    $tByte = [int]($vs[$idxB + 5])
                    if ($tByte -ge 10 -and $tByte -le 95) { $parsed.TemperatureC = $tByte }
                }
                elseif ($attrId -eq 231 -or $attrId -eq 233) {
                    if ($curVal -gt 0 -and $curVal -le 100 -and $null -eq $parsed.SsdLifeRemainingPct) {
                        $parsed.SsdLifeRemainingPct = $curVal
                    }
                }
            }
            $smartDataList += $parsed
        }
    } catch {}

    # 1D. Quét Windows System Event Log 30 ngày qua tìm bằng chứng lỗi ổ cứng thực tế (Chạy được cả khi không có quyền Admin!)
    # ID 7: Bad Block | ID 153 & 51: Lỗi đọc/ghi thử lại | ID 129 & 11: Treo ổ đĩa / Reset cổng | ID 55: Hỏng NTFS
    $diskEventsByIdx = @{}
    $globalDiskResets = 0
    $globalNtfsErrors = 0
    try {
        $since30d = (Get-Date).AddDays(-30)
        $sysEvents = @()
        if (Get-Command Get-WinEvent -ErrorAction SilentlyContinue) {
            $sysEvents = @(Get-WinEvent -FilterHashtable @{ LogName = 'System'; StartTime = $since30d; Id = @(7, 11, 51, 55, 129, 153) } -MaxEvents 1500 -ErrorAction SilentlyContinue)
        } else {
            $sysEvents = @(Get-EventLog -LogName System -After $since30d -EntryType Error,Warning -ErrorAction SilentlyContinue | Where-Object {
                $_.EventID -eq 7 -or $_.EventID -eq 11 -or $_.EventID -eq 51 -or $_.EventID -eq 55 -or $_.EventID -eq 129 -or $_.EventID -eq 153
            })
        }

        foreach ($ev in $sysEvents) {
            $prov = if ($ev.ProviderName) { [string]$ev.ProviderName } elseif ($ev.Source) { [string]$ev.Source } else { "" }
            if ($prov -notmatch "disk|ntfs|storahci|stornvme|iaStor|nvme|atapi|partmgr|volmgr") { continue }
            $eid = if ($null -ne $ev.Id) { [int]$ev.Id } else { [int]$ev.EventID }
            $msg = if ($ev.Message) { [string]$ev.Message } else { "" }

            $targetDiskIdx = -1
            if ($msg -match "Harddisk(\d+)" -or $msg -match "Disk\s+(\d+)") {
                $targetDiskIdx = [int]$matches[1]
            }

            if ($targetDiskIdx -ge 0) {
                if (-not $diskEventsByIdx.ContainsKey($targetDiskIdx)) {
                    $diskEventsByIdx[$targetDiskIdx] = @{ BadBlocks = 0; IoRetries = 0; Resets = 0; NtfsErrors = 0 }
                }
                if ($eid -eq 7) { $diskEventsByIdx[$targetDiskIdx].BadBlocks++ }
                elseif ($eid -eq 153 -or $eid -eq 51) { $diskEventsByIdx[$targetDiskIdx].IoRetries++ }
                elseif ($eid -eq 129 -or $eid -eq 11) { $diskEventsByIdx[$targetDiskIdx].Resets++ }
                elseif ($eid -eq 55) { $diskEventsByIdx[$targetDiskIdx].NtfsErrors++ }
            } else {
                if ($eid -eq 129 -or $eid -eq 11) { $globalDiskResets++ }
                elseif ($eid -eq 55) { $globalNtfsErrors++ }
                elseif ($eid -eq 7 -or $eid -eq 153 -or $eid -eq 51) {
                    if (-not $diskEventsByIdx.ContainsKey(0)) {
                        $diskEventsByIdx[0] = @{ BadBlocks = 0; IoRetries = 0; Resets = 0; NtfsErrors = 0 }
                    }
                    if ($eid -eq 7) { $diskEventsByIdx[0].BadBlocks++ }
                    else { $diskEventsByIdx[0].IoRetries++ }
                }
            }
        }
    } catch {}

    function Find-SmartForDisk {
        param ([int]$DiskIdx, [string]$ModelName)
        $pnpId = ""
        if ($wmiDiskByIndex.ContainsKey($DiskIdx) -and $wmiDiskByIndex[$DiskIdx].PNPDeviceID) {
            $pnpId = ([string]$wmiDiskByIndex[$DiskIdx].PNPDeviceID).ToUpper()
        }
        foreach ($sd in $smartDataList) {
            $inst = $sd.InstanceName.ToUpper()
            if ($pnpId -and $inst.Contains($pnpId.Split('\')[-1])) { return $sd }
        }
        if ($smartDataList.Count -gt 0 -and $DiskIdx -lt $smartDataList.Count) {
            return $smartDataList[$DiskIdx]
        }
        return $null
    }

    # 2. Quét danh sách Ổ cứng vật lý + Chẩn đoán chuyên sâu từng lỗi cụ thể cho từng ổ
    $diskList = @()
    $usedPhysicalDisk = $false
    $anyDiskCritical = $false
    $anyDiskWarning = $false

    $rawDiskItems = @()
    if (Get-Command Get-PhysicalDisk -ErrorAction SilentlyContinue) {
        try {
            $pDisks = @(Get-PhysicalDisk | Sort-Object DeviceId -ErrorAction Stop)
            foreach ($d in $pDisks) {
                $rc = $null
                try { $rc = $d | Get-StorageReliabilityCounter -ErrorAction SilentlyContinue } catch {}
                $rawDiskItems += @{
                    Index        = [int]$d.DeviceId
                    Model        = [string]$d.FriendlyName
                    MediaType    = if ($d.MediaType -and $d.MediaType -ne "Unspecified") { [string]$d.MediaType } elseif ($d.FriendlyName -match "SSD|NVMe|SN\d{3}|Solid") { "SSD" } else { "HDD" }
                    SizeGB       = [math]::Round($d.Size / 1GB, 0)
                    Interface    = [string]$d.BusType
                    SerialNumber = if ($d.SerialNumber) { ([string]$d.SerialNumber).Trim() } else { "N/A" }
                    RawHealth    = if ($d.HealthStatus) { [string]$d.HealthStatus } else { "Healthy" }
                    OpStatus     = if ($d.OperationalStatus) { [string]$d.OperationalStatus } else { "OK" }
                    Reliability  = $rc
                }
            }
            if ($rawDiskItems.Count -gt 0) { $usedPhysicalDisk = $true }
        } catch {}
    }

    if (-not $usedPhysicalDisk) {
        try {
            $wmiDisks = @(Get-WmiObject Win32_DiskDrive -ErrorAction SilentlyContinue | Sort-Object Index)
            foreach ($d in $wmiDisks) {
                $mediaType = if ($d.Model -match "SSD|NVMe|SN\d{3}|Solid") { "SSD" } else { "HDD" }
                $rawDiskItems += @{
                    Index        = [int]$d.Index
                    Model        = [string]$d.Model
                    MediaType    = $mediaType
                    SizeGB       = [math]::Round($d.Size / 1GB, 0)
                    Interface    = [string]$d.InterfaceType
                    SerialNumber = if ($d.SerialNumber) { ([string]$d.SerialNumber).Trim() } else { "N/A" }
                    RawHealth    = if ($d.Status) { ([string]$d.Status).Trim() } else { "OK" }
                    OpStatus     = if ($d.Status) { ([string]$d.Status).Trim() } else { "OK" }
                    Reliability  = $null
                }
            }
        } catch {}
    }

    foreach ($item in $rawDiskItems) {
        $dIdx = [int]$item.Index
        $rc = $item.Reliability
        $sd = Find-SmartForDisk -DiskIdx $dIdx -ModelName $item.Model
        $evStats = if ($diskEventsByIdx.ContainsKey($dIdx)) { $diskEventsByIdx[$dIdx] } else { @{ BadBlocks = 0; IoRetries = 0; Resets = 0; NtfsErrors = 0 } }

        # Tổng hợp chỉ số vật lý từ ReliabilityCounter + Raw S.M.A.R.T
        $tempC = $null
        if ($rc -and $rc.Temperature -gt 0 -and $rc.Temperature -lt 110) { $tempC = [int]$rc.Temperature }
        elseif ($sd -and $null -ne $sd.TemperatureC) { $tempC = [int]$sd.TemperatureC }

        $wearPct = $null
        $lifeRemPct = $null
        if ($rc -and $null -ne $rc.Wear -and [int]$rc.Wear -ge 0 -and [int]$rc.Wear -le 100 -and ($item.MediaType -eq "SSD" -or [int]$rc.Wear -gt 0)) {
            $wearPct = [int]$rc.Wear
            $lifeRemPct = 100 - $wearPct
        } elseif ($sd -and $null -ne $sd.SsdLifeRemainingPct) {
            $lifeRemPct = [int]$sd.SsdLifeRemainingPct
            $wearPct = 100 - $lifeRemPct
        }

        $powerOnHours = $null
        if ($rc -and $rc.PowerOnHours -gt 0) { $powerOnHours = [int]$rc.PowerOnHours }
        elseif ($sd -and $sd.PowerOnHours -gt 0) { $powerOnHours = [int]$sd.PowerOnHours }

        $readErr = if ($rc -and $rc.ReadErrorsTotal -gt 0) { [int]$rc.ReadErrorsTotal } else { 0 }
        $writeErr = if ($rc -and $rc.WriteErrorsTotal -gt 0) { [int]$rc.WriteErrorsTotal } else { 0 }
        $uncorrRead = if ($rc -and $rc.ReadErrorsUncorrected -gt 0) { [int]$rc.ReadErrorsUncorrected } else { 0 }
        $uncorrWrite = if ($rc -and $rc.WriteErrorsUncorrected -gt 0) { [int]$rc.WriteErrorsUncorrected } else { 0 }

        $reallocated = if ($sd) { [int]$sd.ReallocatedSectors } else { 0 }
        $pending     = if ($sd) { [int]$sd.PendingSectors } else { 0 }
        $uncorrSect  = if ($sd) { [int]$sd.UncorrectableSectors } else { 0 }
        $crcErr      = if ($sd) { [int]$sd.CrcErrors } else { 0 }

        $evBadBlocks = [int]$evStats.BadBlocks
        $evIoRetries = [int]$evStats.IoRetries
        $evResets    = [int]$evStats.Resets
        $evNtfs      = [int]$evStats.NtfsErrors
        # Gắn thêm lỗi reset/NTFS toàn cục vào ổ đang có lỗi IO hoặc Disk 0 nếu chỉ có 1 ổ
        if ($dIdx -eq 0 -or $evIoRetries -gt 0) {
            if ($evResets -eq 0 -and $globalDiskResets -gt 0 -and ($evIoRetries -gt 0 -or $rawDiskItems.Count -eq 1)) {
                $evResets = $globalDiskResets
            }
            if ($evNtfs -eq 0 -and $globalNtfsErrors -gt 0 -and ($evIoRetries -gt 0 -or $dIdx -eq 0)) {
                $evNtfs = $globalNtfsErrors
            }
        }

        # Đánh giá chi tiết từng nguyên nhân lỗi cụ thể (Bằng chứng thuyết phục để thay ổ/cáp)
        $issues = @()
        $dHealth = "GOOD"

        $isPredictFail = $false
        if ($item.RawHealth -match "Unhealthy|Pred Fail|Fail|Error" -or $item.OpStatus -match "Error|Failed|Lost|Predictive") { $isPredictFail = $true }
        if ($anyGlobalSmartFail -and $rawDiskItems.Count -eq 1) { $isPredictFail = $true }
        if ($sd -and $smartFailByInstance.ContainsKey($sd.InstanceName)) { $isPredictFail = $true }

        if ($isPredictFail) {
            $dHealth = "CRITICAL"
            $issues += "S.M.A.R.T bao loi du doan sap hong ($($item.RawHealth)) - Nguy co mat du lieu!"
        }
        if ($reallocated -gt 0) {
            if ($reallocated -ge 10) { $dHealth = "CRITICAL" } elseif ($dHealth -eq "GOOD") { $dHealth = "WARNING" }
            $issues += "Phat hien $reallocated Bad Sector da phai thay the (S.M.A.R.T ID 05) - Mat dia dang hong dan"
        }
        if ($pending -gt 0) {
            if ($pending -ge 5) { $dHealth = "CRITICAL" } elseif ($dHealth -eq "GOOD") { $dHealth = "WARNING" }
            $issues += "Co $pending Sector loi dang cho xu ly (S.M.A.R.T ID C5) - Rat de gay treo may / mat du lieu"
        }
        if ($uncorrSect -gt 0 -or $uncorrRead -gt 0 -or $uncorrWrite -gt 0) {
            $dHealth = "CRITICAL"
            $totalUnc = $uncorrSect + $uncorrRead + $uncorrWrite
            $issues += "Co $totalUnc loi doc/ghi Sector khong the sua chua (Uncorrectable Error ID C6)"
        }
        if ($evBadBlocks -gt 0) {
            if ($evBadBlocks -ge 3) { $dHealth = "CRITICAL" } elseif ($dHealth -eq "GOOD") { $dHealth = "WARNING" }
            $issues += "Windows ghi nhan $evBadBlocks loi Bad Block vat ly (Event ID 7) trong 30 ngay qua"
        }
        if ($evIoRetries -ge 3) {
            if ($evIoRetries -ge 20) { $dHealth = "CRITICAL" } elseif ($dHealth -eq "GOOD") { $dHealth = "WARNING" }
            $issues += "Windows ghi nhan $evIoRetries lan loi doc/ghi bi thu lai tren Disk $dIdx (Event ID 153/51) trong 30 ngay qua"
        }
        if ($evResets -ge 5) {
            if ($evResets -ge 20) { $dHealth = "CRITICAL" } elseif ($dHealth -eq "GOOD") { $dHealth = "WARNING" }
            $issues += "O dia/cong SATA bi treo va Reset $evResets lan (Event ID 129) trong 30 ngay - Nguyen nhan gay do/treo may"
        }
        if ($evNtfs -gt 0) {
            if ($dHealth -eq "GOOD") { $dHealth = "WARNING" }
            $issues += "He thong phat hien $evNtfs loi hong cau truc tep NTFS (Event ID 55) trong 30 ngay qua"
        }
        if ($null -ne $wearPct -and $wearPct -ge 70) {
            if ($wearPct -ge 85) { $dHealth = "CRITICAL" } elseif ($dHealth -eq "GOOD") { $dHealth = "WARNING" }
            $issues += "SSD da hao mon ${wearPct}% (Tuoi tho NAND chi con ${lifeRemPct}%) - Can len ke hoach thay o moi"
        }
        if ($null -ne $tempC -and $tempC -ge 55) {
            if ($tempC -ge 65) { $dHealth = "CRITICAL" } elseif ($dHealth -eq "GOOD") { $dHealth = "WARNING" }
            $issues += "Nhiet do o cung qua cao: ${tempC}C (Nguong an toan < 55C) - Can kiem tra tan nhiet"
        }
        if ($crcErr -ge 10) {
            if ($dHealth -eq "GOOD") { $dHealth = "WARNING" }
            $issues += "Phat hien $crcErr loi truyen du lieu cap SATA (CRC Error ID C7) - Can kiem tra/thay day cap SATA"
        }
        if ($null -ne $powerOnHours -and $powerOnHours -ge 35000) {
            $yrs = [math]::Round($powerOnHours / 8760.0, 1)
            if ($dHealth -eq "GOOD") { $dHealth = "WARNING" }
            $issues += "O cung da chay ${powerOnHours} gio (~${yrs} nam hoat dong lien tuc) - Do ben co hoc da giam"
        }
        if (($readErr -gt 0 -or $writeErr -gt 0) -and $uncorrRead -eq 0 -and $uncorrWrite -eq 0) {
            if ($dHealth -eq "GOOD") { $dHealth = "WARNING" }
            $issues += "Ghi nhan $readErr loi doc / $writeErr loi ghi tren bo dem phan cung"
        }

        if ($dHealth -eq "CRITICAL") {
            $anyDiskCritical = $true
            $dHealthText = if ($issues.Count -gt 0) { "NGUY HIEM: $($issues[0])" } else { "NGUY HIEM: O cung co dau hieu sap hong!" }
            $hardwareAlerts += "O cung [Disk $dIdx - $($item.Model)]: $($issues -join '; ')"
        } elseif ($dHealth -eq "WARNING") {
            $anyDiskWarning = $true
            $dHealthText = if ($issues.Count -gt 0) { "Canh bao: $($issues[0])" } else { "Canh bao ($($item.RawHealth))" }
            $hardwareAlerts += "O cung [Disk $dIdx - $($item.Model)]: $($issues -join '; ')"
        } else {
            $goodParts = @()
            if ($null -ne $lifeRemPct) { $goodParts += "Tuoi tho ${lifeRemPct}%" }
            if ($null -ne $tempC) { $goodParts += "${tempC}C" }
            if ($null -ne $powerOnHours) { $goodParts += "${powerOnHours}h" }
            $dHealthText = if ($goodParts.Count -gt 0) { "Tot ($($goodParts -join ' • ') • 0 loi)" } else { "Tot (S.M.A.R.T OK • 0 loi EventLog)" }
        }

        $diskList += @{
            Index                = $dIdx
            Model                = $item.Model
            MediaType            = $item.MediaType
            SizeGB               = $item.SizeGB
            Interface            = $item.Interface
            SerialNumber         = $item.SerialNumber
            HealthStatus         = $dHealth
            HealthText           = $dHealthText
            TemperatureC         = $tempC
            WearPercent          = $wearPct
            LifeRemainingPercent = $lifeRemPct
            PowerOnHours         = $powerOnHours
            ReadErrors           = $readErr
            WriteErrors          = $writeErr
            ReallocatedSectors   = $reallocated
            PendingSectors       = $pending
            UncorrectableSectors = $uncorrSect
            CrcErrors            = $crcErr
            EventBadBlocks       = $evBadBlocks
            EventIoRetries       = $evIoRetries
            EventDiskResets      = $evResets
            EventNtfsErrors      = $evNtfs
            HealthIssues         = $issues
        }
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
    $totalRamGB = if ($compBytes -gt 0) { [math]::Round($compBytes / 1GB, 1) } else { [double]$ramGB }
    $freeRamGB  = if ($os -and $os.FreePhysicalMemory) { [math]::Round(($os.FreePhysicalMemory * 1KB) / 1GB, 1) } `
                  elseif ($ciObj -and $ciObj.AvailablePhysicalMemory) { [math]::Round($ciObj.AvailablePhysicalMemory / 1GB, 1) } `
                  else { [math]::Round($totalRamGB * 0.4, 1) }
    $usedRamGB  = [math]::Max(0, [math]::Round($totalRamGB - $freeRamGB, 1))
    $ramUsagePct = if ($totalRamGB -gt 0) { [int][math]::Round(($usedRamGB / $totalRamGB) * 100, 0) } else { 50 }

    $ramHealthStatus = "GOOD"
    $ramHealthText   = "Tot (Con trong ${freeRamGB} GB)"
    if ($ramUsagePct -ge 95) {
        $ramHealthStatus = "WARNING"
        $ramHealthText   = "Day RAM (${ramUsagePct}% - Can nang cap)"
        $hardwareAlerts += "RAM dang su dung ${ramUsagePct}% (${usedRamGB}/${totalRamGB} GB) - De gay treo lag may"
    } elseif ($ramUsagePct -ge 85 -or $ramGB -lt 4) {
        $ramHealthStatus = "WARNING"
        $ramHealthText   = "Su dung cao (${ramUsagePct}%)"
    }

    $ramHealth = @{
        status       = $ramHealthStatus
        statusText   = $ramHealthText
        ramType      = [string]$detectedRamType
        installedGB  = [int]$ramGB
        totalGB      = $totalRamGB
        usedGB       = $usedRamGB
        freeGB       = $freeRamGB
        usagePercent = $ramUsagePct
        slotsUsed    = $ramDetails.Count
    }

    # 5B. Chẩn đoán Sức khỏe Pin Laptop (Tuổi thọ pin, % Độ chai & Số lần sạc Cycle Count)
    $batteryHealth = $null
    try {
        $wmiBat = @(Get-WmiObject Win32_Battery -ErrorAction SilentlyContinue)[0]
        if ($null -ne $wmiBat) {
            # Nếu máy có Pin vật lý thì chắc chắn là Laptop/Mobile
            if ($detectedType -eq "PC") { $detectedType = "LAPTOP" }

            $designCap = 0
            $fullCap = 0
            $cycleCount = -1
            $batMfg = ""
            $batSerial = ""
            $batName = if ($wmiBat.Name) { ([string]$wmiBat.Name).Trim() } else { "Laptop Battery" }
            $chargePct = if ($null -ne $wmiBat.EstimatedChargeRemaining) { [int]$wmiBat.EstimatedChargeRemaining } else { $null }
            $isCharging = ($wmiBat.BatteryStatus -eq 2 -or $wmiBat.BatteryStatus -eq 6 -or $wmiBat.BatteryStatus -eq 7 -or $wmiBat.BatteryStatus -eq 8 -or $wmiBat.BatteryStatus -eq 9)

            # Tầng 1: Đọc trực tiếp từ WMI root\wmi (Chạy tốt trên cả Windows 7, 8, 10, 11)
            try {
                $batStatic = @(Get-WmiObject -Namespace root\wmi -Class BatteryStaticData -ErrorAction SilentlyContinue)[0]
                if ($batStatic) {
                    if ($batStatic.DesignedCapacity -gt 0) { $designCap = [int]$batStatic.DesignedCapacity }
                    if ($batStatic.ManufactureName) { $batMfg = ([string]$batStatic.ManufactureName).Trim() }
                    if ($batStatic.SerialNumber) { $batSerial = ([string]$batStatic.SerialNumber).Trim() }
                }
            } catch {}

            try {
                $batFull = @(Get-WmiObject -Namespace root\wmi -Class BatteryFullChargedCapacity -ErrorAction SilentlyContinue)[0]
                if ($batFull -and $batFull.FullChargedCapacity -gt 0) {
                    $fullCap = [int]$batFull.FullChargedCapacity
                }
            } catch {}

            try {
                $batCycle = @(Get-WmiObject -Namespace root\wmi -Class BatteryCycleCount -ErrorAction SilentlyContinue)[0]
                if ($batCycle -and $batCycle.CycleCount -gt 0) {
                    $cycleCount = [int]$batCycle.CycleCount
                }
            } catch {}

            # Tầng 2: Dự phòng qua powercfg /batteryreport /xml (Rất chuẩn trên Dell/HP/Lenovo Win 8/10/11 khi WMI không báo CycleCount)
            if ($designCap -le 0 -or $fullCap -le 0 -or $cycleCount -le 0) {
                try {
                    $tmpBatXml = Join-Path $env:TEMP "towa_bat_report.xml"
                    if (Test-Path $tmpBatXml) { Remove-Item $tmpBatXml -Force -ErrorAction SilentlyContinue }
                    $proc = Start-Process -FilePath "powercfg.exe" -ArgumentList "/batteryreport /xml /output `"$tmpBatXml`"" -WindowStyle Hidden -PassThru -ErrorAction SilentlyContinue
                    if ($proc) {
                        $proc.WaitForExit(5000) | Out-Null
                    }
                    if (Test-Path $tmpBatXml) {
                        [xml]$batXml = Get-Content -Path $tmpBatXml -ErrorAction SilentlyContinue
                        $xmlBatteries = $batXml.BatteryReport.Batteries.Battery
                        $firstXmlBat = if ($xmlBatteries -is [System.Array]) { $xmlBatteries[0] } else { $xmlBatteries }
                        if ($firstXmlBat) {
                            if ($designCap -le 0 -and $firstXmlBat.DesignCapacity) { $designCap = [int]$firstXmlBat.DesignCapacity }
                            if ($fullCap -le 0 -and $firstXmlBat.FullChargeCapacity) { $fullCap = [int]$firstXmlBat.FullChargeCapacity }
                            if ($cycleCount -le 0 -and $firstXmlBat.CycleCount) {
                                $parsedCycle = 0
                                if ([int]::TryParse([string]$firstXmlBat.CycleCount, [ref]$parsedCycle) -and $parsedCycle -gt 0) {
                                    $cycleCount = $parsedCycle
                                }
                            }
                            if (-not $batMfg -and $firstXmlBat.Manufacturer) { $batMfg = ([string]$firstXmlBat.Manufacturer).Trim() }
                            if (-not $batSerial -and $firstXmlBat.SerialNumber) { $batSerial = ([string]$firstXmlBat.SerialNumber).Trim() }
                            if ($firstXmlBat.Id) { $batName = ([string]$firstXmlBat.Id).Trim() }
                        }
                        Remove-Item $tmpBatXml -Force -ErrorAction SilentlyContinue
                    }
                } catch {}
            }

            $batHealthPct = $null
            $wearPct = $null
            if ($designCap -gt 0 -and $fullCap -gt 0) {
                $rawPct = [int][math]::Round(($fullCap / $designCap) * 100, 0)
                if ($rawPct -gt 100) { $rawPct = 100 }
                if ($rawPct -lt 0) { $rawPct = 0 }
                $batHealthPct = $rawPct
                $wearPct = 100 - $rawPct
            }

            $batStatus = "GOOD"
            $batStatusText = "Pin Tot"
            if (($null -ne $batHealthPct -and $batHealthPct -lt 50) -or ($cycleCount -ge 800)) {
                $batStatus = "CRITICAL"
                $batStatusText = if ($null -ne $wearPct) { "Can thay pin (Chai ${wearPct}%)" } else { "Can thay pin (${cycleCount} lan sac)" }
                $cycleNote = if ($cycleCount -gt 0) { ", ${cycleCount} chu ky sac" } else { "" }
                $hardwareAlerts += "Pin Laptop chai nang (Tuoi tho con ${batHealthPct}%, chai ${wearPct}%${cycleNote}) - Can thay pin!"
            } elseif (($null -ne $batHealthPct -and $batHealthPct -lt 75) -or ($cycleCount -ge 500)) {
                $batStatus = "WARNING"
                $batStatusText = if ($null -ne $wearPct) { "Pin da chai ${wearPct}% (Can chu y)" } else { "So lan sac cao (${cycleCount} lan)" }
                $cycleNote = if ($cycleCount -gt 0) { ", ${cycleCount} chu ky sac" } else { "" }
                $hardwareAlerts += "Pin Laptop da chai ${wearPct}% (Tuoi tho con ${batHealthPct}%${cycleNote})"
            } elseif ($null -ne $batHealthPct) {
                $batStatusText = "Pin Tot (Tuoi tho ${batHealthPct}%)"
            }

            $batteryHealth = @{
                hasBattery             = $true
                name                   = $batName
                manufacturer           = $batMfg
                serialNumber           = $batSerial
                designCapacityMWh      = $designCap
                fullChargeCapacityMWh  = $fullCap
                healthPercent          = $batHealthPct
                wearLevelPercent       = $wearPct
                cycleCount             = if ($cycleCount -gt 0) { $cycleCount } else { $null }
                chargePercent          = $chargePct
                isCharging             = $isCharging
                status                 = $batStatus
                statusText             = $batStatusText
            }
        }
    } catch {}

    # 6. Tổng hợp Sức khỏe Toàn máy (Overall Hardware Health)
    $overallHealthStatus = "GOOD"
    $overallHealthText   = "Phan cung hoat dong Tot"
    if ($anyDiskCritical -or $cpuHealthStatus -eq "CRITICAL" -or ($batteryHealth -and $batteryHealth.status -eq "CRITICAL")) {
        $overallHealthStatus = "CRITICAL"
        $overallHealthText   = if ($anyDiskCritical -or $cpuHealthStatus -eq "CRITICAL") { "NGUY HIEM: Co loi phan cung (O cung/CPU)!" } else { "CAN THAY PIN: Pin Laptop da chai nang!" }
    } elseif ($anyDiskWarning -or $ramHealthStatus -eq "WARNING" -or $cpuHealthStatus -eq "WARNING" -or ($batteryHealth -and $batteryHealth.status -eq "WARNING")) {
        $overallHealthStatus = "WARNING"
        $overallHealthText   = "Can chu y (O dia / RAM / Pin Laptop)"
    }

    $diskOverallStatus = if ($anyDiskCritical) { "CRITICAL" } elseif ($anyDiskWarning) { "WARNING" } else { "GOOD" }
    $diskOverallText   = if ($anyDiskCritical) { "Nguy co hong o cung (S.M.A.R.T)" } elseif ($anyDiskWarning) { "Can don dep dung luong" } else { "Tot (S.M.A.R.T OK)" }

    $hardwareHealth = @{
        overallStatus  = $overallHealthStatus
        overallText    = $overallHealthText
        cpu            = $cpuHealth
        ram            = $ramHealth
        battery        = $batteryHealth
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
        ramType      = [string]$detectedRamType
        
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