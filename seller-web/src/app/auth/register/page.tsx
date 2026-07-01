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
  { id: 3, label: '사업자 정보', icon: Building2, required: true  },
  { id: 4, label: '정산 계좌',  icon: Truck,     required: true  },
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
  const [pledgeChecked, setPledgeChecked] = useState(false);
  const [couriers, setCouriers] = useState<any[]>([]);
  const [showCourierForm, setShowCourierForm] = useState(false);
  const [bankForm, setBankForm] = useState({ bankName: '', accountNo: '', holder: '' });
  const [bankError, setBankError] = useState('');
  const [bankCopy, setBankCopy] = useState<File | null>(null);
  const [bizLicense, setBizLicense] = useState<File | null>(null);
  const [salesPermit, setSalesPermit] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [phoneSent, setPhoneSent] = useState(false);
  const [phoneVerified, setPhoneVerified] = useState(false);
  const [phoneCode, setPhoneCode] = useState('');
  const [phoneSending, setPhoneSending] = useState(false);
  const [phoneVerifying, setPhoneVerifying] = useState(false);
  const [phoneTimer, setPhoneTimer] = useState(0);

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

  // ── 휴대폰 인증 ──
  const handleSendPhoneCode = async () => {
    const phone = accountForm.getValues('phone');
    if (!phone || phone.replace(/\D/g, '').length < 10) {
      toast.error('올바른 휴대폰 번호를 입력해주세요.');
      return;
    }
    setPhoneSending(true);
    try {
      await authApi.sendPhoneCode(phone);
      setPhoneSent(true);
      setPhoneTimer(180);
      toast.success('인증번호가 발송되었습니다.');
      const interval = setInterval(() => {
        setPhoneTimer((t) => {
          if (t <= 1) { clearInterval(interval); return 0; }
          return t - 1;
        });
      }, 1000);
    } catch (e: any) {
      toast.error(e.response?.data?.error || '인증번호 발송에 실패했습니다.');
    } finally {
      setPhoneSending(false);
    }
  };

  const handleVerifyPhoneCode = async () => {
    const phone = accountForm.getValues('phone');
    if (!phoneCode || phoneCode.length !== 6) {
      toast.error('6자리 인증번호를 입력해주세요.');
      return;
    }
    setPhoneVerifying(true);
    try {
      await authApi.verifyPhoneCode(phone, phoneCode);
      setPhoneVerified(true);
      toast.success('휴대폰 인증이 완료되었습니다!');
    } catch (e: any) {
      toast.error(e.response?.data?.error || '인증번호가 일치하지 않습니다.');
    } finally {
      setPhoneVerifying(false);
    }
  };

  // ── Step 1: 계정 생성 ──
  const onAccountSubmit = async (data: any) => {
    // TODO: SMS 서비스 활성화 시 주석 해제
    // if (!phoneVerified) {
    //   toast.error('휴대폰 인증을 먼저 완료해주세요.');
    //   return;
    // }
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

  // ── Step 3: 사업자 저장(필수) ──
  const onBizSave = async () => {
    const data = bizForm.getValues();
    if (!data.businessNumber || !data.businessName || !data.businessOwner) {
      toast.error('사업자등록번호, 상호명, 대표자명은 필수입니다.'); return;
    }
    if (!data.businessAddress) { toast.error('사업장 주소를 입력해주세요.'); return; }
    if (!data.businessType) { toast.error('업태를 입력해주세요.'); return; }
    if (/[<>{}()\/\\]/.test(data.businessName)) { toast.error('상호명에 특수문자를 사용할 수 없습니다.'); return; }
    if (!bizLicense) { toast.error('사업자등록증을 업로드해주세요.'); return; }
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

      // 서류 업로드
      const uploadDoc = async (file: File, docType: string) => {
        const fd = new FormData();
        fd.append('image', file);
        fd.append('docType', docType);
        await authApi.uploadDocument(fd);
      };
      await uploadDoc(bizLicense, 'license');
      if (salesPermit) await uploadDoc(salesPermit, 'permit');

      toast.success('사업자 정보가 저장되었습니다.');
    } catch (e: any) { toast.error(e.response?.data?.error || '저장 실패'); }
    setStep(4);
    setLoading(false);
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

  // ── Step 4: 계좌 저장 ──
  const handleBankSave = async () => {
    setBankError('');
    if (!bankForm.bankName) { setBankError('은행을 선택해주세요.'); return; }
    if (!bankForm.accountNo) { setBankError('계좌번호를 입력해주세요.'); return; }
    if (!bankForm.holder) { setBankError('예금주를 입력해주세요.'); return; }
    if (!bankCopy) { setBankError('통장사본을 업로드해주세요.'); return; }
    const bizData = bizForm.getValues();
    if (bizData.businessName && bankForm.holder !== bizData.businessName && bankForm.holder !== bizData.businessOwner) {
      setBankError('예금주가 사업자 상호 또는 대표자명과 일치하지 않습니다.'); return;
    }
    setLoading(true);
    try {
      await authApi.updateProfile({ bankName: bankForm.bankName, bankAccountNo: bankForm.accountNo, bankAccountHolder: bankForm.holder });
      const fd = new FormData(); fd.append('image', bankCopy); fd.append('docType', 'bank');
      await authApi.uploadDocument(fd);
      setStep(5);
    } catch (e: any) {
      setBankError(e.response?.data?.error || '계좌 저장 실패');
    } finally { setLoading(false); }
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
                    placeholder="홍길동" className="input-base"
                    onChange={(e) => accountForm.setValue('name', e.target.value.replace(/[^가-힣a-zA-Z\s]/g, ''))} />
                  {accountForm.formState.errors.name && <p className="text-red-500 text-xs mt-1">{accountForm.formState.errors.name.message as string}</p>}
                </div>
                <div>
                  <label className="label-base">연락처 *</label>
                  <div className="flex gap-2">
                    <input {...accountForm.register('phone', { required: '연락처를 입력해주세요' })}
                      placeholder="010-0000-0000" type="tel" className="input-base flex-1"
                      disabled={phoneVerified}
                      onChange={(e) => { const d = e.target.value.replace(/\D/g, '').slice(0, 11); const f = d.length <= 3 ? d : d.length <= 7 ? `${d.slice(0,3)}-${d.slice(3)}` : `${d.slice(0,3)}-${d.slice(3,7)}-${d.slice(7)}`; accountForm.setValue('phone', f); setPhoneSent(false); setPhoneVerified(false); setPhoneCode(''); }}
                      maxLength={13} />
                    <button type="button" onClick={handleSendPhoneCode}
                      disabled={phoneSending || phoneVerified}
                      className={clsx('shrink-0 px-3 py-2 rounded-xl text-xs font-medium transition-all whitespace-nowrap',
                        phoneVerified ? 'bg-green-100 text-green-700 border border-green-200' :
                        'bg-tea-600 text-white hover:bg-tea-700')}>
                      {phoneSending ? <Loader2 size={14} className="animate-spin" /> :
                       phoneVerified ? <CheckCircle2 size={14} /> :
                       phoneSent ? '재발송' : '인증요청'}
                    </button>
                  </div>
                  {accountForm.formState.errors.phone && <p className="text-red-500 text-xs mt-1">{accountForm.formState.errors.phone.message as string}</p>}
                  {phoneSent && !phoneVerified && (
                    <div className="mt-2 flex gap-2">
                      <input
                        type="text" maxLength={6} value={phoneCode}
                        onChange={(e) => setPhoneCode(e.target.value.replace(/\D/g, ''))}
                        placeholder="인증번호 6자리"
                        className="input-base flex-1 tracking-widest text-center font-mono" />
                      <button type="button" onClick={handleVerifyPhoneCode}
                        disabled={phoneVerifying || phoneCode.length !== 6}
                        className="shrink-0 px-4 py-2 bg-tea-600 text-white rounded-xl text-xs font-medium hover:bg-tea-700 disabled:opacity-50">
                        {phoneVerifying ? <Loader2 size={14} className="animate-spin" /> : '확인'}
                      </button>
                    </div>
                  )}
                  {phoneSent && !phoneVerified && phoneTimer > 0 && (
                    <p className="text-xs text-amber-600 mt-1">
                      남은 시간: {Math.floor(phoneTimer / 60)}:{String(phoneTimer % 60).padStart(2, '0')}
                    </p>
                  )}
                  {phoneVerified && (
                    <p className="text-green-600 text-xs mt-1 flex items-center gap-1"><CheckCircle2 size={11} /> 인증 완료</p>
                  )}
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
                    storeForm.setValue('slug', slugify(e.target.value) + '-' + Date.now().toString(36).slice(-4));
                  }} />
                {storeForm.formState.errors.storeName && <p className="text-red-500 text-xs mt-1">{storeForm.formState.errors.storeName.message as string}</p>}
                {watchSlug && <p className="text-xs text-gray-400 mt-1">스토어 URL: {watchSlug}</p>}
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
                <h2 className="text-lg font-bold text-gray-900">사업자 정보</h2>
                <p className="text-gray-500 text-sm mt-0.5">사업자 서류를 제출하면 관리자 검토 후 사업자 인증이 완료됩니다.</p>
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
                <label className="label-base">사업자 등록번호 *</label>
                <input {...bizForm.register('businessNumber')}
                  placeholder="000-00-00000" className="input-base"
                  onChange={(e) => bizForm.setValue('businessNumber', formatBizNum(e.target.value))}
                  maxLength={12} />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label-base">상호명 *</label>
                  <input {...bizForm.register('businessName')} placeholder="○○ 다원" className="input-base"
                    onChange={(e) => bizForm.setValue('businessName', e.target.value.replace(/[<>{}()\/\\]/g, ''))} />
                </div>
                <div>
                  <label className="label-base">대표자명 *</label>
                  <input {...bizForm.register('businessOwner')} placeholder="홍길동" className="input-base"
                    onChange={(e) => bizForm.setValue('businessOwner', e.target.value.replace(/[^가-힣a-zA-Z\s]/g, ''))} />
                </div>
                <div>
                  <label className="label-base">개업일</label>
                  <input {...bizForm.register('startDate')} type="date" className="input-base" />
                </div>
                <div>
                  <label className="label-base">업태 *</label>
                  <input {...bizForm.register('businessType')} placeholder="도소매업" className="input-base" />
                </div>
              </div>
              <div>
                <label className="label-base">사업장 주소 *</label>
                <input {...bizForm.register('businessAddress')} placeholder="서울시 강남구..." className="input-base" />
              </div>
              <div>
                <label className="label-base">종목</label>
                <input {...bizForm.register('businessCategory')} placeholder="차, 다기류" className="input-base" />
              </div>

              {/* 사업자 인증 안내 */}
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-3">
                <div className="flex items-start gap-2">
                  <Building2 size={16} className="text-blue-500 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-blue-700 text-xs font-semibold">사업자 인증 안내</p>
                    <p className="text-blue-600 text-xs mt-1">아래 서류를 제출하시면 관리자가 검토 후 사업자 인증을 승인합니다. 승인까지 1~2 영업일이 소요됩니다.</p>
                  </div>
                </div>
              </div>

              {/* 서류 업로드 */}
              <div className="space-y-3 border-t border-gray-200 pt-4">
                <p className="text-sm font-semibold text-gray-800">서류 업로드</p>
                <div>
                  <label className="label-base">사업자등록증 *</label>
                  <input type="file" accept="image/*,.pdf" className="input-base text-xs"
                    onChange={(e) => { if (e.target.files?.[0]) setBizLicense(e.target.files[0]); }} />
                  {bizLicense && <p className="text-xs text-green-600 mt-0.5">{bizLicense.name}</p>}
                </div>
                <div>
                  <label className="label-base">통신판매업신고증 <span className="text-gray-400 font-normal text-xs">(간이과세자 면제)</span></label>
                  <input type="file" accept="image/*,.pdf" className="input-base text-xs"
                    onChange={(e) => { if (e.target.files?.[0]) setSalesPermit(e.target.files[0]); }} />
                  {salesPermit && <p className="text-xs text-green-600 mt-0.5">{salesPermit.name}</p>}
                </div>
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
              </div>
            </div>
          )}

          {/* ── STEP 4: 정산 계좌 설정 ── */}
          {step === 4 && (
            <div className="space-y-4">
              <div>
                <h2 className="text-lg font-bold text-gray-900">정산 계좌 설정</h2>
                <p className="text-gray-500 text-sm mt-0.5">매월 1일에 전월 구매확정된 금액이 정산됩니다. 예금주는 사업자 상호 또는 대표자명과 일치해야 합니다.</p>
              </div>

              <div>
                <label className="label-base">은행명 *</label>
                <select value={bankForm.bankName} onChange={e => setBankForm({...bankForm, bankName: e.target.value})}
                  className="input-base">
                  <option value="">선택해주세요</option>
                  {['국민은행','신한은행','하나은행','우리은행','농협은행','기업은행','SC제일은행','카카오뱅크','토스뱅크','케이뱅크','새마을금고','우체국','수협','대구은행','부산은행','경남은행','광주은행','전북은행','제주은행'].map(b => <option key={b} value={b}>{b}</option>)}
                </select>
              </div>
              <div>
                <label className="label-base">계좌번호 *</label>
                <input value={bankForm.accountNo} onChange={e => setBankForm({...bankForm, accountNo: e.target.value.replace(/[^\d-]/g, '')})}
                  placeholder="- 포함하여 입력" className="input-base" />
              </div>
              <div>
                <label className="label-base">예금주 *</label>
                <input value={bankForm.holder} onChange={e => setBankForm({...bankForm, holder: e.target.value})}
                  placeholder="사업자 상호 또는 대표자명" className="input-base" />
                <p className="text-xs text-gray-400 mt-1">사업자등록증의 상호 또는 대표자명과 일치해야 합니다</p>
              </div>

              <div>
                <label className="label-base">통장사본 *</label>
                <input type="file" accept="image/*,.pdf" className="input-base text-xs"
                  onChange={(e) => { if (e.target.files?.[0]) setBankCopy(e.target.files[0]); }} />
                {bankCopy && <p className="text-xs text-green-600 mt-0.5">{bankCopy.name}</p>}
                <p className="text-xs text-gray-400 mt-0.5">대표자 명의 또는 법인 명의 통장</p>
              </div>

              {bankError && <p className="text-xs text-red-500">{bankError}</p>}

              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => setStep(3)} className="btn-secondary w-10 px-0 shrink-0">
                  <ChevronLeft size={18} />
                </button>
                <button type="button" onClick={handleBankSave} disabled={loading} className="btn-primary flex-1 py-3">
                  {loading ? <Loader2 size={18} className="animate-spin" /> : <ChevronRight size={18} />}
                  가입 완료
                </button>
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
