import sys
import json
import nmap

# Cấu hình các Script bảo mật của Nmap (NSE)
# vuln: Tìm các lỗ hổng đã biết (CVE)
# auth: Kiểm tra mật khẩu yếu/mặc định (Cẩn thận khi dùng cho PLC)
# default: Các script cơ bản an toàn
SCAN_ARGUMENTS = '-Pn -sV --script vuln' 

def audit_security(target_ip):
    nm = nmap.PortScanner()
    result = {
        "ip": target_ip,
        "score": 100, # Điểm an toàn (trừ dần nếu thấy lỗi)
        "vulnerabilities": [],
        "warnings": []
    }

    try:
        # Quét lỗ hổng (Sẽ mất khoảng 30s - 2 phút/máy)
        nm.scan(hosts=target_ip, arguments=SCAN_ARGUMENTS)
        
        if target_ip not in nm.all_hosts():
            result["error"] = "Host offline or blocked"
            print(json.dumps(result))
            return

        host_data = nm[target_ip]
        
        # 1. Duyệt qua các cổng TCP
        if 'tcp' in host_data:
            for port, info in host_data['tcp'].items():
                # Kiểm tra kết quả script từ Nmap
                if 'script' in info:
                    for script_name, output in info['script'].items():
                        # Nếu phát hiện lỗi nghiêm trọng
                        if 'vulnerable' in output.lower() or 'cve' in output.lower():
                            result["score"] -= 20
                            result["vulnerabilities"].append({
                                "port": port,
                                "service": info['name'],
                                "issue": script_name,
                                "detail": output[:200] + "..." # Cắt ngắn cho gọn
                            })
                        else:
                            result["warnings"].append({
                                "port": port,
                                "service": info['name'],
                                "issue": script_name
                            })

    except Exception as e:
        result["error"] = str(e)

    # Đảm bảo điểm không âm
    if result["score"] < 0: result["score"] = 0
    
    print(json.dumps(result))

if __name__ == "__main__":
    if len(sys.argv) > 1:
        # Chỉ nhận 1 IP duy nhất để quét sâu
        audit_security(sys.argv[1])
    else:
        print("{}")