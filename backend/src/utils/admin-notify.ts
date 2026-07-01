import prisma from '../config/database';
import { sendSMS } from './sms';

async function getAdminPhone(): Promise<string | null> {
  const admin = await prisma.admin.findFirst({ select: { phone: true } });
  return admin?.phone || null;
}

export async function notifyAdminNewSeller(sellerName: string, email: string) {
  const phone = await getAdminPhone();
  if (!phone) return;
  await sendSMS(phone, `[teabri] 신규 판매자 가입\n이름: ${sellerName}\n이메일: ${email}\n판매자 관리 페이지에서 승인해주세요.`);
}

export async function notifyAdminNewReport(reason: string, targetType: string) {
  const phone = await getAdminPhone();
  if (!phone) return;
  await sendSMS(phone, `[teabri] 신규 신고 접수\n유형: ${targetType}\n사유: ${reason}\n신고 관리 페이지를 확인해주세요.`);
}

export async function notifyAdminWithdrawRequest(sellerName: string) {
  const phone = await getAdminPhone();
  if (!phone) return;
  await sendSMS(phone, `[teabri] 폐업 신청\n판매자: ${sellerName}\n판매자 관리 페이지에서 확인해주세요.`);
}

export async function notifyAdminNewInquiry(buyerName: string, question: string) {
  const phone = await getAdminPhone();
  if (!phone) return;
  const preview = question.length > 30 ? question.slice(0, 30) + '...' : question;
  await sendSMS(phone, `[teabri] 1:1 문의 접수\n문의자: ${buyerName}\n내용: ${preview}\n문의 관리 페이지를 확인해주세요.`);
}
