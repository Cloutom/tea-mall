'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { storeApi, courierApi, authApi } from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import toast from 'react-hot-toast';
import {
  Store, Building2, Truck, CheckCircle2, ChevronRight, ChevronLeft,
  Loader2, Plus, X, Star, SkipForward,
} from 'lucide-react';
import { clsx } from 'clsx';

const COURIER_LIST = [
  { code: 'CJ', name: 'CJ대한통운' },
  { code: 'HANJIN', name: '한진택배' },
  { code: 'LOTTE', name: '롯데택배' },
  { code: 'LOGEN', name: '로젠택배' },
  { code: 'EPOST', name: '우체국택배' },
  { code: 'KDEXP', name: '경동택배' },
  { code: 'CVSNET', name: 'GS편의점택배' },
  { code: 'CHUNILPS', name: '천일택배' },
];

const STEPS = [
  { id: 1, label: '스토어 정보', icon: Store },
  { id: 2, label: '사업자 정보', icon: Building2, optional: true },
  { id: 3, label: '택배사 설정', icon: Truck, optional: true },
  { id: 4, label: '완료', icon: CheckCircle2 },
];

function slugify(v: string) {
  return v.toLowerCase().replace(/[^a-z0-9가-힣]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
}

export default function OnboardingPage() {
  const router = useRouter();
  const { seller, setSeller } = useAuthStore();
  const [step, setStep] = useState(1);
  const [couriers, setCouriers] = useState<any[]>([]);
  const [showCourierForm, setShowCourierForm] = useState(false);

  const storeForm = useForm({
    defaultValues: {
      name: seller?.businessName || '', slug: '', description: '', themeColor: '#2D6A4F',
    },
  });
  const bizForm = useForm({
    defaultValues: {
      businessNumber: seller?.businessNumber || '',
      businessName: seller?.businessName || '',
      businessOwner: (seller as any)?.businessOwner || '',
      businessAddress: seller?.businessAddress || '',
    },
  });
  const courierForm = useForm({
    defaultValues: {
      courierCode: 'CJ', senderName: seller?.name || '',
      senderPhone: seller?.phone || '', senderZipCode: '',
      senderAddress: seller?.businessAddress || '', senderAddressDetail: '',
    },
  });

  const createStoreMutation = useMutation({
    mutationFn: (data: any) => storeApi.createStore(data),
    onSuccess: (res) => {
      const updated = res.data.data?.seller || res.data.data;
      if (updated) setSeller(updated);
    },
  });

  const updateBizMutation = useMutation({
    mutationFn: (data: any) => authApi.updateProfile(data),
    onSuccess: (res) => { if (res.data.data) setSeller(res.data.data); },
  });

  const createCourierMutation = useMutation({
    mutationFn: (data: any) => courierApi.createAccount(data),
    onSuccess: (res) => {
      setCouriers((p) => [...p, res.data.data]);
      setShowCourierForm(false);
      courierForm.reset({ courierCode: 'CJ', senderName: seller?.name || '', senderPhone: seller?.phone || '', senderZipCode: '', senderAddress: '', senderAddressDetail: '' });
      toast.success('택배사가 등록되었습니다.');
    },
    onError: () => toast.error('택배사 등록에 실패했습니다.'),
  });

  const onStoreSubmit = async (data: any) => {
    if (!data.slug) data.slug = slugify(data.name);
    try {
      await createStoreMutation.mutateAsync(data);
      setStep(2);
    } catch (e: any) {
      toast.error(e.response?.data?.error || '스토어 생성에 실패했습니다.');
    }
  };

  const onBizSave = async () => {
    const data = bizForm.getValues();
    try {
      await updateBizMutation.mutateAsync(data);
      toast.success('사업자 정보가 저장되었습니다.');
    } catch {}
    setStep(3);
  };

  const onCourierAdd = (data: any) => {
    const courier = COURIER_LIST.find((c) => c.code === data.courierCode);
    createCourierMutation.mutate({ ...data, courierName: courier?.name || data.courierCode, isDefault: couriers.length === 0 });
  };

  const finishOnboarding = async () => {
    try {
      const res = await authApi.getMe();
      setSeller(res.data.data);
    } catch {}
    router.replace('/dashboard');
  };

  const watchSlug = storeForm.watch('slug');
  const watchName = storeForm.watch('name');

  return (
    <div className="min-h-screen bg-cream-50 flex flex-col items-center py-8 px-4">
      <div className="w-full max-w-lg">
        {/* 로고 */}
        <div className="text-center mb-8">
          <h1 className="text-xl font-bold text-gray-900">스토어 만들기</h1>
          <p className="text-gray-500 text-sm mt-1">안녕하세요, {seller?.name}님! 기본 정보를 설정해주세요.</p>
        </div>

        {/* 스텝 인디케이터 */}
        <div className="flex items-center mb-8 gap-0">
          {STEPS.map((s, i) => (
            <div key={s.id} className="flex items-center flex-1 min-w-0">
              <div className="flex flex-col items-center gap-1 w-full">
                <div className={clsx('w-8 h-8 rounded-full flex items-center justify-center border-2 transition-all shrink-0',
                  step > s.id ? 'bg-tea-600 border-tea-600 text-white' :
                  step === s.id ? 'bg-white border-tea-600 text-tea-600' :
                  'bg-white border-gray-200 text-gray-300')}>
                  {step > s.id ? <CheckCircle2 size={16} /> : <s.icon size={14} />}
                </div>
                <span className={clsx('text-xs font-medium hidden sm:block text-center leading-tight',
                  step >= s.id ? 'text-tea-700' : 'text-gray-400')}>
                  {s.label}
                  {s.optional && <span className="block text-gray-300">(선택)</span>}
                </span>
              </div>
              {i < STEPS.length - 1 && (
                <div className={clsx('h-0.5 flex-1 mx-1 mt-[-1.5rem] transition-all shrink-0',
                  step > s.id ? 'bg-tea-500' : 'bg-gray-200')} />
              )}
            </div>
          ))}
        </div>

        <div className="card">

          {/* ── STEP 1: 스토어 정보 (필수) ── */}
          {step === 1 && (
            <form onSubmit={storeForm.handleSubmit(onStoreSubmit)} className="space-y-5">
              <div>
                <h2 className="text-lg font-bold text-gray-900">스토어 정보</h2>
                <p className="text-gray-500 text-sm mt-1">소비자에게 보여질 스토어 이름을 입력해주세요</p>
              </div>
              <div>
                <label className="label-base">스토어 이름 *</label>
                <input
                  {...storeForm.register('name', { required: '스토어 이름을 입력해주세요' })}
                  placeholder="예: 보성 찻집"
                  className="input-base"
                  onChange={(e) => {
                    storeForm.setValue('name', e.target.value);
                    if (!watchSlug || watchSlug === slugify(watchName)) {
                      storeForm.setValue('slug', slugify(e.target.value));
                    }
                  }}
                />
                {storeForm.formState.errors.name && <p className="text-red-500 text-xs mt-1">{storeForm.formState.errors.name.message as string}</p>}
              </div>
              <div>
                <label className="label-base">스토어 URL *</label>
                <div className="flex items-center">
                  <span className="bg-gray-50 border border-r-0 border-gray-200 rounded-l-xl px-3 py-2.5 text-xs text-gray-400 shrink-0 whitespace-nowrap">shop.kr/</span>
                  <input
                    {...storeForm.register('slug', { required: 'URL을 입력해주세요' })}
                    placeholder="my-tea-store"
                    className="input-base rounded-l-none border-l-0 flex-1"
                  />
                </div>
                {storeForm.formState.errors.slug && <p className="text-red-500 text-xs mt-1">{storeForm.formState.errors.slug.message as string}</p>}
              </div>
              <div>
                <label className="label-base">스토어 소개 <span className="text-gray-400 font-normal">(선택)</span></label>
                <textarea {...storeForm.register('description')}
                  placeholder="소비자에게 스토어를 한 줄로 소개해주세요" className="input-base h-16 resize-none" />
              </div>
              <div>
                <label className="label-base">브랜드 색상 <span className="text-gray-400 font-normal">(선택)</span></label>
                <div className="flex items-center gap-3">
                  <input type="color" {...storeForm.register('themeColor')} className="w-12 h-10 rounded-lg border border-gray-200 cursor-pointer" />
                  <span className="text-sm text-gray-500">메인 컬러를 선택하세요</span>
                </div>
              </div>
              <button type="submit" disabled={createStoreMutation.isPending} className="btn-primary w-full py-3">
                {createStoreMutation.isPending ? <Loader2 size={18} className="animate-spin" /> : <ChevronRight size={18} />}
                다음 단계
              </button>
            </form>
          )}

          {/* ── STEP 2: 사업자 정보 (선택) ── */}
          {step === 2 && (
            <div className="space-y-5">
              <div>
                <h2 className="text-lg font-bold text-gray-900">사업자 정보 <span className="text-sm font-normal text-gray-400">(선택)</span></h2>
                <p className="text-gray-500 text-sm mt-1">정산 및 세금계산서 발행을 위해 입력해두면 좋습니다. 나중에 설정 메뉴에서도 입력할 수 있어요.</p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="label-base">사업자등록번호</label>
                  <input {...bizForm.register('businessNumber')} placeholder="000-00-00000" className="input-base" />
                </div>
                <div>
                  <label className="label-base">상호명</label>
                  <input {...bizForm.register('businessName')} className="input-base" />
                </div>
                <div>
                  <label className="label-base">대표자명</label>
                  <input {...bizForm.register('businessOwner')} className="input-base" />
                </div>
              </div>
              <div>
                <label className="label-base">사업장 주소</label>
                <input {...bizForm.register('businessAddress')} placeholder="서울시 강남구..." className="input-base" />
              </div>
              <div className="flex gap-3">
                <button type="button" onClick={() => setStep(1)} className="btn-secondary w-10 px-0 py-3 shrink-0">
                  <ChevronLeft size={18} />
                </button>
                <button type="button" onClick={onBizSave} disabled={updateBizMutation.isPending} className="btn-primary flex-1 py-3">
                  {updateBizMutation.isPending ? <Loader2 size={18} className="animate-spin" /> : <ChevronRight size={18} />}
                  저장 후 다음
                </button>
                <button type="button" onClick={() => setStep(3)} className="btn-secondary flex-1 py-3 text-gray-500">
                  <SkipForward size={16} /> 건너뛰기
                </button>
              </div>
            </div>
          )}

          {/* ── STEP 3: 택배사 설정 (선택) ── */}
          {step === 3 && (
            <div className="space-y-5">
              <div>
                <h2 className="text-lg font-bold text-gray-900">택배사 설정 <span className="text-sm font-normal text-gray-400">(선택)</span></h2>
                <p className="text-gray-500 text-sm mt-1">주문 발생 시 운송장 출력에 필요합니다. 배송 관리 메뉴에서 언제든 추가할 수 있어요.</p>
              </div>

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
                          <Star size={10} className="fill-amber-500" /> 기본
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {showCourierForm ? (
                <form onSubmit={courierForm.handleSubmit(onCourierAdd)} className="border border-gray-200 rounded-xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-gray-800">택배사 추가</p>
                    <button type="button" onClick={() => setShowCourierForm(false)}><X size={16} className="text-gray-400" /></button>
                  </div>
                  <div>
                    <label className="label-base">택배사</label>
                    <div className="grid grid-cols-4 gap-2">
                      {COURIER_LIST.map((c) => (
                        <label key={c.code} className="relative flex flex-col items-center gap-1 p-2 rounded-xl border cursor-pointer text-xs text-center hover:border-tea-300">
                          <input type="radio" {...courierForm.register('courierCode')} value={c.code} className="sr-only peer" />
                          <span className="text-gray-600 leading-tight text-[10px] font-medium">{c.name}</span>
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
                      <label className="label-base">발송인 연락처 *</label>
                      <input {...courierForm.register('senderPhone', { required: true })} placeholder="010-0000-0000" className="input-base" />
                    </div>
                    <div className="col-span-2">
                      <label className="label-base">발송지 주소 *</label>
                      <input {...courierForm.register('senderAddress', { required: true })} className="input-base" />
                    </div>
                  </div>
                  <button type="submit" disabled={createCourierMutation.isPending} className="btn-primary w-full py-2.5 text-sm">
                    {createCourierMutation.isPending ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
                    등록
                  </button>
                </form>
              ) : (
                <button type="button" onClick={() => setShowCourierForm(true)}
                  className="w-full border-2 border-dashed border-gray-200 rounded-xl py-4 text-sm text-gray-500 hover:border-tea-300 hover:text-tea-600 transition-all flex items-center justify-center gap-2">
                  <Plus size={16} /> 택배사 추가
                </button>
              )}

              <div className="flex gap-3">
                <button type="button" onClick={() => setStep(2)} className="btn-secondary w-10 px-0 py-3 shrink-0">
                  <ChevronLeft size={18} />
                </button>
                <button type="button" onClick={() => setStep(4)} className="btn-primary flex-1 py-3">
                  <ChevronRight size={18} />
                  {couriers.length > 0 ? '다음' : '다음'}
                </button>
                {couriers.length === 0 && (
                  <button type="button" onClick={() => setStep(4)} className="btn-secondary flex-1 py-3 text-gray-500">
                    <SkipForward size={16} /> 건너뛰기
                  </button>
                )}
              </div>
            </div>
          )}

          {/* ── STEP 4: 완료 ── */}
          {step === 4 && (
            <div className="text-center space-y-5 py-4">
              <div>
                <h2 className="text-xl font-bold text-gray-900">스토어가 준비되었습니다!</h2>
                <p className="text-gray-500 text-sm mt-2">이제 상품을 등록하고 판매를 시작해보세요.</p>
              </div>
              <div className="grid grid-cols-2 gap-3 text-left">
                {[
                  { title: '상품 등록', desc: '첫 차 상품을 등록하세요', href: '/dashboard/products/new' },
                  { title: '스토어 꾸미기', desc: '로고·배너를 설정하세요', href: '/dashboard/store' },
                  { title: '배송 관리', desc: '택배사를 추가하세요', href: '/dashboard/shipping' },
                  { title: '설정', desc: '사업자 정보를 완성하세요', href: '/dashboard/settings' },
                ].map((item) => (
                  <div key={item.href} className="p-3 bg-gray-50 rounded-xl text-left">
                    <p className="text-sm font-semibold text-gray-800">{item.title}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{item.desc}</p>
                  </div>
                ))}
              </div>
              <button onClick={finishOnboarding} className="btn-primary w-full py-3 text-base">
                대시보드로 이동
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
