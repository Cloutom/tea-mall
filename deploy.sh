#!/bin/bash
# ============================================================
# tea-mall EC2 배포 스크립트
# EC2 Ubuntu 22.04 에서 실행
# 사용법: chmod +x deploy.sh && ./deploy.sh
# ============================================================

set -e

echo "=========================================="
echo " tea-mall 배포 시작"
echo "=========================================="

# 1. 시스템 업데이트
echo "[1/8] 시스템 업데이트..."
sudo apt update && sudo apt upgrade -y

# 2. Node.js 20 LTS 설치
echo "[2/8] Node.js 20 설치..."
if ! command -v node &> /dev/null; then
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    sudo apt install -y nodejs
fi
echo "Node.js: $(node -v)"
echo "npm: $(npm -v)"

# 3. PM2 설치
echo "[3/8] PM2 설치..."
sudo npm install -g pm2

# 4. nginx 설치
echo "[4/8] nginx 설치..."
sudo apt install -y nginx

# 5. 프로젝트 의존성 설치
echo "[5/8] 의존성 설치..."
cd ~/tea-mall

cd backend && npm install && cd ..
cd consumer-web && npm install && cd ..
cd seller-web && npm install && cd ..

# 6. 빌드
echo "[6/8] 빌드..."
cd backend && npm run build && cd ..

# Prisma 클라이언트 생성 + DB 마이그레이션
cd backend && npx prisma generate && npx prisma db push && cd ..

cd consumer-web && npm run build && cd ..
cd seller-web && npm run build && cd ..

# 7. nginx 설정
echo "[7/8] nginx 설정..."
sudo cp nginx.conf /etc/nginx/sites-available/tea-mall
sudo ln -sf /etc/nginx/sites-available/tea-mall /etc/nginx/sites-enabled/tea-mall
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl restart nginx

# 8. PM2로 앱 시작
echo "[8/8] PM2 시작..."
pm2 delete all 2>/dev/null || true
pm2 start ecosystem.config.js
pm2 save
pm2 startup systemd -u $USER --hp $HOME | tail -1 | bash

echo ""
echo "=========================================="
echo " 배포 완료!"
echo "=========================================="
echo ""
echo " Consumer: http://$(curl -s ifconfig.me)"
echo " Seller:   http://$(curl -s ifconfig.me):8080"
echo " API:      http://$(curl -s ifconfig.me)/api/health"
echo ""
echo " PM2 상태: pm2 status"
echo " 로그:     pm2 logs"
echo ""
