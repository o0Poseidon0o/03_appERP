#!/usr/bin/env bash
# =============================================================================
# BỘ CÀI ĐẶT TỰ ĐỘNG TOWA ITAM AGENT CHO UBUNTU / DEBIAN LINUX (KHÔNG CẦN DOMAIN)
# Cách chạy (chỉ cần chạy 1 lần duy nhất trên máy Ubuntu):
#   sudo bash cai_dat_tu_dong_ubuntu.sh
# Chức năng:
#   1. Cài đặt Agent vào /opt/towa-itam/ubuntu_agent.sh
#   2. Tự động tải bản Agent mới nhất từ Server mỗi khi chạy
#   3. Đăng ký Cronjob (/etc/cron.d/towa-itam) tự động chạy ngầm với quyền root:
#      - Mỗi khi bật máy khởi động (@reboot)
#      - Định kỳ hàng ngày lúc 08:45 và 14:00
#   4. Chạy đồng bộ ngay lập tức lần đầu tiên về Server
# =============================================================================

SERVER_IP="192.168.20.17"
INSTALL_DIR="/opt/towa-itam"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if [ "$(id -u)" -ne 0 ]; then
    echo "[!] Vui lòng chạy bằng quyền sudo: sudo bash cai_dat_tu_dong_ubuntu.sh"
    exit 1
fi

echo "====================================================================="
echo "  CÀI ĐẶT TỰ ĐỘNG TOWA ITAM AGENT CHO UBUNTU / LINUX (KHÔNG DOMAIN)  "
echo "====================================================================="

mkdir -p "$INSTALL_DIR"

# 1. Sao chép hoặc tải ubuntu_agent.sh từ Server
if [ -f "$SCRIPT_DIR/ubuntu_agent.sh" ]; then
    echo "[1/4] Đang sao chép ubuntu_agent.sh vào $INSTALL_DIR..."
    cp "$SCRIPT_DIR/ubuntu_agent.sh" "$INSTALL_DIR/ubuntu_agent.sh"
else
    echo "[1/4] Đang tải ubuntu_agent.sh trực tiếp từ Server $SERVER_IP..."
    if command -v curl >/dev/null 2>&1; then
        curl -fsSL "http://${SERVER_IP}:90/agent/ubuntu_agent.sh" -o "$INSTALL_DIR/ubuntu_agent.sh" || \
        curl -fsSL "http://${SERVER_IP}:3000/api/assets/agent-script/ubuntu" -o "$INSTALL_DIR/ubuntu_agent.sh"
    elif command -v wget >/dev/null 2>&1; then
        wget -qO "$INSTALL_DIR/ubuntu_agent.sh" "http://${SERVER_IP}:90/agent/ubuntu_agent.sh" || \
        wget -qO "$INSTALL_DIR/ubuntu_agent.sh" "http://${SERVER_IP}:3000/api/assets/agent-script/ubuntu"
    fi
fi

chmod +x "$INSTALL_DIR/ubuntu_agent.sh"

# 2. Tạo script auto_runner.sh (Tự cập nhật script mới nhất từ Server trước khi chạy)
cat << 'EOF' > "$INSTALL_DIR/auto_runner.sh"
#!/usr/bin/env bash
SERVER_IP="192.168.20.17"
INSTALL_DIR="/opt/towa-itam"
LOCAL_SCRIPT="$INSTALL_DIR/ubuntu_agent.sh"
TMP_SCRIPT="$INSTALL_DIR/ubuntu_agent.sh.tmp"

if command -v curl >/dev/null 2>&1; then
    if curl -fsSL --max-time 5 "http://${SERVER_IP}:90/agent/ubuntu_agent.sh" -o "$TMP_SCRIPT" 2>/dev/null || \
       curl -fsSL --max-time 5 "http://${SERVER_IP}:3000/api/assets/agent-script/ubuntu" -o "$TMP_SCRIPT" 2>/dev/null; then
        if grep -q "TOWA ITAM AGENT" "$TMP_SCRIPT" 2>/dev/null; then
            mv "$TMP_SCRIPT" "$LOCAL_SCRIPT"
            chmod +x "$LOCAL_SCRIPT"
        fi
    fi
fi
rm -f "$TMP_SCRIPT"

if [ -x "$LOCAL_SCRIPT" ]; then
    "$LOCAL_SCRIPT" >/var/log/towa-itam-agent.log 2>&1
fi
EOF

chmod +x "$INSTALL_DIR/auto_runner.sh"

# 3. Đăng ký Cronjob chạy tự động khi bật máy (@reboot) và 08:45, 14:00 hàng ngày
echo "[2/4] Đang đăng ký Cronjob tự động tại /etc/cron.d/towa-itam..."
cat << EOF > /etc/cron.d/towa-itam
SHELL=/bin/bash
PATH=/usr/local/sbin:/usr/local/bin:/sbin:/bin:/usr/sbin:/usr/bin
@reboot root sleep 45 && /opt/towa-itam/auto_runner.sh
45 8 * * * root /opt/towa-itam/auto_runner.sh
0 14 * * * root /opt/towa-itam/auto_runner.sh
EOF
chmod 644 /etc/cron.d/towa-itam

echo "[3/4] Đã đăng ký lịch tự động chạy ngầm (khi khởi động máy & 08:45, 14:00 hàng ngày)."

# 4. Chạy đồng bộ ngay lập tức lần đầu tiên
echo "[4/4] Đang chạy đồng bộ dữ liệu máy Ubuntu về Server ngay bây giờ..."
"$INSTALL_DIR/ubuntu_agent.sh"

echo ""
echo "====================================================================="
echo "  HOÀN TẤT! Máy Ubuntu này sẽ tự động đồng bộ về Server $SERVER_IP!"
echo "====================================================================="
