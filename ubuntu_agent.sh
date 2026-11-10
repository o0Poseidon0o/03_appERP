#!/usr/bin/env bash
# =============================================================================
# TOWA ITAM AGENT FOR UBUNTU / DEBIAN LINUX (V3.20)
# Hỗ trợ: Ubuntu 16.04 / 18.04 / 20.04 / 22.04 / 24.04 & Debian (Desktop & Server)
# Cách chạy:
#   chmod +x ubuntu_agent.sh
#   sudo ./ubuntu_agent.sh   (Khuyên dùng sudo để lấy được Serial BIOS & chi tiết khe RAM)
# =============================================================================

export SERVER_IP="192.168.20.17"
export SERVER_PORT="3000"
export IS_DEV_MODE="false"
export AGENT_SECRET_KEY="@Towa2026!#Secure_Agent_998811_AbCdEf"

if ! command -v python3 >/dev/null 2>&1; then
    echo "[ERROR] May chua cai python3. Vui long chay: sudo apt-get update && sudo apt-get install -y python3"
    exit 1
fi

python3 - << 'EOF'
import os
import re
import sys
import glob
import json
import time
import math
import socket
import struct
import random
import subprocess
import urllib.request
import urllib.error
from datetime import datetime

SERVER_IP = os.environ.get("SERVER_IP", "192.168.20.17")
SERVER_PORT = os.environ.get("SERVER_PORT", "3000")
IS_DEV_MODE = os.environ.get("IS_DEV_MODE", "false").lower() == "true"
AGENT_SECRET_KEY = os.environ.get("AGENT_SECRET_KEY", "@Towa2026!#Secure_Agent_998811_AbCdEf")

BASE_URL = f"http://127.0.0.1:{SERVER_PORT}" if IS_DEV_MODE else f"http://{SERVER_IP}:{SERVER_PORT}"
API_URL = f"{BASE_URL}/api/assets/sync"

VENDOR_LOOKUP = {
    "046D": "Logitech", "413C": "Dell", "03F0": "HP", "17EF": "Lenovo",
    "045E": "Microsoft", "1532": "Razer", "1B1C": "Corsair", "1038": "SteelSeries",
    "0B05": "ASUS", "093A": "Pixart", "05AC": "Apple", "258A": "Sino wealth",
    "18F8": "Rapoo", "09DA": "A4Tech", "24AE": "Rapoo", "04F2": "Chicony",
    "0461": "Primax", "04CA": "Lite-On"
}

def run_cmd(cmd):
    try:
        out = subprocess.check_output(cmd, shell=True, stderr=subprocess.DEVNULL, timeout=15)
        return out.decode("utf-8", errors="ignore").strip()
    except Exception:
        return ""

def read_file(path):
    try:
        with open(path, "r", encoding="utf-8", errors="ignore") as f:
            return f.read().strip()
    except Exception:
        return ""

print("--- KHOI DONG TOWA UBUNTU/LINUX AGENT V3.20 ---")

# 1. He thong co ban (DMI / BIOS / OS / CPU)
print("[1/7] Quet thong tin he thong co ban...", end="", flush=True)
hostname = socket.gethostname().upper().strip()

serial_number = read_file("/sys/class/dmi/id/product_serial")
if not serial_number or serial_number.lower() in ("none", "to be filled by o.e.m.", "default string"):
    dm_serial = run_cmd("dmidecode -s system-serial-number")
    if dm_serial and "permission denied" not in dm_serial.lower():
        serial_number = dm_serial.splitlines()[0].strip()
if not serial_number:
    serial_number = "N/A"

manufacturer = read_file("/sys/class/dmi/id/sys_vendor") or "Linux PC"
model = read_file("/sys/class/dmi/id/product_name") or "Ubuntu Workstation"

# Phan loai PC / LAPTOP / SERVER
chassis_type = read_file("/sys/class/dmi/id/chassis_type")
device_type = "PC"
if chassis_type in ("8", "9", "10", "11", "14", "30", "31", "32"):
    device_type = "LAPTOP"
elif chassis_type in ("17", "23", "28", "29"):
    device_type = "SERVER"

# OS Info
os_name = "Ubuntu Linux"
os_version = ""
os_release = read_file("/etc/os-release")
for line in os_release.splitlines():
    if line.startswith("PRETTY_NAME="):
        os_name = line.split("=", 1)[1].strip('"')
    elif line.startswith("VERSION_ID="):
        os_version = line.split("=", 1)[1].strip('"')
if not os_version:
    os_version = run_cmd("uname -r")

# Current User
current_user = os.environ.get("SUDO_USER") or run_cmd("logname")
if not current_user:
    who_out = run_cmd("who | head -n 1 | awk '{print $1}'")
    current_user = who_out or os.environ.get("USER") or "root"

