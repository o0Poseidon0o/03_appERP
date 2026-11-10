#!/usr/bin/env bash
# =============================================================================
# SCRIPT TRIỂN KHAI / KHỞI ĐỘNG LẠI DOCKER TRÊN UBUNTU SERVER
# Khắc phục triệt để lỗi KeyError: 'ContainerConfig' của docker-compose 1.29.2
# =============================================================================

set -e

echo "=== [1/3] Dọn dẹp container cũ để tránh lỗi KeyError: 'ContainerConfig' ==="
docker rm -f towa_backend towa_fontend 2>/dev/null || true

echo "=== [2/3] Build và khởi chạy lại hệ thống ==="
if docker compose version >/dev/null 2>&1; then
    docker compose up -d --build
else
    docker-compose up -d --build
fi

echo "=== [3/3] Kiểm tra trạng thái các Container ==="
docker ps
echo "Hoàn tất! Hãy đợi khoảng 5-10 giây để towa_backend khởi động hoàn tất rồi đăng nhập lại."

