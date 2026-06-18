import { Request, Response } from 'express';
import axios from 'axios';
import prisma from '../config/database';
import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from '@simplewebauthn/server';

type AuthReq = Request & { consumerId?: string };

const TOSS_SECRET = process.env.TOSS_SECRET_KEY || 'test_sk_zXLkKEypNArWmo50nX3lmeaxYG5R';
const tossAuth = () => 'Basic ' + Buffer.from(TOSS_SECRET + ':').toString('base64');

const RP_ID = process.env.WEBAUTHN_RP_ID || 'localhost';
const RP_NAME = process.env.WEBAUTHN_RP_NAME || '차 마켓';
const ORIGIN = process.env.WEBAUTHN_ORIGIN || 'http://localhost:3000';

// ── Toss Billing Key ──────────────────────────────────────────────────────────

export const confirmBillingKey = async (req: AuthReq, res: Response): Promise<void> => {
  try {
    const { authKey } = req.body;
    const consumerId = req.consumerId!;
    const customerKey = `consumer_${consumerId}`;

    if (!authKey) { res.status(400).json({ success: false, error: 'authKey가 필요합니다' }); return; }

    const { data: tossData } = await axios.post(
      `https://api.tosspayments.com/v1/billing/authorizations/${authKey}`,
      { customerKey },
      { headers: { Authorization: tossAuth(), 'Content-Type': 'application/json' } }
    );

    await prisma.consumerBillingKey.updateMany({ where: { consumerId }, data: { isDefault: false } });
    const billing = await prisma.consumerBillingKey.create({
      data: {
        consumerId,
        billingKey: tossData.billingKey,
        customerKey,
        cardCompany: tossData.card?.company || null,
        cardNumber: tossData.card?.number || null,
        isDefault: true,
      },
    });

    res.json({ success: true, data: billing });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.response?.data?.message || '카드 등록 실패' });
  }
};

export const getBillingKeys = async (req: AuthReq, res: Response): Promise<void> => {
  try {
    const keys = await prisma.consumerBillingKey.findMany({
      where: { consumerId: req.consumerId! },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
    });
    res.json({ success: true, data: keys });
  } catch { res.status(500).json({ success: false, error: '조회 실패' }); }
};

export const deleteBillingKey = async (req: AuthReq, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const key = await prisma.consumerBillingKey.findFirst({ where: { id, consumerId: req.consumerId! } });
    if (!key) { res.status(404).json({ success: false, error: '카드를 찾을 수 없습니다' }); return; }
    await prisma.consumerBillingKey.delete({ where: { id } });
    res.json({ success: true });
  } catch { res.status(500).json({ success: false, error: '카드 삭제 실패' }); }
};

export const payWithBillingKey = async (req: AuthReq, res: Response): Promise<void> => {
  try {
    const { billingKeyId, orderId, amount, orderName } = req.body;
    const consumerId = req.consumerId!;
    const consumer = await prisma.consumer.findUnique({ where: { id: consumerId } });
    if (!consumer) { res.status(404).json({ success: false, error: '회원 정보 없음' }); return; }

    const billing = await prisma.consumerBillingKey.findFirst({ where: { id: billingKeyId, consumerId } });
    if (!billing) { res.status(404).json({ success: false, error: '등록된 카드를 찾을 수 없습니다' }); return; }

    const order = await prisma.order.findFirst({ where: { orderNumber: orderId }, include: { items: true } });
    if (!order || order.status !== 'PENDING') {
      res.status(400).json({ success: false, error: '결제할 수 없는 주문입니다' }); return;
    }
    if (Math.abs(order.finalAmount - Number(amount)) > 1) {
      res.status(400).json({ success: false, error: '결제 금액이 일치하지 않습니다' }); return;
    }

    const { data: tossData } = await axios.post(
      `https://api.tosspayments.com/v1/billing/${billing.billingKey}`,
      {
        customerKey: billing.customerKey,
        amount: Number(amount),
        orderId,
        orderName,
        customerEmail: consumer.email,
        customerName: consumer.name,
      },
      { headers: { Authorization: tossAuth(), 'Content-Type': 'application/json' } }
    );

    await prisma.order.update({
      where: { id: order.id },
      data: { status: 'CONFIRMED', paymentMethod: 'billing', paymentId: tossData.paymentKey, paidAt: new Date() },
    });
    await Promise.all(order.items?.map?.((item: any) =>
      prisma.product.updateMany({
        where: { id: item.productId },
        data: { stock: { decrement: item.quantity }, totalSales: { increment: item.quantity } },
      })
    ) || []);

    res.json({ success: true, data: { orderNumber: order.orderNumber, orderId: order.id } });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.response?.data?.message || '결제 실패' });
  }
};

