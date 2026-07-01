import crypto from 'crypto';
import axios from 'axios';

export function generateCode(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

export async function sendSMS(to: string, text: string): Promise<boolean> {
  const apiKey = process.env.COOLSMS_API_KEY;
  const apiSecret = process.env.COOLSMS_API_SECRET;
  const sender = process.env.COOLSMS_SENDER;

  if (!apiKey || !apiSecret || !sender) {
    console.log(`[SMS 개발모드] To: ${to} | 내용: ${text}`);
    return true;
  }

  try {
    const phone = to.replace(/-/g, '');
    const from = sender.replace(/-/g, '');
    const date = new Date().toISOString();
    const salt = crypto.randomBytes(32).toString('hex');
    const signature = crypto.createHmac('sha256', apiSecret).update(date + salt).digest('hex');

    const isLong = text.length > 45;
    const res = await axios.post(
      'https://api.solapi.com/messages/v4/send',
      {
        message: {
          to: phone,
          from,
          text,
          type: isLong ? 'LMS' : 'SMS',
          ...(isLong ? { subject: '[teabri]' } : {}),
        },
      },
      {
        headers: {
          Authorization: `HMAC-SHA256 apiKey=${apiKey}, date=${date}, salt=${salt}, signature=${signature}`,
          'Content-Type': 'application/json',
        },
      }
    );
    console.log(`[SMS 발송 성공] To: ${to}`, res.data?.statusCode || '');
    return true;
  } catch (err: any) {
    console.error('[SMS 발송 실패]', err.response?.data || err.message);
    return false;
  }
}
