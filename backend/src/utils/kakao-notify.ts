import axios from 'axios';
import prisma from '../config/database';
import { sendSMS } from './sms';

const KAKAO_REST_KEY = process.env.KAKAO_REST_API_KEY || '';
const KAKAO_REDIRECT = process.env.KAKAO_CHANNEL_REDIRECT || '';

export function getKakaoAuthUrl(sellerId: string): string {
  return `https://kauth.kakao.com/oauth/authorize?client_id=${KAKAO_REST_KEY}&redirect_uri=${encodeURIComponent(KAKAO_REDIRECT)}&response_type=code&scope=talk_message&state=${sellerId}`;
}

export async function handleKakaoCallback(code: string, sellerId: string) {
  const tokenRes = await axios.post('https://kauth.kakao.com/oauth/token', null, {
    params: {
      grant_type: 'authorization_code',
      client_id: KAKAO_REST_KEY,
      redirect_uri: KAKAO_REDIRECT,
      code,
    },
  });

  const { access_token, refresh_token, expires_in } = tokenRes.data;
  await prisma.seller.update({
    where: { id: sellerId },
    data: {
      kakaoAccessToken: access_token,
      kakaoRefreshToken: refresh_token,
      kakaoTokenExpiry: new Date(Date.now() + expires_in * 1000),
      kakaoConnected: true,
      notifyKakao: true,
    },
  });
}

async function refreshKakaoToken(sellerId: string, refreshToken: string): Promise<string | null> {
  try {
    const res = await axios.post('https://kauth.kakao.com/oauth/token', null, {
      params: {
        grant_type: 'refresh_token',
        client_id: KAKAO_REST_KEY,
        refresh_token: refreshToken,
      },
    });
    const { access_token, refresh_token, expires_in } = res.data;
    await prisma.seller.update({
      where: { id: sellerId },
      data: {
        kakaoAccessToken: access_token,
        ...(refresh_token && { kakaoRefreshToken: refresh_token }),
        kakaoTokenExpiry: new Date(Date.now() + expires_in * 1000),
      },
    });
    return access_token;
  } catch {
    await prisma.seller.update({
      where: { id: sellerId },
      data: { kakaoConnected: false, kakaoAccessToken: null, kakaoRefreshToken: null },
    });
    return null;
  }
}

async function sendKakaoMessage(sellerId: string, accessToken: string, refreshToken: string, text: string): Promise<boolean> {
  const send = async (token: string) => {
    await axios.post('https://kapi.kakao.com/v2/api/talk/memo/default/send', null, {
      params: {
        template_object: JSON.stringify({
          object_type: 'text',
          text,
          link: { web_url: 'http://51.21.167.165:8080/dashboard/orders', mobile_web_url: 'http://51.21.167.165:8080/dashboard/orders' },
          button_title: '주문 확인하기',
        }),
      },
      headers: { Authorization: `Bearer ${token}` },
    });
  };

  try {
    await send(accessToken);
    return true;
  } catch (err: any) {
    if (err.response?.status === 401 && refreshToken) {
      const newToken = await refreshKakaoToken(sellerId, refreshToken);
      if (newToken) {
        try { await send(newToken); return true; } catch { return false; }
      }
    }
    return false;
  }
}

export async function notifySellerNewOrder(order: {
  orderNumber: string;
  storeId: string;
  finalAmount: number;
  buyerName: string;
  items: { productName: string; quantity: number }[];
}) {
  try {
    const store = await prisma.store.findUnique({
      where: { id: order.storeId },
      select: {
        name: true,
        seller: {
          select: {
            id: true, phone: true, notifyOrder: true, notifyKakao: true,
            kakaoConnected: true, kakaoAccessToken: true, kakaoRefreshToken: true,
          },
        },
      },
    });
    if (!store?.seller || !store.seller.notifyOrder) return;

    const itemSummary = order.items.length === 1
      ? `${order.items[0].productName} ${order.items[0].quantity}개`
      : `${order.items[0].productName} 외 ${order.items.length - 1}건`;

    const message =
      `[teabri] 새 주문!\n` +
      `주문번호: ${order.orderNumber}\n` +
      `상품: ${itemSummary}\n` +
      `결제금액: ${order.finalAmount.toLocaleString()}원\n` +
      `주문자: ${order.buyerName}`;

    let sent = false;
    if (store.seller.notifyKakao && store.seller.kakaoConnected && store.seller.kakaoAccessToken) {
      sent = await sendKakaoMessage(
        store.seller.id, store.seller.kakaoAccessToken,
        store.seller.kakaoRefreshToken || '', message,
      );
    }

    if (!sent && store.seller.phone) {
      await sendSMS(store.seller.phone, message);
    }
  } catch (err) {
    console.error('[판매자 알림 실패]', err);
  }
}

export async function notifySellerOrderStatus(order: {
  orderNumber: string;
  storeId: string;
  status: string;
  buyerName: string;
}) {
  try {
    const store = await prisma.store.findUnique({
      where: { id: order.storeId },
      select: {
        seller: {
          select: {
            id: true, phone: true, notifyOrder: true, notifyKakao: true,
            kakaoConnected: true, kakaoAccessToken: true, kakaoRefreshToken: true,
          },
        },
      },
    });
    if (!store?.seller || !store.seller.notifyOrder) return;

    const statusLabels: Record<string, string> = {
      REFUND_REQ: '환불 요청', CANCELLED: '주문 취소', PURCHASE_CONFIRMED: '구매 확정',
    };
    const label = statusLabels[order.status];
    if (!label) return;

    const message = `[teabri] ${label}\n주문번호: ${order.orderNumber}\n주문자: ${order.buyerName}`;

    let sent = false;
    if (store.seller.notifyKakao && store.seller.kakaoConnected && store.seller.kakaoAccessToken) {
      sent = await sendKakaoMessage(
        store.seller.id, store.seller.kakaoAccessToken,
        store.seller.kakaoRefreshToken || '', message,
      );
    }

    if (!sent && store.seller.phone) {
      await sendSMS(store.seller.phone, message);
    }
  } catch (err) {
    console.error('[판매자 상태알림 실패]', err);
  }
}
