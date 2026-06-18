import { Response, NextFunction } from 'express';
import { verifyAccessToken } from '../utils/jwt';
import { AuthRequest } from '../types';

export const authenticate = (req: AuthRequest, res: Response, next: NextFunction): void => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      res.status(401).json({ success: false, error: '인증 토큰이 필요합니다.' });
      return;
    }

    const token = authHeader.substring(7);
    const payload = verifyAccessToken(token);

    req.seller = {
      id: payload.sellerId,
      email: payload.email,
      name: payload.name,
      businessVerified: payload.businessVerified,
    };

    next();
  } catch {
    res.status(401).json({ success: false, error: '유효하지 않은 토큰입니다.' });
  }
};

export const requireBusinessVerified = (req: AuthRequest, res: Response, next: NextFunction): void => {
  if (!req.seller?.businessVerified) {
    res.status(403).json({
      success: false,
      error: '사업자 인증이 필요한 기능입니다.',
    });
    return;
  }
  next();
};
