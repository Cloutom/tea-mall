'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import {
  Eye, EyeOff, Loader2, CheckCircle2, ChevronRight, ChevronLeft, Clock,
  ShieldAlert, SkipForward, User, Store, Building2, Truck, Plus, X, Star,
} from 'lucide-react';
import { authApi, storeApi, courierApi } from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import { Seller } from '@/types';
import { clsx } from 'clsx';
import AddressSearch from '@/components/AddressSearch';

const COURIER_LIST = [
  { code: 'CJ',       name: 'CJ대한통운' },
  { code: 'HANJIN',   name: '한진택배' },
  { code: 'LOTTE',    name: '롯데택배' },
  { code: 'LOGEN',    name: '로젠택배' },
  { code: 'EPOST',    name: '우체국택배' },
  { code: 'KDEXP',    name: '경동택배' },
  { code: 'CVSNET',   name: 'GS편의점택배' },
  { code: 'CHUNILPS', name: '천일택배' },
];

const STEPS = [
  { id: 1, label: '계정 정보',  icon: User,      required: true  },
  { id: 2, label: '스토어 정보', icon: Store,     required: true  },
  { id: 3, label: '사업자 정보', icon: Building2, required: false },
  { id: 4, label: '택배사 설정', icon: Truck,     required: false },
  { id: 5, label: '완료',       icon: CheckCircle2, required: true },
];

