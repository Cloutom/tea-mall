'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { XCircle, ShoppingCart, RotateCcw } from 'lucide-react';

function FailContent() {
  const searchParams = useSearchParams();
  const code = searchParams.get('code');
  const message = searchParams.get('message');

  const isUserCancel = code === 'PAY_PROCESS_CANCELED' || code === 'USER_CANCEL';

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 px-4 py-12">
      <div className="bg-white rounded-3xl border border-gray-100 p-8 max-w-sm w-full text-center shadow-sm">
        <div className="w-20 h-20 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-5">
          <XCircle size={44} className="text-red-400" />
        </div>

        <h1 className="text-xl font-bold text-gray-900 mb-1">
          {isUserCancel ? '결제 취소' : '결제 실패'}
        </h1>
        <p className="text-sm text-gray-500 mb-6">
          {isUserCancel
            ? '결제가 취소되었습니다'
            : message || '결제 처리 중 오류가 발생했습니다'}
        </p>

        {code && !isUserCancel && (
          <p className="text-xs text-gray-300 mb-6 font-mono">오류 코드: {code}</p>
        )}

        <div className="space-y-2.5">
          <Link
            href="/checkout"
            className="flex items-center justify-center gap-2 w-full py-3 rounded-xl bg-tea-700 text-white text-sm font-semibold hover:bg-tea-800 transition-colors"
          >
            <RotateCcw size={16} /> 다시 결제하기
          </Link>
          <Link
            href="/cart"
            className="flex items-center justify-center gap-2 w-full py-3 rounded-xl border border-gray-200 text-gray-600 text-sm font-semibold hover:bg-gray-50 transition-colors"
          >
            <ShoppingCart size={16} /> 장바구니로
          </Link>
        </div>
      </div>

      <p className="mt-6 text-xs text-gray-300">teabri</p>
    </div>
  );
}

export default function CheckoutFailPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-gray-50"><p className="text-gray-400">로딩 중...</p></div>}>
      <FailContent />
    </Suspense>
  );
}
