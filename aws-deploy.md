# AWS 배포 가이드

## 아키텍처 구성

```
[Route 53 DNS]
      │
[CloudFront CDN] ──── [S3 이미지 버킷]
      │
[ALB (Application Load Balancer)]
      │
[EC2 또는 ECS (백엔드 API)]
      │
[RDS PostgreSQL (Multi-AZ)]
```

---

## 1. RDS (PostgreSQL) 설정

### AWS 콘솔에서:
1. RDS → 데이터베이스 생성
2. 엔진: PostgreSQL 16
3. 인스턴스: db.t3.medium (권장)
4. 스토리지: 20GB (gp3)
5. Multi-AZ: 프로덕션에서는 활성화
6. 보안그룹: 백엔드 EC2만 접근 허용 (3306 포트 차단, 5432만 허용)

### DATABASE_URL 형식:
```
postgresql://USERNAME:PASSWORD@your-rds-endpoint.ap-northeast-2.rds.amazonaws.com:5432/tea_mall
```

---

## 2. S3 버킷 설정

```bash
# AWS CLI로 버킷 생성
aws s3 mb s3://tea-mall-images --region ap-northeast-2

# 버킷 정책 (공개 읽기)
aws s3api put-bucket-policy --bucket tea-mall-images --policy '{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Principal": "*",
    "Action": "s3:GetObject",
    "Resource": "arn:aws:s3:::tea-mall-images/*"
  }]
}'

# CORS 설정
aws s3api put-bucket-cors --bucket tea-mall-images --cors-configuration '{
  "CORSRules": [{
    "AllowedOrigins": ["*"],
    "AllowedMethods": ["GET", "PUT", "POST"],
    "AllowedHeaders": ["*"]
  }]
}'
```

---

## 3. EC2 백엔드 배포

### EC2 설정:
- 인스턴스: t3.small (개발) / t3.medium (운영)
- OS: Amazon Linux 2023
- 보안그룹: 80, 443, 4000 포트 허용

### 배포 스크립트:
```bash
# Node.js 설치
curl -fsSL https://rpm.nodesource.com/setup_20.x | sudo bash -
sudo yum install -y nodejs

# PM2 설치
sudo npm install -g pm2

# 코드 클론
git clone https://github.com/your-repo/tea-mall.git
cd tea-mall/backend

# 환경변수 설정
cp .env.example .env
nano .env  # 실제 값으로 수정

# 패키지 설치 및 빌드
npm install
npx prisma generate
npx prisma migrate deploy
npm run build

# PM2로 시작
pm2 start dist/index.js --name tea-mall-backend
pm2 startup
pm2 save
```

---

## 4. 판매자 웹 배포 (Vercel 또는 EC2)

### Vercel 배포 (권장):
```bash
npm install -g vercel
cd seller-web
vercel --prod
```

### 환경변수 (Vercel 대시보드에서 설정):
```
NEXT_PUBLIC_API_URL=https://api.your-domain.com
NEXT_PUBLIC_KAKAO_CLIENT_ID=...
NEXT_PUBLIC_GOOGLE_CLIENT_ID=...
NEXT_PUBLIC_NAVER_CLIENT_ID=...
NEXT_PUBLIC_TOSS_CLIENT_KEY=...
```

---

## 5. 도메인 및 SSL 설정

### Route 53 + ACM:
1. ACM에서 SSL 인증서 발급 (your-domain.com, *.your-domain.com)
2. Route 53 레코드 생성:
   - api.your-domain.com → ALB 또는 EC2
   - seller.your-domain.com → Vercel 또는 S3+CloudFront

---

## 6. Nginx 설정 (EC2에서 리버스 프록시)

```nginx
server {
    listen 80;
    server_name api.your-domain.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl;
    server_name api.your-domain.com;

    ssl_certificate /etc/letsencrypt/live/your-domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/your-domain.com/privkey.pem;

    client_max_body_size 20M;

    location / {
        proxy_pass http://localhost:4000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_cache_bypass $http_upgrade;
    }
}
```

---

## 7. DB 마이그레이션 실행

```bash
# 초기 마이그레이션
cd backend
npx prisma migrate deploy

# 시드 데이터 (카테고리 등)
npx ts-node prisma/seed.ts
```

---

## 비용 예상 (월)

| 서비스 | 사양 | 예상 비용 |
|-------|------|----------|
| RDS db.t3.micro | PostgreSQL | ~$15 |
| EC2 t3.small | 백엔드 API | ~$15 |
| S3 | 이미지 스토리지 | ~$1~5 |
| CloudFront | CDN | ~$1~3 |
| Route 53 | DNS | ~$0.5 |
| **합계** | | **~$35~40/월** |
