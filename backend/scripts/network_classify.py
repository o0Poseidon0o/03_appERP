import sys
import json
import nmap

# CẤU HÌNH PORT QUAN TRỌNG (VĂN PHÒNG + NHÀ MÁY)
# --- Mobile/Apple ---
# 62078: iTunes Wifi Sync (iPhone)
# 5353: mDNS/Bonjour
# 3689: DAAP
# --- Industrial/Factory ---
# 4370: Máy chấm công (ZKTeco)
# 502: Modbus TCP (PLC, Biến tần)
# 102: Siemens S7
# 1883: MQTT (IoT)
# 4840: OPC UA
TARGET_PORTS = '21,22,23,53,80,443,445,554,3389,4370,8000,8080,9100,515,631,3689,5353,62078,502,102,1883,4840,9600'

def get_device_type(mac_vendor, open_ports, hostname, os_family):
    mac_vendor = mac_vendor.lower()
    hostname = hostname.lower()
    
    # --- 1. INDUSTRIAL DEVICES (Ưu tiên số 1 trong Nhà máy) ---
    # Cổng 502 (Modbus) là dấu hiệu rõ nhất của thiết bị công nghiệp
    if 502 in open_ports or 102 in open_ports or 4840 in open_ports:
        return "INDUSTRIAL"
    
    industrial_vendors = [
        'siemens', 'mitsubishi', 'omron', 'schneider', 'rockwell', 'allen-bradley', 
        'keyence', 'fanuc', 'yaskawa', 'delta', 'advantech', 'beckhoff', 'wago'
    ]
    if any(x in mac_vendor for x in industrial_vendors):
        return "INDUSTRIAL"

    # --- 2. TIMEKEEPER (MÁY CHẤM CÔNG) ---
    if 4370 in open_ports: return "TIMEKEEPER"
    if any(x in mac_vendor for x in ['zkteco', 'ronald jack', 'suprema', 'soyal', 'virdi', 'hid global']): 
        return "TIMEKEEPER"

    # --- 3. APPLE DEVICES (IPHONE/IPAD/MAC) ---
    # Cổng Sync của Apple
    if 62078 in open_ports or 3689 in open_ports:
        return "MOBILE" 
    
    if 'iphone' in hostname or 'ipad' in hostname or 'ipod' in hostname:
        return "MOBILE"
    
    if 'apple' in mac_vendor:
        # Nếu mở SSH (22) thường là Macbook/iMac/Server. Nếu không thì là iPhone.
        if 22 in open_ports: return "PC" 
        return "MOBILE"

    # --- 4. ANDROID & MOBILE KHÁC ---
    mobile_vendors = [
        'samsung', 'xiaomi', 'oppo', 'vivo', 'realme', 'huawei', 'oneplus', 
        'tecno', 'infinix', 'vsmart', 'bphone', 'sony', 'nokia', 'lg', 
        'motorola', 'google', 'pixel', 'zte', 'meizu', 'asus' 
    ]
    if any(x in mac_vendor for x in mobile_vendors): 
        # Asus làm cả Laptop và Điện thoại
        if 'asus' in mac_vendor and (445 in open_ports or 3389 in open_ports):
            return "PC"
        return "MOBILE"
    
    if 'galaxy' in hostname or 'android' in hostname or 'redmi' in hostname:
        return "MOBILE"

    # --- 5. CAMERA ---
    if 554 in open_ports or 8000 in open_ports: return "CAMERA"
    if any(x in mac_vendor for x in ['hikvision', 'dahua', 'kbvision', 'hanwha', 'imou', 'ezviz', 'uniview', 'tiandy', 'foscam']): return "CAMERA"
    if 'cam' in hostname or 'ipc' in hostname: return "CAMERA"

    # --- 6. PRINTER ---
    if 9100 in open_ports or 515 in open_ports: return "PRINTER"
    if any(x in mac_vendor for x in ['brother', 'canon', 'epson', 'xerox', 'ricoh', 'konica', 'kyocera', 'fuji']):
        if 'hp' in mac_vendor and 9100 not in open_ports and 445 in open_ports: return "PC"
        return "PRINTER"

    # --- 7. ROUTER/WIFI ---
    if (53 in open_ports or 23 in open_ports) and 445 not in open_ports:
        return "NETWORK_DEVICE"
    if any(x in mac_vendor for x in ['cisco', 'tp-link', 'draytek', 'ubiquiti', 'mikrotik', 'aruba', 'ruijie', 'tenda', 'totolink', 'linksys', 'd-link', 'unifi', 'meraki']):
        return "NETWORK_DEVICE"

    # --- 8. PC/LAPTOP ---
    if 445 in open_ports or 3389 in open_ports or 'windows' in os_family.lower(): return "PC"
    if any(x in mac_vendor for x in ['dell', 'lenovo', 'msi', 'acer', 'gigabyte', 'intel']): return "PC"

    return "UNKNOWN"

def scan_and_classify(subnets):
    results = []
    nm = nmap.PortScanner()
    target_subnets = " ".join(subnets)
    
    try:
        # Bước 1: Ping Scan
        # -sn: Ping Scan, -T4: Aggressive timing (Nhanh)
        nm.scan(hosts=target_subnets, arguments='-sn -T4')
        live_hosts = nm.all_hosts()

        if len(live_hosts) > 0:
            targets = " ".join(live_hosts)
            # Bước 2: Scan Port
            # Thêm --open để chỉ lấy port mở
            nm.scan(hosts=targets, arguments=f'-p {TARGET_PORTS} -T4 --open')

            for host in nm.all_hosts():
                try:
                    mac = nm[host]['addresses'].get('mac', '')
                    vendor = nm[host]['vendor'].get(mac, '') if mac else ''
                    hostname = nm[host].hostname()
                    
                    open_ports = []
                    if 'tcp' in nm[host]:
                        open_ports = list(nm[host]['tcp'].keys())

                    device_type = get_device_type(vendor, open_ports, hostname, '')

                    results.append({
                        "ip": host,
                        "mac": mac,
                        "hostname": hostname,
                        "vendor": vendor,
                        "open_ports": open_ports,
                        "type": device_type,
                        "status": "ONLINE"
                    })
                except:
                    continue
    except Exception as e:
        pass

    print(json.dumps(results))

if __name__ == "__main__":
    if len(sys.argv) > 1:
        scan_and_classify(sys.argv[1:])
    else:
        print("[]")