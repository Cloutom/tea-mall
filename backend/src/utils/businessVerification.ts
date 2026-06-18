import axios from 'axios';

interface BusinessVerifyResult {
  valid: boolean;
  status?: string;
  message?: string;
}

// 국세청 사업자 등록번호 진위 확인 API 연동
// 검증 항목: 사업자번호 + 개업일 + 대표자명 + 상호명
export async function verifyBusinessNumber(
  businessNumber: string,
  startDate: string,  // YYYYMMDD
  ownerName: string,
  businessName: string,
): Promise<BusinessVerifyResult> {
  if (process.env.DEV_SKIP_BIZ_VERIFY === 'true') {
    return { valid: true, status: '계속사업자 (개발모드)' };
  }

  if (!process.env.BIZNO_API_KEY) {
    return { valid: false, message: '사업자 인증 서비스가 현재 이용 불가합니다. 관리자에게 문의하세요.' };
  }

  const cleanNumber = businessNumber.replace(/-/g, '');

  if (!/^\d{10}$/.test(cleanNumber)) {
    return { valid: false, message: '사업자 등록번호는 10자리 숫자여야 합니다.' };
  }

  try {
    const response = await axios.post(
      `https://api.odcloud.kr/api/nts-businessman/v1/validate?serviceKey=${process.env.BIZNO_API_KEY}`,
      {
        businesses: [
          {
            b_no: cleanNumber,
            start_dt: startDate,
            p_nm: ownerName,
            b_nm: businessName,
          },
        ],
      },
      { headers: { 'Content-Type': 'application/json' } }
    );

    const result = response.data?.data?.[0];

    if (!result) {
      return { valid: false, message: '국세청에서 사업자 정보를 확인할 수 없습니다.' };
    }

    if (result.valid === 'Y') {
      if (result.b_stt_cd === '02' || result.b_stt === '폐업자') {
        return { valid: false, message: '폐업한 사업자입니다.' };
      }
      return { valid: true, status: result.b_stt };
    }

    // 불일치 항목 안내
    const mismatches: string[] = [];
    if (result.valid !== 'Y') {
      if (result.request_param?.b_nm && result.request_param.b_nm !== businessName) {
        mismatches.push('상호명');
      }
      if (result.request_param?.p_nm && result.request_param.p_nm !== ownerName) {
        mismatches.push('대표자명');
      }
      if (result.request_param?.start_dt && result.request_param.start_dt !== startDate) {
        mismatches.push('개업일');
      }
    }

    const detail = mismatches.length > 0
      ? `입력하신 정보(${mismatches.join(', ')})가 국세청 등록 정보와 일치하지 않습니다.`
      : '입력하신 정보가 국세청 등록 정보와 일치하지 않습니다. 사업자번호, 대표자명, 개업일, 상호명을 확인해주세요.';

    return { valid: false, message: detail };
  } catch {
    return { valid: false, message: '국세청 인증 서버에 연결할 수 없습니다. 잠시 후 다시 시도해주세요.' };
  }
}
