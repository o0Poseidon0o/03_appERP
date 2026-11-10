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

    # A. PHẦN CỨNG CƠ BẢN (Tương thích mảng trên PowerShell 2.0 Windows 7)
    Write-Host "[1/8] Quet he thong co ban..." -NoNewline
    $bios = @(Get-WmiObject Win32_BIOS)[0]
    $comp = @(Get-WmiObject Win32_ComputerSystem)[0]
    $os   = @(Get-WmiObject Win32_OperatingSystem)[0]
    $cpu  = @(Get-WmiObject Win32_Processor)[0]
    $currentUser = if ($comp.UserName) { $comp.UserName } else { "$env:USERDOMAIN\$env:USERNAME" }
    Write-Host " OK" -ForegroundColor Green

    # B. MẠNG (ACTIVE & INTERNET ONLY)
    Write-Host "[2/8] Quet mang (Active)..." -NoNewline
    $finalIP = "127.0.0.1"; $finalMac = ""
    
    try {
        # Lấy tất cả card mạng đang Connected (Status=2)
        $activeNics = Get-WmiObject Win32_NetworkAdapter | Where-Object { $_.NetConnectionStatus -eq 2 }
        
        foreach ($nic in $activeNics) {
            $config = Get-WmiObject Win32_NetworkAdapterConfiguration | Where-Object { $_.Index -eq $nic.Index }
            
            # Chỉ lấy Card có Default Gateway (Ra được mạng ngoài)
            if ($config.DefaultIPGateway) {
                $finalIP = $config.IPAddress | Where-Object { $_ -match '\.' } | Select-Object -First 1
                $finalMac = $nic.MACAddress
                break # Lấy được cái đầu tiên ngon thì dừng luôn
            }
        }
    } catch {}
    Write-Host " OK ($finalIP)" -ForegroundColor Green

    # C. PHÂN LOẠI
    $detectedType = "PC"
    if ($os.Caption -match "Server") { $detectedType = "SERVER" }
    elseif ((Get-WmiObject Win32_SystemEnclosure).ChassisTypes -contains 9) { $detectedType = "LAPTOP" }

    # D. RAM CHI TIẾT
    Write-Host "[3/8] Quet RAM..." -NoNewline
    $ramDetails = @()
    try {
        $pMem = Get-WmiObject Win32_PhysicalMemory
        foreach ($stick in $pMem) {
            $busSpeed = if ($stick.Speed) { $stick.Speed } else { "Unknown" }
            $capacityGB = [math]::Round($stick.Capacity / 1GB, 0)
            $ramDetails += @{ Slot = $stick.BankLabel; Capacity = "${capacityGB}GB"; Speed = "${busSpeed}MHz"; Manufacturer = $stick.Manufacturer }
        }
    } catch {}
    Write-Host " OK" -ForegroundColor Green

    # E. GPU
    Write-Host "[4/8] Quet GPU..." -NoNewline
    $gpuList = @()
    try {
        $gpus = Get-WmiObject Win32_VideoController
        foreach ($g in $gpus) {
            $vram = "N/A"
            if ($g.AdapterRAM -gt 0) { $vram = "$([math]::Round($g.AdapterRAM / 1GB, 1)) GB" }
            $gpuList += @{ Name = $g.Name; VRAM = $vram; DriverVersion = $g.DriverVersion }
        }
    } catch {}
    Write-Host " OK" -ForegroundColor Green

    # =========================================================================
    # F. THIẾT BỊ NGOẠI VI (DEEP SCAN - PnP Entity)
    # =========================================================================
    Write-Host "[5/8] Quet Chuot/Phim (Deep Scan)..." -NoNewline
    $peripheralList = @()
    try {
        # Dùng Win32_PnPEntity thay vì Get-PnpDevice để lấy tên chuẩn hơn
        $pnpEntities = Get-WmiObject Win32_PnPEntity | Where-Object { 
            ($_.PNPClass -eq "Keyboard" -or $_.PNPClass -eq "Mouse") -and $_.Status -eq "OK" 
        }
        
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
                # Nếu tên là "HID-compliant...", ta cố gắng ghép Brand vào
                if ($rawName -match "HID-compliant" -or $rawName -match "Standard") {
                    if ($brand -ne "Unknown") {
                        $rawName = "$brand Device ($rawName)"
                    }
                }
                
                # 4. Kiểm tra trùng lặp (Vì 1 chuột có thể sinh ra nhiều dòng HID)
                # Logic: Chỉ lấy dòng nào có tên khác "HID-compliant..." HOẶC nếu chưa có thiết bị nào
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
            $wmiDisks = @(Get-WmiObject Win32_DiskDrive | Sort-Object Index)
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
    if ($cpuWmiStatus -notin @("OK", "")) {
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
    $serialNum = if ($bios -and $bios.SerialNumber) { ([string]$bios.SerialNumber).Trim() } else { "N/A" }
    $hostNameStr = if ($comp -and $comp.Name) { [string]$comp.Name } else { $env:COMPUTERNAME }

    $payload = @{
        serialNumber = $serialNum
        hostname     = $hostNameStr
        username     = [string]$currentUser
        model        = [string]$comp.Model
        manufacturer = [string]$comp.Manufacturer
        osName       = [string]$os.Caption
        osVersion    = [string]$os.Version
        cpuName      = [string]$cpu.Name
        ramGB        = [math]::Round($comp.TotalPhysicalMemory / 1GB, 0)
        
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