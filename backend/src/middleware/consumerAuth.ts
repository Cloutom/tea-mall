import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

const ACCESS_SECRET = process.env.CONSUMER_JWT_SECRET || 'consumer-access-secret-change-in-prod';

export const consumerAuth = (req: Request, res: Response, next: NextFunction): void => {
  const auth = req.headers.authorization;
  if (!auth?.startsWith('Bearer ')) {
    res.status(401).json({ success: false, error: '인증이 필요합니다.' });
    return;
  }
  try {
    const payload = jwt.verify(auth.slice(7), ACCESS_SECRET) as any;
    if (payload.type !== 'consumer') {
      res.status(401).json({ success: false, error: '잘못된 토큰 유형입니다.' });
      return;
    }
    (req as any).consumerId = payload.id;
    next();
  } catch (err: any) {
    const msg = err?.name === 'TokenExpiredError' ? '토큰이 만료되었습니다.' : '유효하지 않은 토큰입니다.';
    res.status(401).json({ success: false, error: msg });
  }
};

export const consumerAuthOptional = (req: Request, res: Response, next: NextFunction): void => {
  const auth = req.headers.authorization;
  if (auth?.startsWith('Bearer ')) {
    try {
      const payload = jwt.verify(auth.slice(7), ACCESS_SECRET) as any;
      if (payload.type === 'consumer') (req as any).consumerId = payload.id;
    } catch {}
  }
  next();
};