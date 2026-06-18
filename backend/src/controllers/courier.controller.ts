import { Response } from 'express';
import prisma from '../config/database';
import { AuthRequest } from '../types';

export const getCourierAccounts = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const store = await prisma.store.findUnique({ where: { sellerId: req.seller!.id } });
    if (!store) { res.status(404).json({ success: false, error: '스토어가 없습니다.' }); return; }
    const accounts = await prisma.courierAccount.findMany({ where: { storeId: store.id }, orderBy: { createdAt: 'asc' } });
    res.json({ success: true, data: accounts });
  } catch {
    res.status(500).json({ success: false, error: '택배사 계정 조회 실패' });
  }
};

export const createCourierAccount = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const store = await prisma.store.findUnique({ where: { sellerId: req.seller!.id } });
    if (!store) { res.status(404).json({ success: false, error: '스토어가 없습니다.' }); return; }

    const {
      courierCode, courierName, accountId, clientKey,
      senderName, senderPhone, senderZipCode, senderAddress, senderAddressDetail, isDefault,
    } = req.body;

    if (isDefault === 'true' || isDefault === true) {
      await prisma.courierAccount.updateMany({ where: { storeId: store.id }, data: { isDefault: false } });
    }

    const existing = await prisma.courierAccount.count({ where: { storeId: store.id } });
    const setDefault = isDefault === 'true' || isDefault === true || existing === 0;

    const account = await prisma.courierAccount.create({
      data: {
        storeId: store.id,
        courierCode, courierName, accountId, clientKey,
        senderName, senderPhone, senderZipCode, senderAddress, senderAddressDetail,
        isDefault: setDefault,
      },
    });
    res.status(201).json({ success: true, data: account });
  } catch {
    res.status(500).json({ success: false, error: '택배사 계정 등록 실패' });
  }
};

export const updateCourierAccount = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const store = await prisma.store.findUnique({ where: { sellerId: req.seller!.id } });
    if (!store) { res.status(404).json({ success: false, error: '스토어가 없습니다.' }); return; }

    const account = await prisma.courierAccount.findFirst({ where: { id: req.params.accountId, storeId: store.id } });
    if (!account) { res.status(404).json({ success: false, error: '계정을 찾을 수 없습니다.' }); return; }

    const {
      courierCode, courierName, accountId, clientKey,
      senderName, senderPhone, senderZipCode, senderAddress, senderAddressDetail, isDefault,
    } = req.body;

    const setDefault = isDefault === 'true' || isDefault === true;
    if (setDefault) {
      await prisma.courierAccount.updateMany({ where: { storeId: store.id }, data: { isDefault: false } });
    }

    const updated = await prisma.courierAccount.update({
      where: { id: account.id },
      data: { courierCode, courierName, accountId, clientKey, senderName, senderPhone, senderZipCode, senderAddress, senderAddressDetail, isDefault: setDefault },
    });
    res.json({ success: true, data: updated });
  } catch {
    res.status(500).json({ success: false, error: '택배사 계정 수정 실패' });
  }
};

export const deleteCourierAccount = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const store = await prisma.store.findUnique({ where: { sellerId: req.seller!.id } });
    if (!store) { res.status(404).json({ success: false, error: '스토어가 없습니다.' }); return; }

    await prisma.courierAccount.deleteMany({ where: { id: req.params.accountId, storeId: store.id } });
    res.json({ success: true });
  } catch {
    res.status(500).json({ success: false, error: '택배사 계정 삭제 실패' });
  }
};

export const setDefaultCourier = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const store = await prisma.store.findUnique({ where: { sellerId: req.seller!.id } });
    if (!store) { res.status(404).json({ success: false, error: '스토어가 없습니다.' }); return; }

    await prisma.courierAccount.updateMany({ where: { storeId: store.id }, data: { isDefault: false } });
    await prisma.courierAccount.updateMany({ where: { id: req.params.accountId, storeId: store.id }, data: { isDefault: true } });
    res.json({ success: true });
  } catch {
    res.status(500).json({ success: false, error: '기본 택배사 설정 실패' });
  }
};
