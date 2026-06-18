'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useCartStore } from '@/store/cartStore';
import { paymentApi, addressApi, billingApi, webAuthnApi } from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import { useQuery } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { User, Phone, Mail, MapPin, MessageSquare, ChevronDown, ChevronUp, Fingerprint, CreditCard, BookOpen } from 'lucide-react';
import AddressSearch from '@/components/AddressSearch';
import NavBar from '@/components/NavBar';
import { startAuthentication } from '@simplewebauthn/browser';
import { loadTossPayments, ANONYMOUS } from '@tosspayments/tosspayments-sdk';
import Link from 'next/link';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? '';
const imgUrl = (p?: string | null) => p ? (p.startsWith('/') ? `${API_URL}${p}` : p) : null;
const SAVED_KEY = 'tea-mall-buyer-info';
const DELIVERY_MEMOS = ['문 앞에 놓아주세요', '경비실에 맡겨주세요', '벨 누르지 말아주세요', '부재 시 연락 주세요', '직접 입력'];

const PAYMENT_METHODS = [
  { key: 'KAKAO', label: '카카오페이', bg: '#FEE500', text: '#3C1E1E' },
  { key: 'TOSSPAY', label: '토스페이', bg: '#0064FF', text: '#fff' },
  { key: 'NAVERPAY', label: '네이버페이', bg: '#03C75A', text: '#fff' },
  { key: 'TRANSFER', label: '계좌이체', bg: '#2D3748', text: '#fff' },
] as const;

