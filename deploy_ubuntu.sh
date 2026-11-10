#!/usr/bin/env bash
# =============================================================================
# SCRIPT TRIỂN KHAI / KHỞI ĐỘNG LẠI DOCKER TRÊN UBUNTU SERVER
# Khắc phục vĩnh viễn lỗi KeyError: 'ContainerConfig' của docker-compose 1.29.2
# =============================================================================

set -e

echo "=== [1/4] Vá lỗi KeyError: 'ContainerConfig' trong docker-compose 1.29.2 ==="
if [ -f /usr/lib/python3/dist-packages/compose/service.py ]; then
    sed -i "s/container.image_config\['ContainerConfig'\]/container.image_config.get('ContainerConfig', {})/g" /usr/lib/python3/dist-packages/compose/service.py || true
fi

echo "=== [2/4] Xóa các container bị kẹt (bao gồm cả 6c829c474554_towa_backend) ==="
docker container prune -f
docker rm -f $(docker ps -a -q --filter "name=towa_backend" --filter "name=towa_fontend") 2>/dev/null || true

echo "=== [3/4] Build và khởi chạy lại hệ thống ==="
if docker compose version >/dev/null 2>&1; then
    docker compose up -d --build
else
    docker-compose up -d --build
fi

echo "=== [4/4] Kiểm tra trạng thái các Container ==="
docker ps
