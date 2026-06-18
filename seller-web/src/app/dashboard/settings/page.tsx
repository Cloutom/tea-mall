'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useMutation } from '@tanstack/react-query';
import { authApi } from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import toast from 'react-hot-toast';
import { User, Lock, Bell, Shield, Loader2, CheckCircle2, ChevronRight, Eye, EyeOff } from 'lucide-react';
import { clsx } from 'clsx';

const TABS = [
  { id: 'profile', label: '계정 정보', icon: User },
  { id: 'business', label: '사업자 정보', icon: Shield },
  { id: 'password', label: '비밀번호 변경', icon: Lock },
  { id: 'notification', label: '알림 설정', icon: Bell },
];

export default function SettingsPage() {
  const { seller, setSeller } = useAuthStore();
  const [tab, setTab] = useState('profile');
  const [showPw, setShowPw] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);

  const profileForm = useForm({
    defaultValues: {
      name: seller?.name || '',
      phone: seller?.phone || '',
    },
  });

  const bizForm = useForm({
    defaultValues: {
      businessNumber: seller?.businessNumber || '',
      businessName: seller?.businessName || '',
      businessOwner: (seller as any)?.businessOwner || '',
      businessAddress: seller?.businessAddress || '',
      businessType: seller?.businessType || '',
      businessCategory: seller?.businessCategory || '',
    },
  });

  const pwForm = useForm({
    defaultValues: { currentPassword: '', newPassword: '', confirmPassword: '' },
  });

  const profileMutation = useMutation({
    mutationFn: (data: any) => authApi.updateProfile(data),
    onSuccess: (res) => {
      setSeller(res.data.data);
      toast.success('계정 정보가 수정되었습니다.');
    },
    onError: () => toast.error('저장에 실패했습니다.'),
  });

  const bizMutation = useMutation({
    mutationFn: (data: any) => authApi.updateProfile(data),
    onSuccess: (res) => {
      setSeller(res.data.data);
      toast.success('사업자 정보가 저장되었습니다.');
    },
    onError: () => toast.error('저장에 실패했습니다.'),
  });

  const pwMutation = useMutation({
    mutationFn: async (data: any) => {
      if (data.newPassword !== data.confirmPassword) throw new Error('비밀번호가 일치하지 않습니다');
      return authApi.updateProfile({ currentPassword: data.currentPassword, newPassword: data.newPassword });
    },
    onSuccess: () => { toast.success('비밀번호가 변경되었습니다.'); pwForm.reset(); },
    onError: (e: any) => toast.error(e.message || '비밀번호 변경에 실패했습니다.'),
  });

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-0 animate-fade-in">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">설정</h1>
        <p className="text-gray-500 text-sm mt-0.5">계정 및 비즈니스 정보를 관리하세요</p>
      </div>

      <div className="flex flex-col sm:flex-row gap-4">
        {/* 탭 네비게이션 */}
        <div className="sm:w-48 shrink-0">
          <nav className="space-y-1">
            {TABS.map((t) => (
              <button key={t.id} onClick={() => setTab(t.id)}
                className={clsx('w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all text-left',
                  tab === t.id ? 'bg-tea-600 text-white shadow-sm' : 'text-gray-600 hover:bg-gray-100')}>
                <t.icon size={16} className={tab === t.id ? 'text-white' : 'text-gray-400'} />
                {t.label}
                {tab !== t.id && <ChevronRight size={14} className="ml-auto text-gray-300" />}
              </button>
            ))}
          </nav>

          {/* 계정 요약 */}
          <div className="mt-4 p-3 bg-gray-50 rounded-xl">
            <div className="w-12 h-12 bg-tea-200 rounded-full flex items-center justify-center mx-auto mb-2">
              <span className="text-tea-700 font-bold text-lg">{seller?.name?.[0] || 'S'}</span>
            </div>
            <p className="text-xs font-semibold text-gray-800 text-center">{seller?.name}</p>
            <p className="text-xs text-gray-400 text-center truncate">{seller?.email}</p>
            {seller?.businessVerified && (
              <div className="flex items-center justify-center gap-1 mt-2 text-xs text-green-600">
                <CheckCircle2 size={12} /> 사업자 인증 완료
              </div>
            )}
          </div>
        </div>

        {/* 탭 콘텐츠 */}
        <div className="flex-1">
          {/* 계정 정보 */}
          {tab === 'profile' && (
            <form onSubmit={profileForm.handleSubmit((d) => profileMutation.mutate(d))} className="card space-y-5">
              <h2 className="font-semibold text-gray-900">기본 정보</h2>
              <div>
                <label className="label-base">이메일</label>
                <input value={seller?.email || ''} readOnly className="input-base bg-gray-50 text-gray-400 cursor-not-allowed" />
                <p className="text-xs text-gray-400 mt-1">이메일은 변경할 수 없습니다</p>
              </div>
              <div>
                <label className="label-base">이름 *</label>
                <input {...profileForm.register('name', { required: '이름을 입력해주세요' })} className="input-base" />
                {profileForm.formState.errors.name && <p className="text-red-500 text-xs mt-1">{profileForm.formState.errors.name.message as string}</p>}
              </div>
              <div>
                <label className="label-base">연락처</label>
                <input {...profileForm.register('phone')} placeholder="010-0000-0000" className="input-base" />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => profileForm.reset()} className="btn-secondary flex-1 py-2.5">초기화</button>
                <button type="submit" disabled={profileMutation.isPending} className="btn-primary flex-1 py-2.5">
                  {profileMutation.isPending ? <Loader2 size={16} className="animate-spin" /> : null}
                  저장
                </button>
              </div>
            </form>
          )}

          {/* 사업자 정보 */}
          {tab === 'business' && (
            <form onSubmit={bizForm.handleSubmit((d) => bizMutation.mutate(d))} className="card space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="font-semibold text-gray-900">사업자 정보</h2>
                {seller?.businessVerified ? (
                  <span className="flex items-center gap-1 text-xs text-green-600 bg-green-50 px-2.5 py-1 rounded-full">
                    <CheckCircle2 size={12} /> 인증 완료
                  </span>
                ) : (
                  <span className="text-xs text-amber-600 bg-amber-50 px-2.5 py-1 rounded-full">미인증</span>
                )}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                <div>
                  <label className="label-base">업태</label>
                  <input {...bizForm.register('businessType')} placeholder="예: 소매업" className="input-base" />
                </div>
                <div>
                  <label className="label-base">종목</label>
                  <input {...bizForm.register('businessCategory')} placeholder="예: 차·음료" className="input-base" />
                </div>
              </div>
              <div>
                <label className="label-base">사업장 주소</label>
                <input {...bizForm.register('businessAddress')} className="input-base" />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => bizForm.reset()} className="btn-secondary flex-1 py-2.5">초기화</button>
                <button type="submit" disabled={bizMutation.isPending} className="btn-primary flex-1 py-2.5">
                  {bizMutation.isPending ? <Loader2 size={16} className="animate-spin" /> : null}
                  저장
                </button>
              </div>
            </form>
          )}

          {/* 비밀번호 변경 */}
          {tab === 'password' && (
            <form onSubmit={pwForm.handleSubmit((d) => pwMutation.mutate(d))} className="card space-y-4">
              <h2 className="font-semibold text-gray-900">비밀번호 변경</h2>
              <div>
                <label className="label-base">현재 비밀번호</label>
                <div className="relative">
                  <input {...pwForm.register('currentPassword', { required: true })} type={showPw ? 'text' : 'password'} className="input-base pr-10" />
                  <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                    {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>
              <div>
                <label className="label-base">새 비밀번호 (8자 이상)</label>
                <div className="relative">
                  <input {...pwForm.register('newPassword', { required: true, minLength: 8 })} type={showNewPw ? 'text' : 'password'} className="input-base pr-10" />
                  <button type="button" onClick={() => setShowNewPw(!showNewPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                    {showNewPw ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>
              <div>
                <label className="label-base">새 비밀번호 확인</label>
                <input {...pwForm.register('confirmPassword', { required: true })} type="password" className="input-base" />
              </div>
              <button type="submit" disabled={pwMutation.isPending} className="btn-primary w-full py-2.5">
                {pwMutation.isPending ? <Loader2 size={16} className="animate-spin" /> : null}
                비밀번호 변경
              </button>
            </form>
          )}

          {/* 알림 설정 */}
          {tab === 'notification' && (
            <div className="card space-y-4">
              <h2 className="font-semibold text-gray-900">알림 설정</h2>
              <p className="text-sm text-gray-500">어떤 알림을 받을지 선택하세요</p>
              <div className="space-y-3">
                {[
                  { id: 'order', label: '새 주문 알림', desc: '새 주문이 들어오면 알려드립니다', defaultChecked: true },
                  { id: 'review', label: '리뷰 알림', desc: '새 리뷰가 등록되면 알려드립니다', defaultChecked: true },
                  { id: 'settlement', label: '정산 알림', desc: '정산이 완료되면 알려드립니다', defaultChecked: true },
                  { id: 'stock', label: '재고 부족 알림', desc: '재고가 5개 이하로 줄면 알려드립니다', defaultChecked: false },
                  { id: 'system', label: '시스템 공지', desc: '서비스 업데이트 및 공지사항', defaultChecked: true },
                ].map((item) => (
                  <label key={item.id} className="flex items-center justify-between p-3 rounded-xl hover:bg-gray-50 cursor-pointer transition-colors">
                    <div>
                      <p className="text-sm font-medium text-gray-800">{item.label}</p>
                      <p className="text-xs text-gray-400">{item.desc}</p>
                    </div>
                    <input type="checkbox" defaultChecked={item.defaultChecked}
                      className="w-5 h-5 accent-tea-600 rounded" />
                  </label>
                ))}
              </div>
              <button onClick={() => toast.success('알림 설정이 저장되었습니다.')} className="btn-primary w-full py-2.5 mt-2">
                저장
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
