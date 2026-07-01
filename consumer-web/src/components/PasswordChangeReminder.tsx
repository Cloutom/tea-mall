'use client';

import { useState, useEffect } from 'react';
import { useAuthStore } from '@/store/authStore';
import { consumerAuthApi } from '@/lib/api';
import Link from 'next/link';

const THREE_MONTHS = 90 * 24 * 60 * 60 * 1000;
const DISMISS_KEY = 'pw-remind-dismiss';

export default function PasswordChangeReminder() {
  const { accessToken, consumer } = useAuthStore();
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (!accessToken || !consumer) return;
    const dismissed = localStorage.getItem(DISMISS_KEY);
    if (dismissed && Date.now() - parseInt(dismissed) < 24 * 60 * 60 * 1000) return;

    consumerAuthApi.me(accessToken).then(r => {
      const data = r.data.data;
      if (!data) return;
      const changedAt = data.passwordChangedAt ? new Date(data.passwordChangedAt).getTime() : new Date(data.createdAt).getTime();
      if (Date.now() - changedAt > THREE_MONTHS) setShow(true);
    }).catch(() => {});
  }, [accessToken, consumer]);

  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
    setShow(false);
  };

  if (!show) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl text-center">
        <div className="w-14 h-14 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#d97706" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
          </svg>
        </div>
        <h3 className="text-lg font-bold text-gray-900 mb-2">비밀번호 변경 안내</h3>
        <p className="text-sm text-gray-500 mb-1">비밀번호를 변경한 지 3개월이 지났습니다.</p>
        <p className="text-sm text-gray-500 mb-5">안전한 서비스 이용을 위해 비밀번호를 변경해주세요.</p>
        <div className="flex gap-2">
          <button onClick={dismiss}
            className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm font-medium text-gray-500 hover:bg-gray-50">
            다음에 변경
          </button>
          <Link href="/profile/security" onClick={() => setShow(false)}
            className="flex-1 py-2.5 bg-tea-600 text-white rounded-xl text-sm font-medium text-center hover:bg-tea-700">
            지금 변경하기
          </Link>
        </div>
      </div>
    </div>
  );
}
