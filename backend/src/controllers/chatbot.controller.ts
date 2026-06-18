import { Request, Response } from 'express';
import prisma from '../config/database';

// 스토어 챗봇 FAQ 조회 (공개)
export const getStoreFaqs = async (req: Request, res: Response): Promise<void> => {
  try {
    const { slug } = req.params;
    const store = await prisma.store.findUnique({ where: { slug }, select: { id: true } });
    if (!store) { res.status(404).json({ success: false, error: '스토어를 찾을 수 없습니다.' }); return; }

    const faqs = await prisma.chatbotFaq.findMany({
      where: { storeId: store.id, isActive: true },
      orderBy: [{ category: 'asc' }, { order: 'asc' }],
      select: { id: true, question: true, answer: true, category: true },
    });

    res.json({ success: true, data: faqs });
  } catch {
    res.status(500).json({ success: false, error: 'FAQ 조회 중 오류가 발생했습니다.' });
  }
};

// 판매자 FAQ 목록
export const getSellerFaqs = async (req: any, res: Response): Promise<void> => {
  try {
    const store = await prisma.store.findUnique({ where: { sellerId: req.seller!.id } });
    if (!store) { res.status(404).json({ success: false, error: '스토어가 없습니다.' }); return; }

    const faqs = await prisma.chatbotFaq.findMany({
      where: { storeId: store.id },
      orderBy: [{ category: 'asc' }, { order: 'asc' }],
    });

    res.json({ success: true, data: faqs });
  } catch {
    res.status(500).json({ success: false, error: 'FAQ 조회 중 오류가 발생했습니다.' });
  }
};

// 판매자 FAQ 생성
export const createFaq = async (req: any, res: Response): Promise<void> => {
  try {
    const store = await prisma.store.findUnique({ where: { sellerId: req.seller!.id } });
    if (!store) { res.status(404).json({ success: false, error: '스토어가 없습니다.' }); return; }

    const { question, answer, category, order } = req.body;
    if (!question?.trim() || !answer?.trim()) {
      res.status(400).json({ success: false, error: '질문과 답변을 입력해주세요.' }); return;
    }

    const faq = await prisma.chatbotFaq.create({
      data: {
        storeId: store.id,
        question: question.trim(),
        answer: answer.trim(),
        category: category?.trim() || null,
        order: order || 0,
      },
    });

    res.json({ success: true, data: faq });
  } catch {
    res.status(500).json({ success: false, error: 'FAQ 저장 중 오류가 발생했습니다.' });
  }
};

// 판매자 FAQ 수정
export const updateFaq = async (req: any, res: Response): Promise<void> => {
  try {
    const store = await prisma.store.findUnique({ where: { sellerId: req.seller!.id } });
    if (!store) { res.status(404).json({ success: false, error: '스토어가 없습니다.' }); return; }

    const faq = await prisma.chatbotFaq.findFirst({ where: { id: req.params.id, storeId: store.id } });
    if (!faq) { res.status(404).json({ success: false, error: 'FAQ를 찾을 수 없습니다.' }); return; }

    const { question, answer, category, order, isActive } = req.body;
    const updated = await prisma.chatbotFaq.update({
      where: { id: req.params.id },
      data: {
        ...(question !== undefined ? { question: question.trim() } : {}),
        ...(answer !== undefined ? { answer: answer.trim() } : {}),
        ...(category !== undefined ? { category: category?.trim() || null } : {}),
        ...(order !== undefined ? { order } : {}),
        ...(isActive !== undefined ? { isActive } : {}),
      },
    });

    res.json({ success: true, data: updated });
  } catch {
    res.status(500).json({ success: false, error: 'FAQ 수정 중 오류가 발생했습니다.' });
  }
};

// 판매자 FAQ 삭제
export const deleteFaq = async (req: any, res: Response): Promise<void> => {
  try {
    const store = await prisma.store.findUnique({ where: { sellerId: req.seller!.id } });
    if (!store) { res.status(404).json({ success: false, error: '스토어가 없습니다.' }); return; }

    await prisma.chatbotFaq.deleteMany({ where: { id: req.params.id, storeId: store.id } });
    res.json({ success: true, message: '삭제되었습니다.' });
  } catch {
    res.status(500).json({ success: false, error: 'FAQ 삭제 중 오류가 발생했습니다.' });
  }
};
