'use client';

import { Suspense, useEffect, useState, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { paymentApi } from '@/lib/api';
import { useCartStore } from '@/store/cartStore';
import { useAuthStore } from '@/store/authStore';
import Link from 'next/link';
import { CheckCircle2, Loader2, Package, ShoppingBag } from 'lucide-react';

function SuccessContent() {
  const searchParams = useSearchParams();
  const clearCart = useCartStore((s) => s.clearCart);
  const { consumer } = useAuthStore();
  const confirmedRef = useRef(false);

  const [state, setState] = useState<'loading' | 'success' | 'error'>('loading');
  const [order, setOrder] = useState<{ orderNumber: string; orderId?: string } | null>(null);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (confirmedRef.current) return;
    confirmedRef.current = true;

    let cancelled = false;

    const biometric = searchParams.get('biometric');
    const biometricOrderNumber = searchParams.get('orderNumber');
    if (biometric && biometricOrderNumber) {
      setOrder({ orderNumber: biometricOrderNumber });
      setState('success');
      return;
    }

    const paymentKey = searchParams.get('paymentKey');
    const orderId = searchParams.get('orderId');
    const amount = searchParams.get('amount');

    if (!paymentKey || !orderId || !amount) {
      setState('error');
      setErrorMsg('결제 정보가 올바르지 않습니다');
      return;
    }

    paymentApi.confirm({ paymentKey, orderId, amount })
      .then((res) => {
        if (cancelled) return;
        const { orderNumber, orderId: dbOrderId } = res.data.data;
        setOrder({ orderNumber: orderNumber || orderId, orderId: dbOrderId });
        clearCart();
        setState('success');
      })
      .catch((err) => {
        if (cancelled) return;
        setState('error');
        setErrorMsg(err?.response?.data?.error || '결제 확인 중 오류가 발생했습니다');
      });

    return () => {
      cancelled = true;
      confirmedRef.current = false;
    };
  }, [searchParams, clearCart]);

  if (state === 'loading') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-gray-50">
        <Loader2 size={36} className="animate-spin text-tea-700" />
        <p className="text-gray-600 font-medium">결제를 확인하고 있습니다...</p>
        <p className="text-xs text-gray-400">잠시만 기다려주세요</p>
      </div>
    );
  }

  if (state === 'error') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-gray-50 px-4">
        <h1 className="text-lg font-bold text-gray-900">결제 확인 실패</h1>
        <p className="text-sm text-gray-500 text-center">{errorMsg}</p>
        <div className="flex gap-3">
          <Link href="/cart"
            className="px-5 py-2.5 rounded-xl border border-gray-200 text-gray-600 text-sm font-semibold hover:bg-gray-50">
            장바구니로
          </Link>
          <Link href="/"
            className="px-5 py-2.5 rounded-xl bg-tea-700 text-white text-sm font-semibold hover:bg-tea-800 transition-colors">
            홈으로
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 px-4 py-12">
      <div className="bg-white rounded-3xl border border-gray-100 p-8 max-w-sm w-full text-center shadow-sm">
        <div className="w-20 h-20 rounded-full bg-tea-50 flex items-center justify-center mx-auto mb-5">
          <CheckCircle2 size={44} className="text-tea-600" />
        </div>

        <h1 className="text-xl font-bold text-gray-900 mb-1">주문 완료!</h1>
        <p className="text-sm text-gray-500 mb-6">결제가 성공적으로 완료되었습니다</p>

        <div className="bg-gray-50 rounded-2xl p-4 mb-4">
          <p className="text-xs text-gray-400 mb-1.5">주문번호</p>
          <p className="text-base font-bold text-gray-800 font-mono tracking-wide">{order?.orderNumber}</p>
        </div>

        <div className="text-xs text-gray-400 space-y-1 mb-6">
          <p>판매자가 주문을 확인 후 배송을 시작합니다.</p>
          {!consumer && (
            <p className="text-amber-600 font-medium">
              비회원 주문 · 주문번호와 연락처로 조회 가능합니다
            </p>
          )}
        </div>

        <div className="space-y-2.5">
          <Link href="/orders"
            className="flex items-center justify-center gap-2 w-full py-3 rounded-xl bg-tea-700 text-white text-sm font-semibold hover:bg-tea-800 transition-colors">
            <Package size={16} />
            {consumer ? '주문 내역 보기' : '주문 조회하기'}
          </Link>
          <Link href="/"
            className="flex items-center justify-center gap-2 w-full py-3 rounded-xl border border-gray-200 text-gray-600 text-sm font-semibold hover:bg-gray-50 transition-colors">
            <ShoppingBag size={16} />
            쇼핑 계속하기
          </Link>
        </div>
      </div>

      <p className="mt-6 text-xs text-gray-300">teabri</p>
    </div>
  );
}

export default function CheckoutSuccessPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-gray-50">
        <Loader2 size={36} className="animate-spin text-tea-700" />
        <p className="text-gray-600 font-medium">로딩 중...</p>
      </div>
    }>
      <SuccessContent />
    </Suspense>
  );
}