# CPU Info
cpu_name = ""
cpuinfo = read_file("/proc/cpuinfo")
for line in cpuinfo.splitlines():
    if "model name" in line.lower():
        cpu_name = line.split(":", 1)[1].strip()
        break
if not cpu_name:
    cpu_name = run_cmd("lscpu | grep 'Model name' | cut -d ':' -f2").strip() or "Linux CPU"
print(" OK")

# 2. Mang (Active IP & MAC)
print("[2/7] Quet card mang Active...", end="", flush=True)
final_ip = "127.0.0.1"
final_mac = ""
route_out = run_cmd("ip route get 8.8.8.8 2>/dev/null || ip route show default 2>/dev/null")
iface_match = re.search(r"\bdev\s+(\S+)", route_out)
src_match = re.search(r"\bsrc\s+(\d+\.\d+\.\d+\.\d+)", route_out)

if iface_match:
    iface = iface_match.group(1)
    final_mac = read_file(f"/sys/class/net/{iface}/address").upper()
    if src_match:
        final_ip = src_match.group(1)
    else:
        ip_out = run_cmd(f"ip -4 addr show dev {iface}")
        m_ip = re.search(r"inet\s+(\d+\.\d+\.\d+\.\d+)", ip_out)
        if m_ip:
            final_ip = m_ip.group(1)
print(f" OK ({final_ip})")

# 3. RAM
print("[3/7] Quet RAM...", end="", flush=True)
ram_gb = 0
meminfo = read_file("/proc/meminfo")
for line in meminfo.splitlines():
    if line.startswith("MemTotal:"):
        kb = int(re.findall(r"\d+", line)[0])
        ram_gb = round(kb / (1024 * 1024))
        break

ram_details = []
dmi_mem = run_cmd("dmidecode -t memory")
if dmi_mem and "Memory Device" in dmi_mem:
    for block in dmi_mem.split("Memory Device")[1:]:
        size_m = re.search(r"^\s*Size:\s*(.+)$", block, re.M)
        if not size_m:
            continue
        size_val = size_m.group(1).strip()
        if "No Module" in size_val or "Not Installed" in size_val:
            continue
        # Chuyen MB -> GB neu can
        cap_str = size_val
        m_mb = re.match(r"^(\d+)\s*MB", size_val, re.I)
        if m_mb:
            cap_str = f"{round(int(m_mb.group(1)) / 1024)}GB"
        else:
            m_gb = re.match(r"^(\d+)\s*GB", size_val, re.I)
            if m_gb:
                cap_str = f"{m_gb.group(1)}GB"

        slot_m = re.search(r"^\s*Locator:\s*(.+)$", block, re.M)
        speed_m = re.search(r"^\s*Speed:\s*(.+)$", block, re.M)
        mfg_m = re.search(r"^\s*Manufacturer:\s*(.+)$", block, re.M)
        ram_details.append({
            "Slot": slot_m.group(1).strip() if slot_m else "Slot",
            "Capacity": cap_str,
            "Speed": speed_m.group(1).strip().replace(" ", "") if speed_m else "Unknown",
            "Manufacturer": mfg_m.group(1).strip() if mfg_m else "Unknown"
        })
print(" OK")

# 4. GPU
print("[4/7] Quet GPU...", end="", flush=True)
gpu_list = []
lspci_out = run_cmd("lspci | grep -iE 'vga|3d|display'")
for line in lspci_out.splitlines():
    parts = line.split(":", 2)
    gpu_name = parts[2].strip() if len(parts) >= 3 else line.strip()
    gpu_list.append({
        "Name": gpu_name,
        "VRAM": "N/A",
        "DriverVersion": "Linux Kernel Driver"
    })
print(" OK")

