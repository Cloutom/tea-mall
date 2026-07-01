import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import path from 'path';

import authRoutes from './routes/auth';
import storeRoutes from './routes/store';
import productRoutes from './routes/products';
import orderRoutes from './routes/orders';
import analyticsRoutes from './routes/analytics';
import courierRoutes from './routes/courier';
import publicRoutes from './routes/public';
import paymentRoutes from './routes/payments';
import consumerAuthRoutes from './routes/consumer-auth';
import reviewRoutes from './routes/review';
import qnaRoutes from './routes/qna';
import chatbotRoutes from './routes/chatbot';
import adminRoutes from './routes/admin';
import { errorHandler, notFound } from './middleware/errorHandler';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 4000;

app.set('trust proxy', 1);

// 보안 미들웨어
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));

// CORS 설정
const allowedOrigins = [
  process.env.CLIENT_URL || 'http://localhost:3000',
  process.env.SELLER_CLIENT_URL || 'http://localhost:3001',
  'http://localhost:3002',
].filter(Boolean);
app.use(cors({
  origin: allowedOrigins,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// 기본 미들웨어
app.use(compression());
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

// Rate Limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 500,
  message: { success: false, error: '너무 많은 요청이 발생했습니다. 잠시 후 다시 시도해주세요.' },
});
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { success: false, error: '로그인 시도가 너무 많습니다. 15분 후 다시 시도해주세요.' },
});
const adminLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { success: false, error: '관리자 로그인 시도가 너무 많습니다. 15분 후 다시 시도해주세요.' },
});

app.use('/api', limiter);
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);
app.use('/api/consumer/auth/login', authLimiter);
app.use('/api/admin/login', adminLimiter);
app.use('/api/auth/phone', authLimiter);
app.use('/api/consumer/auth/phone', authLimiter);

// 정적 파일 (S3 전환 전까지 프로덕션에서도 사용)
app.use('/uploads', (req, res, next) => {
  res.removeHeader('Content-Security-Policy');
  next();
}, express.static(path.join(__dirname, '../uploads')));

// 헬스 체크
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString(), env: process.env.NODE_ENV });
});

// API 라우터
app.use('/api/auth', authRoutes);
app.use('/api/seller/store', storeRoutes);
app.use('/api/seller/products', productRoutes);
app.use('/api/seller/orders', orderRoutes);
app.use('/api/seller/analytics', analyticsRoutes);
app.use('/api/seller/courier', courierRoutes);
app.use('/api/public', publicRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/consumer/auth', consumerAuthRoutes);
app.use('/api/public', reviewRoutes);
app.use('/api/public', qnaRoutes);
app.use('/api/public', chatbotRoutes);
app.use('/api/admin', adminRoutes);

// 에러 핸들러
app.use(notFound);
app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`teabri 백엔드 서버 시작 | 포트: ${PORT} | 환경: ${process.env.NODE_ENV || 'development'}`);
});

export default app;