// ── WebAuthn ──────────────────────────────────────────────────────────────────

export const getWebAuthnRegisterOptions = async (req: AuthReq, res: Response): Promise<void> => {
  try {
    const consumer = await prisma.consumer.findUnique({
      where: { id: req.consumerId! },
      include: { webAuthnCreds: true },
    });
    if (!consumer) { res.status(404).json({ success: false, error: '회원 정보 없음' }); return; }

    const existingCreds = consumer.webAuthnCreds.map((c) => ({
      id: Buffer.from(c.credentialId, 'base64url'),
      type: 'public-key' as const,
    }));

    const options = await generateRegistrationOptions({
      rpName: RP_NAME,
      rpID: RP_ID,
      userID: consumer.id,
      userName: consumer.email,
      userDisplayName: consumer.name,
      attestationType: 'none',
      excludeCredentials: existingCreds,
      authenticatorSelection: { authenticatorAttachment: 'platform', userVerification: 'required' },
    });

    await prisma.consumer.update({
      where: { id: consumer.id },
      data: {
        webAuthnChallenge: options.challenge,
        webAuthnChallengeExpiry: new Date(Date.now() + 5 * 60 * 1000),
      },
    });

    res.json({ success: true, data: options });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message || '등록 옵션 생성 실패' });
  }
};

export const verifyWebAuthnRegistration = async (req: AuthReq, res: Response): Promise<void> => {
  try {
    const { credential, deviceName } = req.body;
    const consumer = await prisma.consumer.findUnique({ where: { id: req.consumerId! } });
    if (!consumer?.webAuthnChallenge || !consumer.webAuthnChallengeExpiry) {
      res.status(400).json({ success: false, error: '챌린지가 없습니다. 다시 시도해주세요.' }); return;
    }
    if (new Date() > consumer.webAuthnChallengeExpiry) {
      res.status(400).json({ success: false, error: '챌린지가 만료되었습니다.' }); return;
    }

    const verification = await verifyRegistrationResponse({
      response: credential,
      expectedChallenge: consumer.webAuthnChallenge,
      expectedOrigin: ORIGIN,
      expectedRPID: RP_ID,
      requireUserVerification: true,
    });

    if (!verification.verified || !verification.registrationInfo) {
      res.status(400).json({ success: false, error: '생체인증 등록 실패' }); return;
    }

    const { credentialPublicKey, credentialID, counter } = verification.registrationInfo;
    const credIdB64 = Buffer.from(credentialID).toString('base64url');
    const pubKeyB64 = Buffer.from(credentialPublicKey).toString('base64');

    await prisma.webAuthnCredential.create({
      data: {
        consumerId: consumer.id,
        credentialId: credIdB64,
        publicKey: pubKeyB64,
        counter,
        name: deviceName || '이 기기',
        transports: credential.response?.transports ? JSON.stringify(credential.response.transports) : null,
      },
    });
    await prisma.consumer.update({
      where: { id: consumer.id },
      data: { webAuthnChallenge: null, webAuthnChallengeExpiry: null },
    });

    res.json({ success: true, message: '지문인증이 등록되었습니다.' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message || '등록 검증 실패' });
  }
};

