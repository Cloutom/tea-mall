import { Request, Response } from 'express';
import prisma from '../config/database';

// 스토어 QnA 목록 조회 (공개 - 비공개 제외)
export const getStoreQnAs = async (req: Request, res: Response): Promise<void> => {
  try {
    const { slug } = req.params;
    const store = await prisma.store.findUnique({ where: { slug }, select: { id: true } });
    if (!store) { res.status(404).json({ success: false, error: '스토어를 찾을 수 없습니다.' }); return; }

    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;

    const [qnas, total] = await Promise.all([
      prisma.storeQnA.findMany({
        where: { storeId: store.id, isPrivate: false },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true, buyerName: true, question: true,
          answer: true, isAnswered: true, answeredAt: true, createdAt: true,
        },
      }),
      prisma.storeQnA.count({ where: { storeId: store.id, isPrivate: false } }),
    ]);

    res.json({ success: true, data: qnas, pagination: { total, page, limit, totalPages: Math.ceil(total / limit) } });
  } catch {
    res.status(500).json({ success: false, error: 'QnA 조회 중 오류가 발생했습니다.' });
  }
};

// QnA 등록 (비회원도 가능)
export const createQnA = async (req: Request, res: Response): Promise<void> => {
  try {
    const { slug } = req.params;
    const store = await prisma.store.findUnique({ where: { slug }, select: { id: true } });
    if (!store) { res.status(404).json({ success: false, error: '스토어를 찾을 수 없습니다.' }); return; }

    const { buyerName, question, isPrivate, consumerId } = req.body;
    if (!buyerName?.trim() || !question?.trim()) {
      res.status(400).json({ success: false, error: '이름과 질문을 입력해주세요.' }); return;
    }
    if (question.trim().length < 5) {
      res.status(400).json({ success: false, error: '질문을 5자 이상 작성해주세요.' }); return;
    }

    const qna = await prisma.storeQnA.create({
      data: {
        storeId: store.id,
        consumerId: consumerId || null,
        buyerName: buyerName.trim(),
        question: question.trim(),
        isPrivate: !!isPrivate,
      },
    });

    res.json({ success: true, data: qna });
  } catch {
    res.status(500).json({ success: false, error: 'QnA 등록 중 오류가 발생했습니다.' });
  }
};

// 판매자 QnA 목록 조회
export const getSellerQnAs = async (req: any, res: Response): Promise<void> => {
  try {
    const store = await prisma.store.findUnique({ where: { sellerId: req.seller!.id } });
    if (!store) { res.status(404).json({ success: false, error: '스토어가 없습니다.' }); return; }

    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const unanswered = req.query.unanswered === 'true' || req.query.unanswered === '1';

    const [qnas, total] = await Promise.all([
      prisma.storeQnA.findMany({
        where: { storeId: store.id, ...(unanswered ? { isAnswered: false } : {}) },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.storeQnA.count({ where: { storeId: store.id, ...(unanswered ? { isAnswered: false } : {}) } }),
    ]);

    res.json({ success: true, data: qnas, pagination: { total, page, limit, totalPages: Math.ceil(total / limit) } });
  } catch {
    res.status(500).json({ success: false, error: 'QnA 조회 중 오류가 발생했습니다.' });
  }
};

// 판매자 QnA 답변
export const answerQnA = async (req: any, res: Response): Promise<void> => {
  try {
    const store = await prisma.store.findUnique({ where: { sellerId: req.seller!.id } });
    if (!store) { res.status(404).json({ success: false, error: '스토어가 없습니다.' }); return; }

    const { answer } = req.body;
    if (!answer?.trim()) { res.status(400).json({ success: false, error: '답변 내용을 입력해주세요.' }); return; }

    const qna = await prisma.storeQnA.findFirst({ where: { id: req.params.id, storeId: store.id } });
    if (!qna) { res.status(404).json({ success: false, error: 'QnA를 찾을 수 없습니다.' }); return; }

    const updated = await prisma.storeQnA.update({
      where: { id: req.params.id },
      data: { answer: answer.trim(), isAnswered: true, answeredAt: new Date() },
    });

    res.json({ success: true, data: updated });
  } catch {
    res.status(500).json({ success: false, error: '답변 저장 중 오류가 발생했습니다.' });
  }
};