# 5. Ngoai vi (Chuot / Phim USB)
print("[5/7] Quet Chuot / Ban phim...", end="", flush=True)
peripheral_list = []
input_devs = read_file("/proc/bus/input/devices")
for block in input_devs.split("\n\n"):
    name_m = re.search(r'N: Name="([^"]+)"', block)
    phys_m = re.search(r'P: Phys=([^\s]+)', block)
    vendor_m = re.search(r'I: Bus=[0-9a-fA-F]+ Vendor=([0-9a-fA-F]{4}) Product=([0-9a-fA-F]{4})', block)
    handlers_m = re.search(r'H: Handlers=(.+)', block)
    if not name_m or not handlers_m:
        continue
    dev_name = name_m.group(1).strip()
    handlers = handlers_m.group(1)

    if any(ignore in dev_name.lower() for ignore in ("power button", "sleep button", "video bus", "lid switch", "hda ", "virtual", "acpi", "wmi", "touchpad")):
        continue

    dev_type = None
    if "mouse" in handlers or "mouse" in dev_name.lower():
        dev_type = "Mouse"
    elif "kbd" in handlers and ("keyboard" in dev_name.lower() or (phys_m and "usb" in phys_m.group(1).lower())):
        dev_type = "Keyboard"

    if dev_type:
        vid = vendor_m.group(1).upper() if vendor_m else ""
        pid = vendor_m.group(2).upper() if vendor_m else ""
        brand = VENDOR_LOOKUP.get(vid, "Unknown")
        conn = "USB" if (phys_m and "usb" in phys_m.group(1).lower()) else "Built-in/Other"
        dev_id = f"USB\\VID_{vid}&PID_{pid}" if vid else dev_name
        if not any(p["Id"] == dev_id and p["Type"] == dev_type for p in peripheral_list):
            peripheral_list.append({
                "Name": dev_name,
                "Type": dev_type,
                "Brand": brand,
                "Connection": conn,
                "Id": dev_id
            })
print(" OK")

# 6. O cung & Man hinh
print("[6/7] Quet O cung & Man hinh...", end="", flush=True)
disk_list = []
lsblk_json = run_cmd("lsblk -J -b -d -o NAME,MODEL,SIZE,ROTA,TRAN,SERIAL,TYPE")
if lsblk_json:
    try:
        parsed_blk = json.loads(lsblk_json)
        idx = 0
        for d in parsed_blk.get("blockdevices", []):
            if d.get("type") != "disk" or str(d.get("name", "")).startswith(("loop", "ram", "sr", "zram")):
                continue
            size_bytes = int(d.get("size") or 0)
            size_gb = round(size_bytes / (1024 ** 3))
            if size_gb <= 0:
                continue
            rota = d.get("rota")
            is_ssd = (rota is False or str(rota) == "0" or "nvme" in str(d.get("name", "")))
            disk_list.append({
                "Index": idx,
                "Model": (d.get("model") or d.get("name") or "Linux Disk").strip(),
                "MediaType": "SSD" if is_ssd else "HDD",
                "SizeGB": size_gb,
                "Interface": (d.get("tran") or "SATA/NVMe").upper(),
                "SerialNumber": (d.get("serial") or "N/A").strip()
            })
            idx += 1
    except Exception:
        pass

monitor_list = []
for edid_path in glob.glob("/sys/class/drm/card*-*/edid"):
    status_path = os.path.join(os.path.dirname(edid_path), "status")
    if read_file(status_path) != "connected":
        continue
    try:
        with open(edid_path, "rb") as f:
            edid = f.read()
        if len(edid) < 128 or edid[:8] != b'\x00\xff\xff\xff\xff\xff\xff\x00':
            continue
        # Manufacturer 3-letter code
        mfg_word = struct.unpack(">H", edid[8:10])[0]
        c1 = chr(((mfg_word >> 10) & 0x1F) + 64)
        c2 = chr(((mfg_word >> 5) & 0x1F) + 64)
        c3 = chr((mfg_word & 0x1F) + 64)
        mfg_code = f"{c1}{c2}{c3}"

        width_cm = edid[21]
        height_cm = edid[22]
        screen_size = "N/A"
        if width_cm > 0 and height_cm > 0:
            diag_inch = round(math.sqrt(width_cm ** 2 + height_cm ** 2) / 2.54, 1)
            screen_size = f"{diag_inch} inch"

        mon_name = "Generic Monitor"
        mon_serial = "N/A"
        for offset in (54, 72, 90, 108):
            desc = edid[offset:offset + 18]
            if len(desc) == 18 and desc[0:3] == b'\x00\x00\x00':
                dtype = desc[3]
                text = desc[5:18].decode("ascii", errors="ignore").strip()
                if dtype == 0xFC and text:
                    mon_name = text
                elif dtype == 0xFF and text:
                    mon_serial = text

        monitor_list.append({
            "Manufacturer": mfg_code,
            "Model": mon_name,
            "SerialNumber": mon_serial,
            "ManufacturedDate": "",
            "ScreenSize": screen_size
        })
    except Exception:
        pass
print(" OK")

# 7. Phan mem cai dat (Loc ung dung nguoi dung & server chinh, bo qua 2000 goi lib* he thong)
print("[7/7] Quet phan mem cai dat...", end="", flush=True)
software_map = {}

