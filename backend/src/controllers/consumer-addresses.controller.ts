import { Request, Response } from 'express';
import prisma from '../config/database';

type AuthReq = Request & { consumerId?: string };

export const getAddresses = async (req: AuthReq, res: Response): Promise<void> => {
  try {
    const addresses = await prisma.consumerAddress.findMany({
      where: { consumerId: req.consumerId! },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
    });
    res.json({ success: true, data: addresses });
  } catch { res.status(500).json({ success: false, error: '배송지 조회 실패' }); }
};

export const createAddress = async (req: AuthReq, res: Response): Promise<void> => {
  try {
    const { label, recipientName, recipientPhone, zipCode, address, addressDetail, isDefault } = req.body;
    if (!recipientName || !recipientPhone || !zipCode || !address) {
      res.status(400).json({ success: false, error: '필수 정보를 입력해주세요' }); return;
    }
    if (isDefault) {
      await prisma.consumerAddress.updateMany({
        where: { consumerId: req.consumerId! },
        data: { isDefault: false },
      });
    }
    const count = await prisma.consumerAddress.count({ where: { consumerId: req.consumerId! } });
    const addr = await prisma.consumerAddress.create({
      data: {
        consumerId: req.consumerId!,
        label: label || '집',
        recipientName,
        recipientPhone,
        zipCode,
        address,
        addressDetail,
        isDefault: isDefault || count === 0,
      },
    });
    res.json({ success: true, data: addr });
  } catch { res.status(500).json({ success: false, error: '배송지 추가 실패' }); }
};

export const updateAddress = async (req: AuthReq, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { label, recipientName, recipientPhone, zipCode, address, addressDetail, isDefault } = req.body;
    const existing = await prisma.consumerAddress.findFirst({ where: { id, consumerId: req.consumerId! } });
    if (!existing) { res.status(404).json({ success: false, error: '배송지를 찾을 수 없습니다' }); return; }
    if (isDefault) {
      await prisma.consumerAddress.updateMany({
        where: { consumerId: req.consumerId!, id: { not: id } },
        data: { isDefault: false },
      });
    }
    const updated = await prisma.consumerAddress.update({
      where: { id },
      data: { label, recipientName, recipientPhone, zipCode, address, addressDetail, isDefault },
    });
    res.json({ success: true, data: updated });
  } catch { res.status(500).json({ success: false, error: '배송지 수정 실패' }); }
};

export const deleteAddress = async (req: AuthReq, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const existing = await prisma.consumerAddress.findFirst({ where: { id, consumerId: req.consumerId! } });
    if (!existing) { res.status(404).json({ success: false, error: '배송지를 찾을 수 없습니다' }); return; }
    await prisma.consumerAddress.delete({ where: { id } });
    // 삭제 후 남은 주소가 있으면 첫 번째를 기본으로
    if (existing.isDefault) {
      const first = await prisma.consumerAddress.findFirst({ where: { consumerId: req.consumerId! }, orderBy: { createdAt: 'asc' } });
      if (first) await prisma.consumerAddress.update({ where: { id: first.id }, data: { isDefault: true } });
    }
    res.json({ success: true });
  } catch { res.status(500).json({ success: false, error: '배송지 삭제 실패' }); }
};

export const setDefaultAddress = async (req: AuthReq, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const existing = await prisma.consumerAddress.findFirst({ where: { id, consumerId: req.consumerId! } });
    if (!existing) { res.status(404).json({ success: false, error: '배송지를 찾을 수 없습니다' }); return; }
    await prisma.consumerAddress.updateMany({ where: { consumerId: req.consumerId! }, data: { isDefault: false } });
    await prisma.consumerAddress.update({ where: { id }, data: { isDefault: true } });
    res.json({ success: true });
  } catch { res.status(500).json({ success: false, error: '기본 배송지 설정 실패' }); }
};