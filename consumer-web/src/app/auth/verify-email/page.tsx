'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { consumerAuthApi } from '@/lib/api';
import Link from 'next/link';
import { CheckCircle, XCircle } from 'lucide-react';

function VerifyEmailContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!token) { setStatus('error'); setMessage('유효하지 않은 링크입니다.'); return; }
    consumerAuthApi.verifyEmail(token)
      .then(() => { setStatus('success'); setMessage('이메일 인증이 완료되었습니다!'); })
      .catch((err: any) => { setStatus('error'); setMessage(err?.response?.data?.error || '인증에 실패했습니다.'); });
  }, [token]);

  return (
    <div className="min-h-screen bg-tea-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-lg p-8 w-full max-w-sm text-center">
        <Link href="/" className="block mb-6">
          <span className="text-2xl font-bold text-tea-700">teabri</span>
        </Link>
        {status === 'loading' && (
          <>
            <div className="w-10 h-10 border-4 border-tea-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="text-gray-600 text-sm">인증 처리 중...</p>
          </>
        )}
        {status === 'success' && (
          <>
            <CheckCircle size={48} className="text-green-500 mx-auto mb-4" />
            <h2 className="text-lg font-bold text-gray-900 mb-2">인증 완료</h2>
            <p className="text-gray-600 text-sm mb-6">{message}</p>
            <Link href="/" className="block w-full bg-tea-700 text-white py-3 rounded-xl font-medium hover:bg-tea-800 transition-colors text-sm">
              홈으로 이동
            </Link>
          </>
        )}
        {status === 'error' && (
          <>
            <XCircle size={48} className="text-red-400 mx-auto mb-4" />
            <h2 className="text-lg font-bold text-gray-900 mb-2">인증 실패</h2>
            <p className="text-gray-600 text-sm mb-6">{message}</p>
            <Link href="/" className="block w-full bg-tea-700 text-white py-3 rounded-xl font-medium hover:bg-tea-800 transition-colors text-sm">
              홈으로 이동
            </Link>
          </>
        )}
      </div>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-tea-50" />}>
      <VerifyEmailContent />
    </Suspense>
  );
}