# A. Quet cac goi Snap
snap_out = run_cmd("snap list")
if snap_out:
    for line in snap_out.splitlines()[1:]:
        parts = line.split()
        if len(parts) >= 2:
            sname, sver = parts[0], parts[1]
            if sname in ("bare", "core", "core18", "core20", "core22", "core24", "snapd", "gtk-common-themes") or sname.startswith("gnome-"):
                continue
            software_map[sname.upper()] = {
                "Name": sname.replace("-", " ").title(),
                "Version": sver,
                "Publisher": parts[3] if len(parts) >= 4 else "Snapcraft"
            }

# B. Quet cac ung dung Desktop & phan mem chinh tu dpkg
important_pkgs = {
    "google-chrome-stable": ("Google Chrome", "Google LLC"),
    "firefox": ("Mozilla Firefox", "Mozilla"),
    "code": ("Visual Studio Code", "Microsoft Corporation"),
    "libreoffice-core": ("LibreOffice", "The Document Foundation"),
    "thunderbird": ("Mozilla Thunderbird", "Mozilla"),
    "vlc": ("VLC Media Player", "VideoLAN"),
    "gimp": ("GIMP Image Editor", "GIMP Team"),
    "inkscape": ("Inkscape", "Inkscape Project"),
    "blender": ("Blender", "Blender Foundation"),
    "remmina": ("Remmina Remote Desktop", "Remmina"),
    "teamviewer": ("TeamViewer", "TeamViewer"),
    "anydesk": ("AnyDesk", "AnyDesk Software"),
    "kesl": ("Kaspersky Endpoint Security", "Kaspersky"),
    "kesl-gui": ("Kaspersky Endpoint Security", "Kaspersky"),
    "docker-ce": ("Docker Engine", "Docker Inc."),
    "docker.io": ("Docker Engine", "Ubuntu"),
    "nodejs": ("Node.js", "Node.js Foundation"),
    "git": ("Git", "Software Freedom Conservancy"),
    "nginx": ("Nginx Web Server", "Nginx"),
    "apache2": ("Apache HTTP Server", "Apache"),
    "postgresql": ("PostgreSQL", "PostgreSQL Global Development Group"),
    "mysql-server": ("MySQL Server", "Oracle"),
    "redis-server": ("Redis Server", "Redis"),
    "openssh-server": ("OpenSSH Server", "OpenBSD"),
    "wireshark": ("Wireshark", "Wireshark Foundation"),
    "virtualbox": ("Oracle VM VirtualBox", "Oracle"),
    "qbittorrent": ("qBittorrent", "qBittorrent Project"),
    "transmission-gtk": ("Transmission BitTorrent", "Transmission Project"),
    "utorrent": ("uTorrent", "BitTorrent Inc."),
}

dpkg_out = run_cmd("dpkg-query -W -f='${Package}\\t${Version}\\t${Maintainer}\\n'")
for line in dpkg_out.splitlines():
    cols = line.split("\t")
    if len(cols) < 2:
        continue
    pkg, ver = cols[0].strip(), cols[1].strip()
    maint = cols[2].strip() if len(cols) >= 3 else "Ubuntu"
    if pkg in important_pkgs:
        display_name, pub = important_pkgs[pkg]
        software_map[display_name.upper()] = {
            "Name": display_name,
            "Version": ver,
            "Publisher": pub
        }

software_list = sorted(software_map.values(), key=lambda x: x["Name"])
print(f" OK ({len(software_list)} apps)")

payload = {
    "serialNumber": serial_number,
    "hostname": hostname,
    "username": current_user,
    "model": model,
    "manufacturer": manufacturer,
    "osName": os_name,
    "osVersion": os_version,
    "cpuName": cpu_name,
    "ramGB": ram_gb,
    "ramDetails": ram_details,
    "gpus": gpu_list,
    "peripherals": peripheral_list,
    "disks": disk_list,
    "monitors": monitor_list,
    "software": software_list,
    "ipAddress": final_ip,
    "macAddress": final_mac,
    "deviceType": device_type,
    "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
}

json_bytes = json.dumps(payload, ensure_ascii=False).encode("utf-8")
print(f"\n>>> GUI DU LIEU VE SERVER ({API_URL})...")

for attempt in range(1, 4):
    try:
        req = urllib.request.Request(
            API_URL,
            data=json_bytes,
            headers={
                "Content-Type": "application/json; charset=utf-8",
                "X-Agent-Secret-Key": AGENT_SECRET_KEY,
                "x-api-key": AGENT_SECRET_KEY
            },
            method="POST"
        )
        with urllib.request.urlopen(req, timeout=30) as resp:
            resp_body = resp.read().decode("utf-8", errors="ignore")
            print(f" SUCCESS: Dong bo thanh cong ({hostname})! Response: {resp_body}")
            break
    except Exception as e:
        print(f" FAILED ({attempt}/3): {e}")
        if attempt < 3:
            time.sleep(5 * attempt)
EOF

