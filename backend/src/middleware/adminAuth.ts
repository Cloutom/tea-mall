import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret';

export const authenticateAdmin = (req: Request, res: Response, next: NextFunction): void => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ success: false, error: '관리자 인증이 필요합니다.' });
    return;
  }

  try {
    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    if (decoded.role !== 'admin') {
      res.status(403).json({ success: false, error: '관리자 권한이 필요합니다.' });
      return;
    }
    (req as any).admin = decoded;
    next();
  } catch {
    res.status(401).json({ success: false, error: '인증이 만료되었습니다.' });
  }
};