export const getWebAuthnAuthOptions = async (req: AuthReq, res: Response): Promise<void> => {
  try {
    const consumer = await prisma.consumer.findUnique({
      where: { id: req.consumerId! },
      include: { webAuthnCreds: true },
    });
    if (!consumer) { res.status(404).json({ success: false, error: '회원 정보 없음' }); return; }
    if (!consumer.webAuthnCreds.length) {
      res.status(400).json({ success: false, error: '등록된 생체인증 수단이 없습니다' }); return;
    }

    const allowCredentials = consumer.webAuthnCreds.map((c) => ({
      id: Buffer.from(c.credentialId, 'base64url'),
      type: 'public-key' as const,
      transports: c.transports ? JSON.parse(c.transports) : undefined,
    }));

    const options = await generateAuthenticationOptions({
      rpID: RP_ID,
      userVerification: 'required',
      allowCredentials,
    });

    await prisma.consumer.update({
      where: { id: consumer.id },
      data: {
        webAuthnChallenge: options.challenge,
        webAuthnChallengeExpiry: new Date(Date.now() + 5 * 60 * 1000),
      },
    });

    res.json({ success: true, data: options });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message || '인증 옵션 생성 실패' });
  }
};

export const verifyWebAuthnAuth = async (req: AuthReq, res: Response): Promise<void> => {
  try {
    const { credential } = req.body;
    const consumer = await prisma.consumer.findUnique({
      where: { id: req.consumerId! },
      include: { webAuthnCreds: true },
    });
    if (!consumer?.webAuthnChallenge || !consumer.webAuthnChallengeExpiry) {
      res.status(400).json({ success: false, error: '챌린지가 없습니다.' }); return;
    }
    if (new Date() > consumer.webAuthnChallengeExpiry) {
      res.status(400).json({ success: false, error: '챌린지가 만료되었습니다.' }); return;
    }

    const credIdB64 = Buffer.from(credential.rawId, 'base64url').toString('base64url');
    const storedCred = consumer.webAuthnCreds.find((c) => c.credentialId === credIdB64);
    if (!storedCred) { res.status(400).json({ success: false, error: '등록되지 않은 인증 수단입니다.' }); return; }

    const authenticator = {
      credentialID: Buffer.from(storedCred.credentialId, 'base64url'),
      credentialPublicKey: Buffer.from(storedCred.publicKey, 'base64'),
      counter: storedCred.counter,
      transports: storedCred.transports ? JSON.parse(storedCred.transports) : undefined,
    };

    const verification = await verifyAuthenticationResponse({
      response: credential,
      expectedChallenge: consumer.webAuthnChallenge,
      expectedOrigin: ORIGIN,
      expectedRPID: RP_ID,
      authenticator,
      requireUserVerification: true,
    });

    if (!verification.verified) {
      res.status(400).json({ success: false, error: '생체인증 실패' }); return;
    }

    await prisma.webAuthnCredential.update({
      where: { id: storedCred.id },
      data: { counter: verification.authenticationInfo.newCounter },
    });
    await prisma.consumer.update({
      where: { id: consumer.id },
      data: { webAuthnChallenge: null, webAuthnChallengeExpiry: null },
    });

    res.json({ success: true, message: '생체인증 성공' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message || '인증 검증 실패' });
  }
};

export const getWebAuthnCreds = async (req: AuthReq, res: Response): Promise<void> => {
  try {
    const creds = await prisma.webAuthnCredential.findMany({
      where: { consumerId: req.consumerId! },
      select: { id: true, name: true, createdAt: true },
    });
    res.json({ success: true, data: creds });
  } catch { res.status(500).json({ success: false, error: '조회 실패' }); }
};

export const deleteWebAuthnCred = async (req: AuthReq, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const cred = await prisma.webAuthnCredential.findFirst({ where: { id, consumerId: req.consumerId! } });
    if (!cred) { res.status(404).json({ success: false, error: '인증 수단을 찾을 수 없습니다' }); return; }
    await prisma.webAuthnCredential.delete({ where: { id } });
    res.json({ success: true });
  } catch { res.status(500).json({ success: false, error: '삭제 실패' }); }
};