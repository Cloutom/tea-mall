'use client';

import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { billingApi, webAuthnApi } from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import NavBar from '@/components/NavBar';
import toast from 'react-hot-toast';
import { CreditCard, Fingerprint, Trash2, Plus, CheckCircle, AlertCircle } from 'lucide-react';
import { startRegistration } from '@simplewebauthn/browser';
import { loadTossPayments } from '@tosspayments/tosspayments-sdk';

const TOSS_CLIENT_KEY = process.env.NEXT_PUBLIC_TOSS_CLIENT_KEY || 'test_ck_D5GePWvyJnrK0W0k6q8gLzN97Eon';

export default function BillingPage() {
  const { accessToken, consumer } = useAuthStore();
  const qc = useQueryClient();
  const [webAuthnSupported, setWebAuthnSupported] = useState(false);
  const [biometricLoading, setBiometricLoading] = useState(false);
  const [cardLoading, setCardLoading] = useState(false);
  const confirmDoneRef = useRef(false);

  useEffect(() => {
    setWebAuthnSupported(
      typeof window !== 'undefined' &&
      !!window.PublicKeyCredential &&
      typeof window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable === 'function'
    );
  }, []);

  const { data: cards = [] } = useQuery({
    queryKey: ['billing-keys', accessToken],
    queryFn: () => billingApi.getAll(accessToken!).then((r) => r.data.data),
    enabled: !!accessToken,
  });

  const { data: webAuthnCreds = [] } = useQuery({
    queryKey: ['webauthn-creds', accessToken],
    queryFn: () => webAuthnApi.getAll(accessToken!).then((r) => r.data.data),
    enabled: !!accessToken,
  });

  const refetch = () => {
    qc.invalidateQueries({ queryKey: ['billing-keys'] });
    qc.invalidateQueries({ queryKey: ['webauthn-creds'] });
  };

  // Toss Billing 카드 등록 (npm 패키지)
  const handleAddCard = async () => {
    if (!consumer || !accessToken) return;
    setCardLoading(true);
    try {
      const tossPayments = await loadTossPayments(TOSS_CLIENT_KEY);
      const payment = tossPayments.payment({ customerKey: `consumer_${consumer.id}` });
      await payment.requestBillingAuth({
        method: 'CARD',
        successUrl: `${window.location.origin}/profile/billing?success=1`,
        failUrl: `${window.location.origin}/profile/billing?fail=1`,
        customerEmail: consumer.email,
        customerName: consumer.name,
      });
      // requestBillingAuth는 페이지를 리다이렉트하므로 여기 미도달
    } catch (err: any) {
      if (err?.code !== 'USER_CANCEL') toast.error('카드 등록에 실패했습니다');
      setCardLoading(false);
    }
  };

  // Toss billing auth 성공 콜백 처리
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const authKey = params.get('authKey');
    const success = params.get('success');

    if (!authKey || success !== '1') return;
    if (!accessToken) return; // 아직 hydration 중, accessToken 생기면 재실행
    if (confirmDoneRef.current) return;
    confirmDoneRef.current = true;

    billingApi.confirm({ authKey }, accessToken)
      .then(() => { toast.success('카드가 등록되었습니다'); refetch(); })
      .catch((err: any) => toast.error(err?.response?.data?.error || '카드 등록에 실패했습니다'))
      .finally(() => window.history.replaceState({}, '', '/profile/billing'));

    return () => { confirmDoneRef.current = false; };
  }, [accessToken]); // eslint-disable-line

  const deleteCardMutation = useMutation({
    mutationFn: (id: string) => billingApi.delete(id, accessToken!),
    onSuccess: () => { toast.success('카드가 삭제되었습니다'); refetch(); },
    onError: () => toast.error('삭제 실패'),
  });

  // 지문인증 등록
  const handleRegisterBiometric = async () => {
    if (!accessToken) return;
    setBiometricLoading(true);
    try {
      const { data: optRes } = await webAuthnApi.getRegisterOptions(accessToken);
      const credential = await startRegistration(optRes.data);
      await webAuthnApi.register({ credential, deviceName: navigator.platform || '이 기기' }, accessToken);
      toast.success('지문인증이 등록되었습니다');
      refetch();
    } catch (err: any) {
      if (err?.name !== 'NotAllowedError') toast.error(err?.message || '지문인증 등록 실패');
    } finally {
      setBiometricLoading(false);
    }
  };

  const deleteBiometricMutation = useMutation({
    mutationFn: (id: string) => webAuthnApi.delete(id, accessToken!),
    onSuccess: () => { toast.success('삭제되었습니다'); refetch(); },
    onError: () => toast.error('삭제 실패'),
  });

  return (
    <div className="min-h-screen bg-gray-50 pb-10">
      <NavBar title="결제수단 · 지문인증" back="/profile" />
      <div className="max-w-2xl mx-auto px-4 py-5 space-y-5">

        {/* 등록 카드 */}
        <div className="bg-white rounded-2xl border border-gray-100 p-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-800 flex items-center gap-2">
              <CreditCard size={16} className="text-tea-600" /> 등록 카드
            </h2>
            <button
              onClick={handleAddCard}
              disabled={cardLoading}
              className="flex items-center gap-1 text-xs px-3 py-1.5 bg-tea-700 text-white rounded-lg hover:bg-tea-800 transition-colors disabled:opacity-50"
            >
              <Plus size={13} /> {cardLoading ? '이동 중...' : '카드 추가'}
            </button>
          </div>

          {(cards as any[]).length === 0 ? (
            <div className="text-center py-8 text-gray-400 text-sm">
              <CreditCard size={32} className="mx-auto mb-2 text-gray-200" />
              <p>등록된 카드가 없습니다</p>
              <p className="text-xs mt-1 text-gray-300">카드를 등록하면 지문인증으로 빠르게 결제할 수 있어요</p>
              <button
                onClick={handleAddCard}
                disabled={cardLoading}
                className="mt-4 flex items-center gap-1.5 mx-auto text-sm px-4 py-2 bg-tea-700 text-white rounded-xl hover:bg-tea-800 transition-colors disabled:opacity-50"
              >
                <Plus size={14} /> {cardLoading ? '이동 중...' : '첫 카드 등록하기'}
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              {(cards as any[]).map((card) => (
                <div key={card.id} className={`flex items-center justify-between p-3 rounded-xl border ${card.isDefault ? 'border-tea-300 bg-tea-50' : 'border-gray-100'}`}>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-7 bg-gradient-to-br from-gray-700 to-gray-900 rounded-md flex items-center justify-center">
                      <span className="text-white text-xs font-bold">CARD</span>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-800">{card.cardCompany || '카드'}</p>
                      <p className="text-xs text-gray-400">{card.cardNumber || '****-****-****-****'}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {card.isDefault && <span className="text-xs text-tea-700 font-medium px-2 py-0.5 bg-tea-100 rounded-full">기본</span>}
                    <button
                      onClick={() => deleteCardMutation.mutate(card.id)}
                      className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 지문인증 */}
        <div className="bg-white rounded-2xl border border-gray-100 p-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-800 flex items-center gap-2">
              <Fingerprint size={16} className="text-tea-600" /> 지문인증 등록
            </h2>
          </div>

          {!webAuthnSupported ? (
            <div className="flex items-center gap-2 p-3 bg-amber-50 rounded-xl text-sm text-amber-700">
              <AlertCircle size={16} className="shrink-0" />
              이 기기에서는 지문인증을 지원하지 않습니다
            </div>
          ) : (cards as any[]).length === 0 ? (
            <div className="flex items-center gap-2 p-3 bg-blue-50 rounded-xl text-sm text-blue-700">
              <AlertCircle size={16} className="shrink-0" />
              지문인증을 등록하려면 먼저 카드를 등록해주세요
            </div>
          ) : (
            <>
              {(webAuthnCreds as any[]).length > 0 && (
                <div className="space-y-2 mb-3">
                  {(webAuthnCreds as any[]).map((cred) => (
                    <div key={cred.id} className="flex items-center justify-between p-3 rounded-xl border border-green-100 bg-green-50">
                      <div className="flex items-center gap-2">
                        <CheckCircle size={16} className="text-green-600" />
                        <div>
                          <p className="text-sm font-medium text-gray-800">{cred.name || '이 기기'}</p>
                          <p className="text-xs text-gray-400">{new Date(cred.createdAt).toLocaleDateString('ko-KR')} 등록</p>
                        </div>
                      </div>
                      <button
                        onClick={() => deleteBiometricMutation.mutate(cred.id)}
                        className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <button
                onClick={handleRegisterBiometric}
                disabled={biometricLoading}
                className="w-full py-3 rounded-xl border-2 border-dashed border-tea-200 text-tea-700 hover:border-tea-400 hover:bg-tea-50 transition-colors flex items-center justify-center gap-2 text-sm font-medium disabled:opacity-50"
              >
                <Fingerprint size={16} />
                {biometricLoading ? '등록 중...' : `${(webAuthnCreds as any[]).length > 0 ? '다른 기기 ' : ''}지문인증 등록`}
              </button>
            </>
          )}
        </div>

        <div className="bg-amber-50 rounded-2xl p-4 text-xs text-amber-700 space-y-1">
          <p className="font-medium">지문인증 결제란?</p>
          <p>카드를 등록하고 지문인증 수단을 등록하면, 결제 시 지문(Face ID / Touch ID)만으로 빠르게 결제할 수 있습니다.</p>
        </div>
      </div>
    </div>
  );
}