export default function CheckoutPage() {
  const router = useRouter();
  const { items, totalPrice } = useCartStore();
  const { consumer, accessToken } = useAuthStore();

  const [form, setForm] = useState({
    name: '', phone: '', email: '',
    recipientName: '', recipientPhone: '',
    address: '', addressDetail: '', zipCode: '',
    deliveryMemo: '', deliveryMemoCustom: '',
    sameAsOrderer: true,
  });
  const [saveInfo, setSaveInfo] = useState(true);
  const [loading, setLoading] = useState(false);
  const [selectedMethod, setSelectedMethod] = useState<string>('CARD');
  const [shippingLoading, setShippingLoading] = useState(true);
  const [showOrderItems, setShowOrderItems] = useState(false);
  const [showAddressPicker, setShowAddressPicker] = useState(false);
  const [shippingFee, setShippingFee] = useState(0);
  const [shippingInfo, setShippingInfo] = useState<{ shippingFee: number; freeShippingThreshold: number | null } | null>(null);
  const processingRef = useRef(false);

  const clientKey = process.env.NEXT_PUBLIC_TOSS_CLIENT_KEY || 'test_ck_D5GePWvyJnrK0W0k6q8gLzN97Eon';
  const itemsTotal = totalPrice();

  // 저장된 배송지 (회원)
  const { data: savedAddresses = [] } = useQuery({
    queryKey: ['addresses', accessToken],
    queryFn: () => addressApi.getAll(accessToken!).then((r) => r.data.data),
    enabled: !!accessToken && !!consumer,
  });

  // 저장 카드 + WebAuthn 정보
  const { data: billingKeys = [] } = useQuery({
    queryKey: ['billing-keys', accessToken],
    queryFn: () => billingApi.getAll(accessToken!).then((r) => r.data.data),
    enabled: !!accessToken && !!consumer,
  });
  const { data: webAuthnCreds = [] } = useQuery({
    queryKey: ['webauthn-creds', accessToken],
    queryFn: () => webAuthnApi.getAll(accessToken!).then((r) => r.data.data),
    enabled: !!accessToken && !!consumer,
  });

  const canBiometricPay = (billingKeys as any[]).length > 0 && (webAuthnCreds as any[]).length > 0;
  const defaultBillingKey = (billingKeys as any[]).find((k: any) => k.isDefault) || (billingKeys as any[])[0];

  // 스토어 배송비 로드
  useEffect(() => {
    if (items.length === 0) { router.replace('/cart'); return; }
    const storeSlug = items[0]?.storeSlug;
    if (!storeSlug) { setShippingLoading(false); return; }
    fetch(`${API_URL}/api/public/stores/${storeSlug}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.success) {
          const { shippingFee: sf, freeShippingThreshold: fst } = d.data;
          setShippingInfo({ shippingFee: sf ?? 0, freeShippingThreshold: fst ?? null });
        }
      })
      .catch(() => {})
      .finally(() => setShippingLoading(false));
  }, []); // eslint-disable-line

  // 배송비 재계산
  useEffect(() => {
    if (!shippingInfo) return;
    const { shippingFee: sf, freeShippingThreshold: fst } = shippingInfo;
    setShippingFee(fst !== null && itemsTotal >= fst ? 0 : sf);
  }, [shippingInfo, itemsTotal]);

  const total = itemsTotal + shippingFee;

  // 폼 초기값 (회원 정보 / 로컬스토리지)
  useEffect(() => {
    if (items.length === 0) return;
    if (consumer) {
      setForm((f) => ({ ...f, name: f.name || consumer.name, phone: f.phone || consumer.phone || '', email: f.email || consumer.email }));
      const defaultAddr = (savedAddresses as any[]).find((a: any) => a.isDefault);
      if (defaultAddr && !form.address) applyAddress(defaultAddr);
    } else {
      try {
        const saved = JSON.parse(localStorage.getItem(SAVED_KEY) || '{}');
        if (saved.name) setForm((f) => ({ ...f, ...saved }));
      } catch {}
    }
  }, [consumer, savedAddresses]); // eslint-disable-line

  const applyAddress = (addr: any) => {
    setForm((f) => ({
      ...f,
      address: addr.address,
      zipCode: addr.zipCode,
      addressDetail: addr.addressDetail || '',
      recipientName: f.sameAsOrderer ? f.name : addr.recipientName,
      recipientPhone: f.sameAsOrderer ? f.phone : addr.recipientPhone,
    }));
    if (!form.sameAsOrderer) {
      setForm((f) => ({ ...f, recipientName: addr.recipientName, recipientPhone: addr.recipientPhone }));
    }
    setShowAddressPicker(false);
  };

  const handleOrdererChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setForm((f) => ({
      ...f, [name]: value,
      ...(f.sameAsOrderer && name === 'name' ? { recipientName: value } : {}),
      ...(f.sameAsOrderer && name === 'phone' ? { recipientPhone: value } : {}),
    }));
  };

  const handleSameAsOrderer = (checked: boolean) => {
    setForm((f) => ({ ...f, sameAsOrderer: checked, recipientName: checked ? f.name : '', recipientPhone: checked ? f.phone : '' }));
  };

  const validateForm = () => {
    if (!form.name.trim() || !form.phone.trim()) { toast.error('주문자 이름과 연락처를 입력해주세요'); return false; }
    if (!form.address.trim()) { toast.error('배송지를 입력해주세요'); return false; }
    if (!form.sameAsOrderer && (!form.recipientName.trim() || !form.recipientPhone.trim())) { toast.error('수령인 정보를 입력해주세요'); return false; }
    return true;
  };

  const buildPreparePayload = () => {
    const memo = form.deliveryMemo === '직접 입력' ? form.deliveryMemoCustom : form.deliveryMemo;
    return {
      items: items.map((i) => ({ productId: i.productId, quantity: i.quantity, price: i.price })),
      amount: total,
      customerName: form.name,
      customerPhone: form.phone.replace(/-/g, ''),
      customerEmail: form.email || undefined,
      recipientName: form.sameAsOrderer ? form.name : form.recipientName,
      recipientPhone: (form.sameAsOrderer ? form.phone : form.recipientPhone).replace(/-/g, ''),
      shippingAddress: `[${form.zipCode}] ${form.address} ${form.addressDetail}`.trim(),
      deliveryMemo: memo || undefined,
    };
  };

  // 일반 결제 (카카오페이·토스페이·네이버페이·삼성페이·카드)
  const handlePay = async () => {
    if (!validateForm()) return;
    if (processingRef.current) return;
    processingRef.current = true;
    setLoading(true);

    if (!consumer && saveInfo) {
      localStorage.setItem(SAVED_KEY, JSON.stringify({ name: form.name, phone: form.phone, email: form.email }));
    }

    try {
      const { data } = await paymentApi.prepare(buildPreparePayload(), accessToken || undefined);
      const tossPayments = await loadTossPayments(clientKey);
      const customerKey = consumer ? `consumer_${consumer.id}` : ANONYMOUS;
      const payment = tossPayments.payment({ customerKey });

      const orderName = items.length === 1 ? items[0].name : `${items[0].name} 외 ${items.length - 1}개`;

      const paymentOptions: any = {
        method: 'CARD',
        orderId: data.data.orderId,
        orderName,
        amount: { currency: 'KRW', value: total },
        successUrl: `${window.location.origin}/checkout/success`,
        failUrl: `${window.location.origin}/checkout/fail`,
        customerName: form.name,
        customerEmail: form.email || undefined,
        customerMobilePhone: form.phone.replace(/-/g, ''),
      };

      if (selectedMethod === 'TRANSFER') {
        paymentOptions.method = 'TRANSFER';
      } else if (selectedMethod !== 'CARD') {
        paymentOptions.card = { flowMode: 'DIRECT', easyPay: selectedMethod };
      }

      await payment.requestPayment(paymentOptions);

      // requestPayment는 페이지를 리다이렉트하므로 여기 미도달
      processingRef.current = false;
      setLoading(false);
    } catch (err: any) {
      processingRef.current = false;
      const errCode = err?.code || err?.error?.code;
      if (errCode !== 'USER_CANCEL') {
        toast.error(err?.response?.data?.error || err?.message || '결제 오류가 발생했습니다');
      }
      setLoading(false);
    }
  };

  // 지문인증 결제 (등록 카드 + WebAuthn)
  const handleBiometricPay = async () => {
    if (!validateForm()) return;
    if (!canBiometricPay || !defaultBillingKey || !accessToken) return;
    if (processingRef.current) return;
    processingRef.current = true;
    setLoading(true);
    try {
      const { data: prepRes } = await paymentApi.prepare(buildPreparePayload(), accessToken);
      const { data: authOpts } = await webAuthnApi.getAuthOptions(accessToken);
      const assertion = await startAuthentication(authOpts.data);
      await webAuthnApi.auth({ credential: assertion }, accessToken);

      const orderName = items.length === 1 ? items[0].name : `${items[0].name} 외 ${items.length - 1}개`;
      const { data: payRes } = await billingApi.pay({
        billingKeyId: defaultBillingKey.id,
        orderId: prepRes.data.orderId,
        amount: total,
        orderName,
      }, accessToken);

      useCartStore.getState().clearCart();
      router.replace(`/checkout/success?biometric=1&orderNumber=${payRes.data.orderNumber}`);
    } catch (err: any) {
      processingRef.current = false;
      if (err?.name !== 'NotAllowedError') {
        toast.error(err?.response?.data?.error || err?.message || '지문인증 결제 실패');
      }
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-44">
      <NavBar title="주문 · 결제" back={true} />

      <div className="max-w-2xl mx-auto px-4 py-5 space-y-4">

        {/* 주문 상품 */}
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          <button onClick={() => setShowOrderItems((v) => !v)}
            className="w-full px-4 py-3 flex items-center justify-between text-sm font-semibold text-gray-700 hover:bg-gray-50">
            <span>주문 상품 ({items.length}개)</span>
            {showOrderItems ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
          </button>
          {showOrderItems && (
            <div className="divide-y divide-gray-50 border-t border-gray-50">
              {items.map((item) => (
                <div key={item.productId} className="flex gap-3 p-4">
                  <div className="w-14 h-14 rounded-xl overflow-hidden bg-gray-100 shrink-0">
                    {item.thumbnail ? <img src={imgUrl(item.thumbnail)!} alt={item.name} className="w-full h-full object-cover" /> : <div className="w-full h-full bg-gray-100" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 line-clamp-1">{item.name}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{item.storeName}</p>
                    <p className="text-sm font-bold text-gray-800 mt-1">{(item.price * item.quantity).toLocaleString()}원 <span className="font-normal text-gray-400">× {item.quantity}</span></p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 주문자 정보 */}
        <div className="bg-white rounded-2xl border border-gray-100 p-4 space-y-3">
          <h2 className="text-sm font-semibold text-gray-700 flex items-center gap-1.5"><User size={14} className="text-gray-400" /> 주문자 정보</h2>
          <div className="relative"><User size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" /><input id="orderer-name" name="name" autoComplete="name" value={form.name} onChange={handleOrdererChange} placeholder="이름 *" className="w-full pl-9 pr-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-tea-500" /></div>
          <div className="relative"><Phone size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" /><input id="orderer-phone" name="phone" autoComplete="tel" value={form.phone} onChange={handleOrdererChange} placeholder="연락처 * (01012345678)" className="w-full pl-9 pr-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-tea-500" /></div>
          <div className="relative"><Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" /><input id="orderer-email" name="email" autoComplete="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} placeholder="이메일 (선택)" className="w-full pl-9 pr-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-tea-500" /></div>
          {!consumer && (
            <label className="flex items-center gap-2 text-xs text-gray-500 cursor-pointer">
              <input type="checkbox" checked={saveInfo} onChange={(e) => setSaveInfo(e.target.checked)} className="rounded" />
              다음에도 이 정보 사용
            </label>
          )}
        </div>

        {/* 배송지 */}
        <div className="bg-white rounded-2xl border border-gray-100 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-700 flex items-center gap-1.5"><MapPin size={14} className="text-gray-400" /> 배송지</h2>
            {consumer && (savedAddresses as any[]).length > 0 && (
              <button onClick={() => setShowAddressPicker((v) => !v)} className="text-xs text-tea-600 hover:underline flex items-center gap-0.5">
                <BookOpen size={12} /> 배송지 목록
              </button>
            )}
          </div>

          {showAddressPicker && (
            <div className="space-y-1.5 -mx-1">
              {(savedAddresses as any[]).map((addr: any) => (
                <button key={addr.id} onClick={() => applyAddress(addr)}
                  className="w-full text-left p-3 rounded-xl border border-gray-100 hover:border-tea-300 hover:bg-tea-50 transition-colors">
                  <div className="flex items-center gap-2 mb-1">
                    {addr.isDefault && <span className="text-xs text-tea-700 font-medium px-1.5 py-0.5 bg-tea-100 rounded-full">기본</span>}
                    <p className="text-sm text-gray-800 font-medium">{addr.recipientName}</p>
                  </div>
                  <p className="text-xs text-gray-500">{addr.address} {addr.addressDetail}</p>
                </button>
              ))}
            </div>
          )}

          <div className="flex items-center gap-2">
            <AddressSearch
              onSelect={(d) => setForm((f) => ({ ...f, address: d.address, zipCode: d.zipCode }))}
            />
            {form.zipCode && (
              <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded-lg">{form.zipCode}</span>
            )}
          </div>
          {form.address && (
            <p className="text-sm text-gray-700 px-1">{form.address}</p>
          )}
          <input
            value={form.addressDetail}
            onChange={(e) => setForm((f) => ({ ...f, addressDetail: e.target.value }))}
            placeholder="상세 주소"
            className="w-full px-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-tea-500"
          />

          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-gray-600 flex items-center gap-1"><User size={12} className="text-gray-400" /> 수령인</span>
            <label className="flex items-center gap-1.5 text-xs text-gray-500 cursor-pointer">
              <input type="checkbox" checked={form.sameAsOrderer} onChange={(e) => handleSameAsOrderer(e.target.checked)} className="rounded" />주문자와 동일
            </label>
          </div>
          {!form.sameAsOrderer && (
            <div className="space-y-2">
              <div className="relative"><User size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" /><input id="recipient-name" name="recipientName" autoComplete="shipping name" value={form.recipientName} onChange={(e) => setForm((f) => ({ ...f, recipientName: e.target.value }))} placeholder="수령인 이름 *" className="w-full pl-9 pr-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-tea-500" /></div>
              <div className="relative"><Phone size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" /><input id="recipient-phone" name="recipientPhone" autoComplete="shipping tel" value={form.recipientPhone} onChange={(e) => setForm((f) => ({ ...f, recipientPhone: e.target.value }))} placeholder="수령인 연락처 *" className="w-full pl-9 pr-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-tea-500" /></div>
            </div>
          )}

          {/* 배송 메모 */}
          <div>
            <div className="flex items-center gap-1.5 mb-2"><MessageSquare size={13} className="text-gray-400" /><span className="text-xs font-medium text-gray-600">배송 메모</span></div>
            <select name="deliveryMemo" value={form.deliveryMemo} onChange={(e) => setForm((f) => ({ ...f, deliveryMemo: e.target.value }))} className="w-full px-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-tea-500 bg-white">
              <option value="">선택 안함</option>
              {DELIVERY_MEMOS.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
            {form.deliveryMemo === '직접 입력' && (
              <input value={form.deliveryMemoCustom} onChange={(e) => setForm((f) => ({ ...f, deliveryMemoCustom: e.target.value }))} placeholder="배송 메모 입력" className="mt-2 w-full px-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-tea-500" />
            )}
          </div>
        </div>

        {/* 결제 금액 */}
        <div className="bg-white rounded-2xl border border-gray-100 p-4 space-y-2">
          <h2 className="text-sm font-semibold text-gray-700 mb-2">결제 금액</h2>
          <div className="flex justify-between text-sm text-gray-600">
            <span>상품 금액</span><span>{itemsTotal.toLocaleString()}원</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">배송비</span>
            <span className={shippingFee === 0 ? 'text-tea-600 font-medium' : 'text-gray-800'}>
              {shippingLoading ? '계산 중...' : shippingFee === 0 ? '무료' : `${shippingFee.toLocaleString()}원`}
            </span>
          </div>
          {shippingInfo?.freeShippingThreshold && itemsTotal < shippingInfo.freeShippingThreshold && (
            <p className="text-xs text-amber-600">
              {(shippingInfo.freeShippingThreshold - itemsTotal).toLocaleString()}원 더 담으면 무료배송!
            </p>
          )}
          <div className="border-t border-gray-100 pt-2 flex justify-between">
            <span className="font-semibold text-gray-900">총 결제금액</span>
            <span className="text-lg font-bold text-tea-800">{total.toLocaleString()}원</span>
          </div>
        </div>

        {/* 지문인증 결제 (카드 + WebAuthn 등록된 경우) */}
        {canBiometricPay && consumer && (
          <div className="bg-gradient-to-br from-tea-50 to-tea-100 rounded-2xl border border-tea-200 p-4">
            <div className="flex items-center gap-2 mb-2">
              <Fingerprint size={18} className="text-tea-700" />
              <span className="text-sm font-semibold text-tea-800">지문인증으로 빠른 결제</span>
            </div>
            <p className="text-xs text-tea-600 mb-3">
              {(defaultBillingKey as any)?.cardCompany || '등록 카드'} ({(defaultBillingKey as any)?.cardNumber || '****'})로 지문인증 결제
            </p>
            <button onClick={handleBiometricPay} disabled={loading}
              className="w-full py-3 rounded-xl bg-tea-700 text-white font-bold hover:bg-tea-800 transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
              <Fingerprint size={18} />
              {loading ? '처리 중...' : `${total.toLocaleString()}원 지문인증 결제`}
            </button>
          </div>
        )}

        {/* 카드 등록 안내 */}
        {consumer && (billingKeys as any[]).length === 0 && (
          <Link href="/profile/billing" className="block bg-gray-50 rounded-2xl border border-dashed border-gray-200 p-3 text-center text-xs text-gray-400 hover:border-tea-300 hover:text-tea-600 transition-colors">
            <CreditCard size={14} className="inline mr-1" /> 카드 등록하면 지문인증 결제 가능
          </Link>
        )}

        {/* 결제 수단 선택 */}
        <div className="bg-white rounded-2xl border border-gray-100 p-4">
          <h2 className="text-sm font-semibold text-gray-700 mb-3">결제 수단 선택</h2>
          <div className="grid grid-cols-4 gap-2 mb-2">
            {PAYMENT_METHODS.map(({ key, label, bg, text }) => (
              <button
                key={key}
                onClick={() => setSelectedMethod(key)}
                className={`py-3 rounded-xl text-xs font-bold transition-all border-2 ${
                  selectedMethod === key
                    ? 'border-tea-500 ring-2 ring-tea-300 scale-105 shadow-sm'
                    : 'border-transparent opacity-80 hover:opacity-100'
                }`}
                style={{ backgroundColor: bg, color: text }}
              >
                {label}
              </button>
            ))}
          </div>
          <button
            onClick={() => setSelectedMethod('CARD')}
            className={`w-full py-3 rounded-xl text-sm font-semibold border-2 transition-all flex items-center justify-center gap-2 ${
              selectedMethod === 'CARD'
                ? 'bg-gray-800 text-white border-gray-800'
                : 'bg-white text-gray-700 border-gray-200 hover:border-gray-400'
            }`}
          >
            <CreditCard size={16} /> 신용·체크카드
          </button>
        </div>

        <p className="text-xs text-gray-400 text-center">
          {consumer ? `${consumer.name}님의 회원 주문` : '비회원 주문 · 주문번호 + 연락처로 조회 가능'}
        </p>
      </div>

      {/* 결제 버튼 고정 */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 px-4 py-3 z-30 shadow-lg">
        <div className="max-w-2xl mx-auto">
          <button
            onClick={handlePay}
            disabled={loading || !!shippingLoading}
            className="w-full py-3.5 rounded-xl text-white font-bold bg-tea-700 hover:bg-tea-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-base"
          >
            {loading
              ? '처리 중...'
              : shippingLoading
                ? '배송비 계산 중...'
                : `${total.toLocaleString()}원 결제하기`}
          </button>
        </div>
      </div>
    </div>
  );
}