function slugify(v: string) {
  return v.toLowerCase().replace(/[^a-z0-9가-힣]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
}

export default function RegisterPage() {
  const router = useRouter();
  const { login, seller, setSeller } = useAuthStore();

  const [step, setStep] = useState(1);
  const [showPw, setShowPw] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [bizVerifying, setBizVerifying] = useState(false);
  const [bizVerified, setBizVerified] = useState(false);
  const [pledgeChecked, setPledgeChecked] = useState(false);
  const [couriers, setCouriers] = useState<any[]>([]);
  const [showCourierForm, setShowCourierForm] = useState(false);
  const [loading, setLoading] = useState(false);

  // ── 폼들 ──
  const accountForm = useForm({
    defaultValues: { name: '', email: '', password: '', passwordConfirm: '', phone: '' },
  });
  const storeForm = useForm({
    defaultValues: { storeName: '', slug: '', description: '', themeColor: '#2D6A4F' },
  });
  const bizForm = useForm({
    defaultValues: {
      businessNumber: '', businessName: '', businessOwner: '',
      startDate: '', businessAddress: '', businessType: '', businessCategory: '',
    },
  });
  const courierForm = useForm({
    defaultValues: {
      courierCode: 'CJ', senderName: '', senderPhone: '',
      senderZipCode: '', senderAddress: '', senderAddressDetail: '',
    },
  });

  const watchSlug = storeForm.watch('slug');
  const watchStoreName = storeForm.watch('storeName');

  // ── Step 1: 계정 생성 ──
  const onAccountSubmit = async (data: any) => {
    if (data.password !== data.passwordConfirm) {
      accountForm.setError('passwordConfirm', { message: '비밀번호가 일치하지 않습니다' });
      return;
    }
    setLoading(true);
    try {
      const res = await authApi.register({ email: data.email, password: data.password, name: data.name, phone: data.phone });
      const { accessToken, refreshToken, seller: newSeller } = res.data.data;
      login(newSeller as Seller, accessToken, refreshToken);
      // courier form 기본값 채우기
      courierForm.setValue('senderName', data.name);
      courierForm.setValue('senderPhone', data.phone);
      setStep(2);
    } catch (e: any) {
      toast.error(e.response?.data?.error || '회원가입 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  // ── Step 2: 스토어 생성 ──
  const onStoreSubmit = async (data: any) => {
    const slug = data.slug || slugify(data.storeName);
    setLoading(true);
    try {
      const res = await storeApi.createStore({ name: data.storeName, slug, description: data.description, themeColor: data.themeColor });
      const updated = res.data.data?.seller || res.data.data;
      if (updated) setSeller(updated);
      setStep(3);
    } catch (e: any) {
      toast.error(e.response?.data?.error || '스토어 생성에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  // ── Step 3: 사업자 저장(선택) ──
  const onBizSave = async () => {
    const data = bizForm.getValues();
    if (data.businessNumber) {
      if (!bizVerified) { toast.error('사업자 인증을 완료해주세요.'); return; }
    }
    setLoading(true);
    try {
      const res = await authApi.updateProfile({
        businessNumber: data.businessNumber,
        businessName: data.businessName,
        businessOwner: data.businessOwner,
        businessAddress: data.businessAddress,
        businessType: data.businessType,
        businessCategory: data.businessCategory,
      });
      if (res.data.data) setSeller(res.data.data);
      toast.success('사업자 정보가 저장되었습니다.');
    } catch {}
    setStep(4);
    setLoading(false);
  };

  // ── 사업자 인증 ──
  const handleVerifyBiz = async () => {
    const v = bizForm.getValues();
    if (!v.businessNumber || !v.businessName || !v.businessOwner || !v.startDate) {
      toast.error('사업자 정보를 모두 입력해주세요.');
      return;
    }
    setBizVerifying(true);
    try {
      await authApi.verifyBusiness({
        businessNumber: v.businessNumber,
        businessName: v.businessName,
        businessOwner: v.businessOwner,
        startDate: v.startDate.replace(/-/g, ''),
        businessAddress: v.businessAddress,
        businessType: v.businessType,
        businessCategory: v.businessCategory,
      });
      setBizVerified(true);
      toast.success('사업자 인증이 완료되었습니다!');
    } catch (e: any) {
      setBizVerified(false);
      toast.error(e.response?.data?.error || '사업자 인증에 실패했습니다.');
    } finally {
      setBizVerifying(false);
    }
  };

  // ── Step 4: 택배사 등록 ──
  const onCourierAdd = async (data: any) => {
    const courier = COURIER_LIST.find((c) => c.code === data.courierCode);
    setLoading(true);
    try {
      const res = await courierApi.createAccount({
        ...data,
        courierName: courier?.name || data.courierCode,
        isDefault: couriers.length === 0,
      });
      setCouriers((p) => [...p, res.data.data]);
      setShowCourierForm(false);
      courierForm.reset({ courierCode: 'CJ', senderName: seller?.name || '', senderPhone: seller?.phone || '', senderZipCode: '', senderAddress: '', senderAddressDetail: '' });
      toast.success('택배사가 등록되었습니다.');
    } catch {
      toast.error('택배사 등록에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const finishSetup = async () => {
    try { const res = await authApi.getMe(); setSeller(res.data.data); } catch {}
    router.replace('/dashboard');
  };

  const formatBizNum = (v: string) => {
    const n = v.replace(/\D/g, '').slice(0, 10);
    if (n.length <= 3) return n;
    if (n.length <= 5) return `${n.slice(0,3)}-${n.slice(3)}`;
    return `${n.slice(0,3)}-${n.slice(3,5)}-${n.slice(5)}`;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-tea-50 via-cream-50 to-tea-100 flex flex-col items-center justify-start py-10 px-4">
      <div className="w-full max-w-lg">

        {/* 로고 */}
        <div className="text-center mb-7">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-tea-600 rounded-2xl mb-3 shadow-lg">
            <span className="text-sm font-bold text-white">차</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">판매자 가입</h1>
          <p className="text-gray-500 text-sm mt-1">teabri에서 판매를 시작하세요</p>
        </div>

        {/* 스텝 인디케이터 */}
        <div className="flex items-center mb-7">
          {STEPS.map((s, i) => (
            <div key={s.id} className="flex items-center flex-1 min-w-0">
              <div className="flex flex-col items-center gap-0.5 w-full">
                <div className={clsx(
                  'w-8 h-8 rounded-full flex items-center justify-center border-2 transition-all shrink-0 text-sm',
                  step > s.id  ? 'bg-tea-600 border-tea-600 text-white' :
                  step === s.id ? 'bg-white border-tea-600 text-tea-600 font-bold' :
                  'bg-white border-gray-200 text-gray-300'
                )}>
                  {step > s.id ? <CheckCircle2 size={15} /> : <s.icon size={13} />}
                </div>
                <span className={clsx('text-[10px] font-medium hidden sm:block text-center leading-tight',
                  step >= s.id ? 'text-tea-700' : 'text-gray-400')}>
                  {s.label}
                  {!s.required && <span className="text-gray-300"> (선택)</span>}
                </span>
              </div>
              {i < STEPS.length - 1 && (
                <div className={clsx('h-0.5 flex-1 mx-1 mt-[-1.2rem] transition-all shrink-0',
                  step > s.id ? 'bg-tea-500' : 'bg-gray-200')} />
              )}
            </div>
          ))}
        </div>

        <div className="card shadow-md">

          {/* ── STEP 1: 계정 정보 ── */}
          {step === 1 && (
            <form onSubmit={accountForm.handleSubmit(onAccountSubmit)} className="space-y-4">
              <div>
                <h2 className="text-lg font-bold text-gray-900">계정 정보 입력</h2>
                <p className="text-gray-500 text-sm mt-0.5">로그인에 사용할 계정을 만들어주세요</p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label-base">이름 *</label>
                  <input {...accountForm.register('name', { required: '이름을 입력해주세요', minLength: { value: 2, message: '2자 이상' } })}
                    placeholder="홍길동" className="input-base" />
                  {accountForm.formState.errors.name && <p className="text-red-500 text-xs mt-1">{accountForm.formState.errors.name.message as string}</p>}
                </div>
                <div>
                  <label className="label-base">연락처 *</label>
                  <input {...accountForm.register('phone', { required: '연락처를 입력해주세요' })}
                    placeholder="010-0000-0000" type="tel" className="input-base" />
                  {accountForm.formState.errors.phone && <p className="text-red-500 text-xs mt-1">{accountForm.formState.errors.phone.message as string}</p>}
                </div>
              </div>

              <div>
                <label className="label-base">이메일 *</label>
                <input {...accountForm.register('email', { required: '이메일을 입력해주세요', pattern: { value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, message: '올바른 이메일 형식을 입력해주세요' } })}
                  type="email" placeholder="seller@example.com" className="input-base" />
                {accountForm.formState.errors.email && <p className="text-red-500 text-xs mt-1">{accountForm.formState.errors.email.message as string}</p>}
              </div>

              <div>
                <label className="label-base">비밀번호 * (8자 이상)</label>
                <div className="relative">
                  <input {...accountForm.register('password', { required: '비밀번호를 입력해주세요', minLength: { value: 8, message: '8자 이상 입력해주세요' } })}
                    type={showPw ? 'text' : 'password'} placeholder="8자 이상 입력" className="input-base pr-10" />
                  <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                    {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                {accountForm.formState.errors.password && <p className="text-red-500 text-xs mt-1">{accountForm.formState.errors.password.message as string}</p>}
              </div>

              <div>
                <label className="label-base">비밀번호 확인 *</label>
                <div className="relative">
                  <input {...accountForm.register('passwordConfirm', { required: '비밀번호를 확인해주세요' })}
                    type={showConfirm ? 'text' : 'password'} placeholder="비밀번호 재입력" className="input-base pr-10" />
                  <button type="button" onClick={() => setShowConfirm(!showConfirm)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                    {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                {accountForm.formState.errors.passwordConfirm && <p className="text-red-500 text-xs mt-1">{accountForm.formState.errors.passwordConfirm.message as string}</p>}
              </div>

              <button type="submit" disabled={loading} className="btn-primary w-full py-3 mt-2">
                {loading ? <Loader2 size={18} className="animate-spin" /> : <ChevronRight size={18} />}
                {loading ? '처리 중...' : '다음: 스토어 정보'}
              </button>

              <p className="text-center text-sm text-gray-500">
                이미 계정이 있으신가요?{' '}
                <Link href="/auth/login" className="text-tea-600 font-medium hover:underline">로그인</Link>
              </p>
            </form>
          )}

          {/* ── STEP 2: 스토어 정보 ── */}
          {step === 2 && (
            <form onSubmit={storeForm.handleSubmit(onStoreSubmit)} className="space-y-4">
              <div>
                <h2 className="text-lg font-bold text-gray-900">스토어 정보</h2>
                <p className="text-gray-500 text-sm mt-0.5">소비자에게 보여질 스토어를 만들어주세요</p>
              </div>

              <div>
                <label className="label-base">스토어 이름 *</label>
                <input {...storeForm.register('storeName', { required: '스토어 이름을 입력해주세요' })}
                  placeholder="예: 보성 찻집, 제주 다원"
                  className="input-base"
                  onChange={(e) => {
                    storeForm.setValue('storeName', e.target.value);
                    if (!watchSlug || watchSlug === slugify(watchStoreName)) {
                      storeForm.setValue('slug', slugify(e.target.value));
                    }
                  }} />
                {storeForm.formState.errors.storeName && <p className="text-red-500 text-xs mt-1">{storeForm.formState.errors.storeName.message as string}</p>}
              </div>

              <div>
                <label className="label-base">스토어 URL *</label>
                <div className="flex items-center">
                  <span className="bg-gray-50 border border-r-0 border-gray-200 rounded-l-xl px-3 py-2.5 text-xs text-gray-400 shrink-0 whitespace-nowrap">shop.kr/</span>
                  <input {...storeForm.register('slug', { required: 'URL을 입력해주세요' })}
                    placeholder="my-tea-store" className="input-base rounded-l-none border-l-0 flex-1" />
                </div>
                {storeForm.formState.errors.slug && <p className="text-red-500 text-xs mt-1">{storeForm.formState.errors.slug.message as string}</p>}
                <p className="text-xs text-gray-400 mt-1">영문 소문자, 숫자, 하이픈만 사용 가능합니다</p>
              </div>

              <div>
                <label className="label-base">스토어 소개 <span className="text-gray-400 font-normal text-xs">(선택)</span></label>
                <textarea {...storeForm.register('description')}
                  placeholder="예: 제주도 직계약 유기농 녹차 전문점"
                  className="input-base h-16 resize-none" />
              </div>

              <div>
                <label className="label-base">브랜드 색상 <span className="text-gray-400 font-normal text-xs">(선택)</span></label>
                <div className="flex items-center gap-3">
                  <input type="color" {...storeForm.register('themeColor')} className="w-12 h-10 rounded-lg border border-gray-200 cursor-pointer" />
                  <span className="text-sm text-gray-500">스토어 메인 컬러</span>
                </div>
              </div>

              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => setStep(1)} className="btn-secondary w-10 px-0 shrink-0">
                  <ChevronLeft size={18} />
                </button>
                <button type="submit" disabled={loading} className="btn-primary flex-1 py-3">
                  {loading ? <Loader2 size={18} className="animate-spin" /> : <ChevronRight size={18} />}
                  {loading ? '처리 중...' : '다음: 사업자 정보'}
                </button>
              </div>
            </form>
          )}

          {/* ── STEP 3: 사업자 정보 (선택) ── */}
          {step === 3 && (
            <div className="space-y-4">
              <div>
                <h2 className="text-lg font-bold text-gray-900">사업자 정보 <span className="text-sm font-normal text-gray-400">(선택)</span></h2>
                <p className="text-gray-500 text-sm mt-0.5">정산·세금계산서 발행에 필요합니다. 나중에 설정 메뉴에서 입력해도 됩니다.</p>
              </div>

              {/* 불법판매 안내 */}
              <div className="bg-red-50 border border-red-200 rounded-xl p-3">
                <div className="flex items-start gap-2">
                  <ShieldAlert size={16} className="text-red-500 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-red-700 text-xs font-semibold">불법 판매 금지 안내</p>
                    <ul className="text-red-600 text-xs mt-1 space-y-0.5 list-disc list-inside">
                      <li>원산지 허위 표기 금지</li>
                      <li>식품위생법 위반 상품 금지</li>
                      <li>허가되지 않은 의약품·건강기능식품 금지</li>
                      <li>지식재산권 침해 상품 금지</li>
                    </ul>
                  </div>
                </div>
              </div>

              <div>
                <label className="label-base">사업자 등록번호</label>
                <div className="flex gap-2">
                  <input {...bizForm.register('businessNumber')}
                    placeholder="000-00-00000" className="input-base"
                    onChange={(e) => { bizForm.setValue('businessNumber', formatBizNum(e.target.value)); setBizVerified(false); }}
                    maxLength={12} />
                  <button type="button" onClick={handleVerifyBiz} disabled={bizVerifying || bizVerified}
                    className={clsx('shrink-0 px-4 py-2.5 rounded-xl text-sm font-medium transition-all',
                      bizVerified ? 'bg-green-100 text-green-700 border border-green-200' : 'bg-tea-600 text-white hover:bg-tea-700')}>
                    {bizVerifying ? <Loader2 size={15} className="animate-spin" /> : bizVerified ? <CheckCircle2 size={15} /> : '인증'}
                  </button>
                </div>
                {bizVerified && <p className="text-green-600 text-xs mt-1 flex items-center gap-1"><CheckCircle2 size={11} /> 인증 완료</p>}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label-base">상호명</label>
                  <input {...bizForm.register('businessName')} placeholder="○○ 다원" className="input-base" />
                </div>
                <div>
                  <label className="label-base">대표자명</label>
                  <input {...bizForm.register('businessOwner')} placeholder="홍길동" className="input-base" />
                </div>
                <div>
                  <label className="label-base">개업일</label>
                  <input {...bizForm.register('startDate')} type="date" className="input-base" />
                </div>
                <div>
                  <label className="label-base">업태</label>
                  <input {...bizForm.register('businessType')} placeholder="도소매업" className="input-base" />
                </div>
              </div>
              <div>
                <label className="label-base">사업장 주소</label>
                <input {...bizForm.register('businessAddress')} placeholder="서울시 강남구..." className="input-base" />
              </div>
              <div>
                <label className="label-base">종목</label>
                <input {...bizForm.register('businessCategory')} placeholder="차, 다기류" className="input-base" />
              </div>

              <label className="flex items-start gap-3 p-3 bg-gray-50 rounded-xl border border-gray-200 cursor-pointer hover:bg-gray-100 transition-colors">
                <input type="checkbox" checked={pledgeChecked} onChange={(e) => setPledgeChecked(e.target.checked)}
                  className="mt-0.5 w-4 h-4 accent-tea-600 shrink-0" />
                <span className="text-xs text-gray-700">
                  위 불법 판매 금지 사항을 확인하였으며, 위반 시 모든 법적 책임을 지겠습니다.
                </span>
              </label>

              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => setStep(2)} className="btn-secondary w-10 px-0 shrink-0">
                  <ChevronLeft size={18} />
                </button>
                <button type="button" onClick={onBizSave} disabled={loading} className="btn-primary flex-1 py-3">
                  {loading ? <Loader2 size={18} className="animate-spin" /> : <ChevronRight size={18} />}
                  저장 후 다음
                </button>
                <button type="button" onClick={() => setStep(4)} className="btn-secondary flex-1 py-3 text-gray-500">
                  <SkipForward size={16} /> 건너뛰기
                </button>
              </div>
            </div>
          )}

          {/* ── STEP 4: 택배사 설정 (선택) ── */}
          {step === 4 && (
            <div className="space-y-4">
              <div>
                <h2 className="text-lg font-bold text-gray-900">택배사 설정 <span className="text-sm font-normal text-gray-400">(선택)</span></h2>
                <p className="text-gray-500 text-sm mt-0.5">주문 발생 시 운송장 출력에 필요합니다. 배송 관리 메뉴에서 언제든 추가할 수 있어요.</p>
              </div>

              {/* 등록된 택배사 */}
              {couriers.length > 0 && (
                <div className="space-y-2">
                  {couriers.map((c, i) => (
                    <div key={i} className="flex items-center justify-between p-3 bg-tea-50 border border-tea-200 rounded-xl">
                      <div>
                        <p className="text-sm font-semibold text-tea-800">{c.courierName}</p>
                        <p className="text-xs text-tea-600">{c.senderName} · {c.senderPhone}</p>
                      </div>
                      {i === 0 && (
                        <span className="flex items-center gap-1 text-xs font-medium text-amber-700 bg-amber-100 px-2 py-1 rounded-full">
                          <Star size={10} className="fill-amber-500 text-amber-500" /> 기본
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* 택배사 추가 폼 */}
              {showCourierForm ? (
                <form onSubmit={courierForm.handleSubmit(onCourierAdd)} className="border border-gray-200 rounded-xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-gray-800">택배사 추가</p>
                    <button type="button" onClick={() => setShowCourierForm(false)}><X size={16} className="text-gray-400" /></button>
                  </div>
                  <div>
                    <label className="label-base">택배사 선택</label>
                    <div className="grid grid-cols-4 gap-2">
                      {COURIER_LIST.map((c) => (
                        <label key={c.code} className="relative flex flex-col items-center gap-1 p-2 rounded-xl border cursor-pointer text-xs text-center hover:border-tea-300 transition-colors">
                          <input type="radio" {...courierForm.register('courierCode')} value={c.code} className="sr-only peer" />
                          <span className="text-gray-600 text-[10px] leading-tight font-medium">{c.name}</span>
                          <div className="absolute inset-0 rounded-xl border-2 border-transparent peer-checked:border-tea-500 pointer-events-none" />
                        </label>
                      ))}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="label-base">발송인 이름 *</label>
                      <input {...courierForm.register('senderName', { required: true })} className="input-base" />
                    </div>
                    <div>
                      <label className="label-base">연락처 *</label>
                      <input {...courierForm.register('senderPhone', { required: true })} placeholder="010-0000-0000" className="input-base" />
                    </div>
                    <div className="col-span-2">
                      <label className="label-base">발송지 주소 *</label>
                      <div className="flex gap-2 mb-2">
                        <input {...courierForm.register('senderZipCode')} readOnly className="input-base w-28 bg-gray-50 text-sm" placeholder="우편번호" />
                        <AddressSearch onSelect={({ zipCode, address }) => {
                          courierForm.setValue('senderZipCode', zipCode);
                          courierForm.setValue('senderAddress', address);
                        }} className="shrink-0 text-sm" />
                      </div>
                      <input {...courierForm.register('senderAddress', { required: true })} readOnly className="input-base bg-gray-50" placeholder="주소 검색 버튼을 눌러주세요" />
                    </div>
                    <div className="col-span-2">
                      <label className="label-base">상세 주소</label>
                      <input {...courierForm.register('senderAddressDetail')} className="input-base" />
                    </div>
                  </div>
                  <button type="submit" disabled={loading} className="btn-primary w-full py-2.5 text-sm">
                    {loading ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
                    등록
                  </button>
                </form>
              ) : (
                <button type="button" onClick={() => setShowCourierForm(true)}
                  className="w-full border-2 border-dashed border-gray-200 rounded-xl py-4 text-sm text-gray-500 hover:border-tea-300 hover:text-tea-600 transition-all flex items-center justify-center gap-2">
                  <Plus size={16} /> 택배사 추가
                </button>
              )}

              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => setStep(3)} className="btn-secondary w-10 px-0 shrink-0">
                  <ChevronLeft size={18} />
                </button>
                <button type="button" onClick={() => setStep(5)} className="btn-primary flex-1 py-3">
                  <ChevronRight size={18} />
                  {couriers.length > 0 ? '가입 완료' : '다음'}
                </button>
                {couriers.length === 0 && (
                  <button type="button" onClick={() => setStep(5)} className="btn-secondary flex-1 py-3 text-gray-500">
                    <SkipForward size={16} /> 건너뛰기
                  </button>
                )}
              </div>
            </div>
          )}

          {/* ── STEP 5: 완료 (승인 대기) ── */}
          {step === 5 && (
            <div className="text-center space-y-5 py-4">
              <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto">
                <Clock size={32} className="text-amber-600" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-900">가입 신청이 완료되었습니다!</h2>
                <p className="text-gray-500 text-sm mt-2">관리자 승인 후 로그인할 수 있습니다.</p>
                <p className="text-gray-400 text-xs mt-1">보통 1~2 영업일 내에 승인됩니다.</p>
              </div>
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-left">
                <p className="text-sm font-semibold text-amber-800 mb-2">승인 절차 안내</p>
                <ul className="text-xs text-amber-700 space-y-1">
                  <li>1. 가입 신청 정보를 관리자가 검토합니다</li>
                  <li>2. 승인이 완료되면 로그인이 가능합니다</li>
                  <li>3. 문의사항은 관리자에게 연락해주세요</li>
                </ul>
              </div>
              <a href="/auth/login" className="btn-primary w-full py-3 text-base inline-block text-center">
                로그인 페이지로 이동
              </a>
            </div>
          )}
        </div>

        {step === 1 && (
          <p className="text-center text-xs text-gray-400 mt-4">
            가입 시 <span className="underline cursor-pointer">이용약관</span> 및{' '}
            <span className="underline cursor-pointer">개인정보처리방침</span>에 동의하게 됩니다.
          </p>
        )}
      </div>
    </div>
  );
}
