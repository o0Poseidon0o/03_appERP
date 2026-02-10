# backend/scripts/network_classify.py
import nmap
import sys
import json
import argparse

# Cấu hình các Port đặc thù để nhận diện (Quét ít port cho nhanh)
# 554: RTSP (Camera), 9100: JetDirect (Printer), 445: SMB (Windows), 22: SSH (Network/Linux)
# 80/443: Web UI, 4370: ZKTeco (Chấm công)
TARGET_PORTS = '21,22,23,80,443,445,554,3389,4370,8000,8080,9100'

def get_device_type(mac_vendor, open_ports, hostname, os_family):
    mac_vendor = mac_vendor.lower()
    hostname = hostname.lower()
    
    # 1. Nhận diện CAMERA
    if 554 in open_ports or 8000 in open_ports:
        return "CAMERA"
    if any(x in mac_vendor for x in ['hikvision', 'dahua', 'kbvision', 'hanwha', 'ezviz', 'imou']):
        return "CAMERA"
    if 'cam' in hostname or 'ipc' in hostname:
        return "CAMERA"

    # 2. Nhận diện PRINTER (Máy in)
    if 9100 in open_ports or 515 in open_ports or 631 in open_ports:
        return "PRINTER"
    if any(x in mac_vendor for x in ['brother', 'canon', 'epson', 'xerox', 'ricoh', 'konica']):
        # Cẩn thận HP, HP có cả Laptop. Nếu là HP mà ko mở port 9100 thì có thể là Laptop
        return "PRINTER"

    # 3. Nhận diện MÁY CHẤM CÔNG
    if 4370 in open_ports or 'zkteco' in mac_vendor or 'ronald jack' in mac_vendor:
        return "TIMEKEEPER"

    # 4. Nhận diện WIFI/ROUTER/SWITCH
    if (22 in open_ports or 23 in open_ports) and not (445 in open_ports):
        # Mở SSH/Telnet mà ko mở SMB thì thường là thiết bị mạng hoặc Linux Server
        if any(x in mac_vendor for x in ['cisco', 'tp-link', 'draytek', 'ubiquiti', 'mikrotik', 'aruba']):
            return "NETWORK_DEVICE"

    # 5. Nhận diện PC/LAPTOP (Windows)
    # Port 445 (SMB) hoặc 3389 (RDP) hoặc 135/139 (NetBIOS) là đặc trưng của Windows
    if 445 in open_ports or 3389 in open_ports or 'windows' in os_family.lower():
        return "PC"
    
    # Fallback cho PC nếu Vendor là hãng máy tính lớn
    if any(x in mac_vendor for x in ['dell', 'lenovo', 'asus', 'msi', 'acer']):
        return "PC"

    # 6. Mobile (Điện thoại) - Thường khó quét port, dựa vào Vendor
    if any(x in mac_vendor for x in ['apple', 'samsung', 'xiaomi', 'oppo', 'vivo']):
        return "MOBILE"

    return "UNKNOWN"

def scan_and_classify(subnets):
    nm = nmap.PortScanner()
    results = []

    # Tham số Nmap:
    # -sn: Ping Scan (Bỏ qua bước này nếu muốn quét port luôn, nhưng nên lọc IP sống trước)
    # -PS: TCP SYN Ping
    # -p: Chỉ quét các port chỉ định (nhanh hơn quét full)
    # -T4: Tốc độ cao
    # --open: Chỉ quan tâm port mở
    scan_args = f'-p {TARGET_PORTS} -T4 --open'

    for subnet in subnets:
        try:
            # Bước 1: Quét Ping nhanh để tìm host Online
            nm.scan(hosts=subnet, arguments='-sn -T4')
            live_hosts = nm.all_hosts()

            if not live_hosts:
                continue

            # Bước 2: Quét sâu các host đang Online
            # Chuyển list IP thành chuỗi: "192.168.1.5 192.168.1.10"
            target_str = " ".join(live_hosts)
            nm.scan(hosts=target_str, arguments=scan_args)

            for host in nm.all_hosts():
                # Lấy thông tin cơ bản
                mac = nm[host]['addresses'].get('mac', '')
                vendor = nm[host]['vendor'].get(mac, '') if mac else ''
                hostname = nm[host].hostname()
                
                # Lấy danh sách Port đang mở
                open_ports = []
                if 'tcp' in nm[host]:
                    open_ports = list(nm[host]['tcp'].keys())
                
                # Phân loại
                device_type = get_device_type(vendor, open_ports, hostname, '')

                results.append({
                    "ip": host,
                    "mac": mac,
                    "hostname": hostname,
                    "vendor": vendor,
                    "open_ports": open_ports,
                    "type": device_type, # KẾT QUẢ PHÂN LOẠI QUAN TRỌNG NHẤT
                    "status": "ONLINE"
                })

        except Exception as e:
            # sys.stderr.write(str(e))
            pass

    print(json.dumps(results))

if __name__ == "__main__":
    if len(sys.argv) > 1:
        scan_and_classify(sys.argv[1:])
    else:
        print("[]")