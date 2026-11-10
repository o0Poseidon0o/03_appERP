# =============================================================================
# TOWA ITAM AGENT - V3.20 (MULTI-WINDOWS: WINDOWS 7 PS 2.0 -> WINDOWS 11 PS 5.1+)
# Features: Win7/PS2.0 Compatible + UTF-8 Safe + Software Normalization + Secret Key
# =============================================================================

# --- 1. CẤU HÌNH ---
$IsDevMode      = $false                     # $true = Localhost, $false = Server
$ServerIP       = "192.168.20.17"
$ServerPort     = "3000"
$AgentSecretKey = "@Towa2026!#Secure_Agent_998811_AbCdEf"
$ApiKey         = $AgentSecretKey

# --- 2. URL & TLS (Tương thích cả Windows 7 .NET 2.0/3.5 và Windows 10/11) ---
if ($IsDevMode) { $BaseUrl = "http://127.0.0.1:$ServerPort" } else { $BaseUrl = "http://${ServerIP}:${ServerPort}" }
$ApiUrl = "$BaseUrl/api/assets/sync"
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

    # H. Ổ CỨNG & MÀN HÌNH (HỖ TRỢ CẢ WINDOWS 7 WMI LẪN WINDOWS 10/11)
    Write-Host "[7/8] Quet O cung & Man hinh..." -NoNewline
    $diskList = @()
    $usedPhysicalDisk = $false
    if (Get-Command Get-PhysicalDisk -ErrorAction SilentlyContinue) {
        try {
            $pDisks = @(Get-PhysicalDisk | Sort-Object DeviceId -ErrorAction Stop)
            foreach ($d in $pDisks) {
                $diskList += @{ Index = [int]$d.DeviceId; Model = [string]$d.FriendlyName; MediaType = [string]$d.MediaType; SizeGB = [math]::Round($d.Size / 1GB, 0); Interface = [string]$d.BusType; SerialNumber = if ($d.SerialNumber) { $d.SerialNumber.Trim() } else { "N/A" } }
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
                $diskList += @{ Index = [int]$d.Index; Model = [string]$d.Model; MediaType = $mediaType; SizeGB = [math]::Round($d.Size / 1GB, 0); Interface = [string]$d.InterfaceType; SerialNumber = if ($d.SerialNumber) { ([string]$d.SerialNumber).Trim() } else { "N/A" } }
            }
        } catch {}
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
    Write-Host " OK" -ForegroundColor Green

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
        
        ramDetails   = $ramDetails      
        gpus         = $gpuList         
        peripherals  = $peripheralList 
        
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
    
    # Retry Logic (3 Times)
    $maxRetries = 3; $retryCount = 0; $success = $false
    while (-not $success -and $retryCount -lt $maxRetries) {
        try {
            $respText = Send-AgentPayload -Uri $ApiUrl -JsonBody $jsonPayload -SecretKey $AgentSecretKey
            Write-Host " SUCCESS: Dong bo thanh cong ($hostNameStr)!" -ForegroundColor Green
            $success = $true
        } catch {
            $retryCount++
            Write-Host " FAILED ($retryCount/$maxRetries): $($_.Exception.Message)" -ForegroundColor Red
            if ($retryCount -lt $maxRetries) { Start-Sleep -Seconds (5 * $retryCount) }
        }
    }

} catch {
    Write-Host "ERROR: $($_.Exception.Message)" -ForegroundColor Red
    Read-Host "Press Enter..."
}