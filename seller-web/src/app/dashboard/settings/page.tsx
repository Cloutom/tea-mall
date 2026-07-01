'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { useMutation } from '@tanstack/react-query';
import { authApi } from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import toast from 'react-hot-toast';
import { User, Lock, Bell, Shield, Loader2, CheckCircle2, ChevronRight, Eye, EyeOff, MessageCircle, AlertTriangle } from 'lucide-react';
import { clsx } from 'clsx';

const TABS = [
  { id: 'profile', label: '계정 정보', icon: User },
  { id: 'business', label: '사업자 정보', icon: Shield },
  { id: 'password', label: '비밀번호 변경', icon: Lock },
  { id: 'notification', label: '알림 설정', icon: Bell },
  { id: 'withdraw', label: '폐업 신청', icon: AlertTriangle },
];

const NOTIFY_ITEMS = [
  { key: 'notifyOrder', label: '새 주문 알림', desc: '새 주문이 들어오면 알려드립니다' },
  { key: 'notifyReview', label: '리뷰 알림', desc: '새 리뷰가 등록되면 알려드립니다' },
  { key: 'notifySettlement', label: '정산 알림', desc: '정산이 완료되면 알려드립니다' },
  { key: 'notifyStock', label: '재고 부족 알림', desc: '재고가 5개 이하로 줄면 알려드립니다' },
  { key: 'notifySystem', label: '시스템 공지', desc: '서비스 업데이트 및 공지사항' },
];

export default function SettingsPage() {
  const { seller, setSeller } = useAuthStore();
  const [tab, setTab] = useState('profile');
  const [showPw, setShowPw] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);
  const [showConfirmPw, setShowConfirmPw] = useState(false);
  const [pwStep, setPwStep] = useState<'verify' | 'change'>('verify');
  const [verifying, setVerifying] = useState(false);

  const profileForm = useForm({
    defaultValues: { phone: seller?.phone || '' },
  });

  const verifyForm = useForm({ defaultValues: { currentPassword: '' } });
  const newPwForm = useForm({ defaultValues: { newPassword: '', confirmPassword: '' } });

  const [notifySettings, setNotifySettings] = useState({
    notifyOrder: true, notifyReview: true, notifySettlement: true,
    notifyStock: false, notifySystem: true, notifyKakao: false,
  });

  useEffect(() => {
    if (seller) {
      setNotifySettings({
        notifyOrder: (seller as any).notifyOrder ?? true,
        notifyReview: (seller as any).notifyReview ?? true,
        notifySettlement: (seller as any).notifySettlement ?? true,
        notifyStock: (seller as any).notifyStock ?? false,
        notifySystem: (seller as any).notifySystem ?? true,
        notifyKakao: (seller as any).notifyKakao ?? false,
      });
    }
  }, [seller]);

  const profileMutation = useMutation({
    mutationFn: (data: any) => authApi.updateProfile(data),
    onSuccess: (res) => {
      setSeller(res.data.data);
      toast.success('연락처가 수정되었습니다.');
    },
    onError: () => toast.error('저장에 실패했습니다.'),
  });

  const handleVerifyPassword = async (data: any) => {
    setVerifying(true);
    try {
      await authApi.verifyPassword(data.currentPassword);
      setPwStep('change');
      toast.success('비밀번호가 확인되었습니다.');
    } catch (e: any) {
      toast.error(e.response?.data?.error || '비밀번호가 일치하지 않습니다.');
    } finally { setVerifying(false); }
  };

  const pwMutation = useMutation({
    mutationFn: async (data: any) => {
      if (data.newPassword !== data.confirmPassword) throw new Error('비밀번호가 일치하지 않습니다');
      const cur = verifyForm.getValues('currentPassword');
      if (cur === data.newPassword) throw new Error('현재 비밀번호와 새 비밀번호가 동일합니다');
      return authApi.changePassword({ currentPassword: cur, newPassword: data.newPassword });
    },
    onSuccess: () => {
      toast.success('비밀번호가 변경되었습니다.');
      verifyForm.reset(); newPwForm.reset(); setPwStep('verify');
    },
    onError: (e: any) => toast.error(e.response?.data?.error || e.message || '비밀번호 변경에 실패했습니다.'),
  });

  const notifyMutation = useMutation({
    mutationFn: (data: any) => authApi.updateNotificationSettings(data),
    onSuccess: (res) => {
      const d = res.data.data;
      if (d) setNotifySettings(d);
      toast.success('알림 설정이 저장되었습니다.');
    },
    onError: () => toast.error('알림 설정 저장에 실패했습니다.'),
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
                <label className="label-base">이름</label>
                <input value={seller?.name || ''} readOnly className="input-base bg-gray-50 text-gray-400 cursor-not-allowed" />
                <p className="text-xs text-gray-400 mt-1">이름은 변경할 수 없습니다</p>
              </div>
              <div>
                <label className="label-base">연락처</label>
                <input {...profileForm.register('phone')} placeholder="010-0000-0000" className="input-base" />
                <p className="text-xs text-gray-400 mt-1">알림을 받을 연락처를 입력해주세요</p>
              </div>
              <button type="submit" disabled={profileMutation.isPending} className="btn-primary w-full py-2.5">
                {profileMutation.isPending ? <Loader2 size={16} className="animate-spin" /> : null}
                연락처 저장
              </button>
            </form>
          )}

          {/* 사업자 정보 (읽기 전용) */}
          {tab === 'business' && (
            <div className="card space-y-4">
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
              <p className="text-xs text-gray-400">사업자 정보는 가입 시 입력한 내용이며, 수정이 필요한 경우 관리자에게 문의해주세요.</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="label-base">사업자등록번호</label>
                  <div className="input-base bg-gray-50 text-gray-600 cursor-not-allowed">{seller?.businessNumber || '-'}</div>
                </div>
                <div>
                  <label className="label-base">상호명</label>
                  <div className="input-base bg-gray-50 text-gray-600 cursor-not-allowed">{seller?.businessName || '-'}</div>
                </div>
                <div>
                  <label className="label-base">대표자명</label>
                  <div className="input-base bg-gray-50 text-gray-600 cursor-not-allowed">{(seller as any)?.businessOwner || '-'}</div>
                </div>
                <div>
                  <label className="label-base">업태</label>
                  <div className="input-base bg-gray-50 text-gray-600 cursor-not-allowed">{seller?.businessType || '-'}</div>
                </div>
                <div>
                  <label className="label-base">종목</label>
                  <div className="input-base bg-gray-50 text-gray-600 cursor-not-allowed">{seller?.businessCategory || '-'}</div>
                </div>
              </div>
              <div>
                <label className="label-base">사업장 주소</label>
                <div className="input-base bg-gray-50 text-gray-600 cursor-not-allowed">{seller?.businessAddress || '-'}</div>
              </div>
            </div>
          )}

          {/* 비밀번호 변경 */}
          {tab === 'password' && (
            <div className="card space-y-4">
              <h2 className="font-semibold text-gray-900">비밀번호 변경</h2>

              {pwStep === 'verify' ? (
                <form onSubmit={verifyForm.handleSubmit(handleVerifyPassword)} className="space-y-4">
                  <p className="text-sm text-gray-500">본인 확인을 위해 현재 비밀번호를 입력해주세요.</p>
                  <div>
                    <label className="label-base">현재 비밀번호</label>
                    <div className="relative">
                      <input {...verifyForm.register('currentPassword', { required: '현재 비밀번호를 입력해주세요' })}
                        type={showPw ? 'text' : 'password'} className="input-base pr-10" placeholder="현재 비밀번호 입력" />
                      <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                        {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                    {verifyForm.formState.errors.currentPassword && (
                      <p className="text-red-500 text-xs mt-1">{verifyForm.formState.errors.currentPassword.message as string}</p>
                    )}
                  </div>
                  <button type="submit" disabled={verifying} className="btn-primary w-full py-2.5">
                    {verifying ? <Loader2 size={16} className="animate-spin" /> : null}
                    확인
                  </button>
                </form>
              ) : (
                <form onSubmit={newPwForm.handleSubmit((d) => pwMutation.mutate(d))} className="space-y-4">
                  <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-xl">
                    <CheckCircle2 size={16} className="text-green-600 shrink-0" />
                    <p className="text-sm text-green-700">본인 확인 완료. 새 비밀번호를 설정해주세요.</p>
                  </div>

                  <div className="bg-gray-50 rounded-xl p-3">
                    <p className="text-xs font-medium text-gray-600 mb-1">비밀번호 조건</p>
                    <ul className="text-xs text-gray-500 space-y-0.5 list-disc list-inside">
                      <li>8자 이상 20자 이하</li>
                      <li>영문자, 숫자, 특수문자 각 1개 이상 포함</li>
                      <li>현재 비밀번호와 다른 비밀번호</li>
                    </ul>
                  </div>

                  <div>
                    <label className="label-base">새 비밀번호</label>
                    <div className="relative">
                      <input {...newPwForm.register('newPassword', {
                        required: '새 비밀번호를 입력해주세요',
                        minLength: { value: 8, message: '8자 이상 입력해주세요' },
                        maxLength: { value: 20, message: '20자 이하로 입력해주세요' },
                        validate: {
                          hasLetter: (v) => /[a-zA-Z]/.test(v) || '영문자를 포함해주세요',
                          hasNumber: (v) => /[0-9]/.test(v) || '숫자를 포함해주세요',
                          hasSpecial: (v) => /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?`~]/.test(v) || '특수문자를 포함해주세요',
                          notSame: (v) => v !== verifyForm.getValues('currentPassword') || '현재 비밀번호와 동일합니다',
                        },
                      })}
                        type={showNewPw ? 'text' : 'password'} className="input-base pr-10" placeholder="새 비밀번호 입력" />
                      <button type="button" onClick={() => setShowNewPw(!showNewPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                        {showNewPw ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                    {newPwForm.formState.errors.newPassword && (
                      <p className="text-red-500 text-xs mt-1">{newPwForm.formState.errors.newPassword.message as string}</p>
                    )}
                  </div>

                  <div>
                    <label className="label-base">새 비밀번호 확인</label>
                    <div className="relative">
                      <input {...newPwForm.register('confirmPassword', {
                        required: '비밀번호 확인을 입력해주세요',
                        validate: (v) => v === newPwForm.getValues('newPassword') || '비밀번호가 일치하지 않습니다',
                      })}
                        type={showConfirmPw ? 'text' : 'password'} className="input-base pr-10" placeholder="새 비밀번호 재입력" />
                      <button type="button" onClick={() => setShowConfirmPw(!showConfirmPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                        {showConfirmPw ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                    {newPwForm.formState.errors.confirmPassword && (
                      <p className="text-red-500 text-xs mt-1">{newPwForm.formState.errors.confirmPassword.message as string}</p>
                    )}
                  </div>

                  <div className="flex gap-3 pt-1">
                    <button type="button" onClick={() => { setPwStep('verify'); newPwForm.reset(); setShowNewPw(false); setShowConfirmPw(false); }}
                      className="btn-secondary flex-1 py-2.5">뒤로</button>
                    <button type="submit" disabled={pwMutation.isPending} className="btn-primary flex-1 py-2.5">
                      {pwMutation.isPending ? <Loader2 size={16} className="animate-spin" /> : null}
                      비밀번호 변경
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}

          {/* 알림 설정 */}
          {tab === 'notification' && (
            <div className="card space-y-4">
              <h2 className="font-semibold text-gray-900">알림 설정</h2>
              <p className="text-sm text-gray-500">어떤 알림을 받을지 선택하세요</p>
              <div className="space-y-3">
                {NOTIFY_ITEMS.map((item) => (
                  <label key={item.key} className="flex items-center justify-between p-3 rounded-xl hover:bg-gray-50 cursor-pointer transition-colors">
                    <div>
                      <p className="text-sm font-medium text-gray-800">{item.label}</p>
                      <p className="text-xs text-gray-400">{item.desc}</p>
                    </div>
                    <input type="checkbox"
                      checked={(notifySettings as any)[item.key]}
                      onChange={(e) => setNotifySettings(prev => ({ ...prev, [item.key]: e.target.checked }))}
                      className="w-5 h-5 accent-tea-600 rounded" />
                  </label>
                ))}
              </div>

              {/* 카카오톡 알림 연동 */}
              <div className="border-t border-gray-100 pt-4">
                <div className="flex items-center justify-between p-3 rounded-xl bg-yellow-50 border border-yellow-200">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-yellow-400 rounded-xl flex items-center justify-center">
                      <MessageCircle size={20} className="text-white" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-gray-800">카카오톡 알림</p>
                      <p className="text-xs text-gray-500">
                        {(seller as any)?.kakaoConnected
                          ? '연동 완료 — 주문 알림이 카카오톡으로 발송됩니다'
                          : '카카오 계정을 연동하면 카카오톡으로 알림을 받습니다'}
                      </p>
                    </div>
                  </div>
                  {(seller as any)?.kakaoConnected ? (
                    <button onClick={async () => {
                      if (!confirm('카카오톡 알림 연동을 해제하시겠습니까?')) return;
                      try {
                        await authApi.disconnectKakaoNotify();
                        const res = await authApi.getMe();
                        setSeller(res.data.data);
                        toast.success('카카오톡 연동이 해제되었습니다.');
                      } catch { toast.error('해제에 실패했습니다.'); }
                    }}
                      className="text-xs text-red-500 hover:underline shrink-0">연동 해제</button>
                  ) : (
                    <button onClick={async () => {
                      try {
                        const res = await authApi.connectKakaoNotify();
                        window.open(res.data.data.url, 'kakao_connect', 'width=500,height=600');
                        const check = setInterval(async () => {
                          try {
                            const me = await authApi.getMe();
                            if (me.data.data?.kakaoConnected) {
                              clearInterval(check);
                              setSeller(me.data.data);
                              toast.success('카카오톡 알림 연동 완료!');
                            }
                          } catch {}
                        }, 2000);
                        setTimeout(() => clearInterval(check), 60000);
                      } catch { toast.error('연동 요청에 실패했습니다.'); }
                    }}
                      className="px-4 py-2 bg-yellow-400 text-gray-900 text-xs font-bold rounded-xl hover:bg-yellow-500 transition-colors shrink-0">
                      카카오 연동하기
                    </button>
                  )}
                </div>
              </div>

              <button
                onClick={() => notifyMutation.mutate(notifySettings)}
                disabled={notifyMutation.isPending}
                className="btn-primary w-full py-2.5 mt-2">
                {notifyMutation.isPending ? <Loader2 size={16} className="animate-spin" /> : null}
                알림 설정 저장
              </button>
            </div>
          )}

          {/* 폐업 신청 */}
          {tab === 'withdraw' && (
            <div className="card space-y-4">
              <h2 className="font-semibold text-gray-900">폐업 신청</h2>

              {(seller as any)?.status === 'WITHDRAW_REQUESTED' ? (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-2">
                  <p className="text-sm font-semibold text-amber-800">폐업 신청이 접수되었습니다</p>
                  <p className="text-xs text-amber-600">관리자 확인 후 처리됩니다. 승인 전까지 스토어는 정상 운영됩니다.</p>
                  {(seller as any)?.withdrawReason && (
                    <p className="text-xs text-gray-500">신청 사유: {(seller as any).withdrawReason}</p>
                  )}
                </div>
              ) : (seller as any)?.status === 'CLOSED' ? (
                <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                  <p className="text-sm font-semibold text-red-800">폐업 처리가 완료되었습니다</p>
                </div>
              ) : (
                <>
                  <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                    <div className="flex items-start gap-2">
                      <AlertTriangle size={16} className="text-red-500 mt-0.5 shrink-0" />
                      <div>
                        <p className="text-sm font-semibold text-red-700">폐업 신청 안내</p>
                        <ul className="text-xs text-red-600 mt-1 space-y-0.5 list-disc list-inside">
                          <li>폐업 신청 후 관리자 승인 시 스토어가 비공개 처리됩니다</li>
                          <li>미처리 주문이 있는 경우 모두 처리 후 신청해주세요</li>
                          <li>미정산 금액은 정산 완료 후 폐업됩니다</li>
                          <li>폐업 후 동일 사업자번호로 재가입이 제한될 수 있습니다</li>
                        </ul>
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="label-base">폐업 사유</label>
                    <textarea id="withdraw-reason" placeholder="폐업 사유를 입력해주세요"
                      className="input-base h-24 resize-none" />
                  </div>

                  <div>
                    <label className="label-base">비밀번호 확인</label>
                    <input type="password" id="withdraw-password" placeholder="본인 확인을 위해 비밀번호를 입력해주세요"
                      className="input-base" />
                  </div>

                  <button
                    onClick={async () => {
                      const reason = (document.getElementById('withdraw-reason') as HTMLTextAreaElement)?.value;
                      const password = (document.getElementById('withdraw-password') as HTMLInputElement)?.value;
                      if (!password) { toast.error('비밀번호를 입력해주세요.'); return; }
                      if (!confirm('정말 폐업을 신청하시겠습니까? 이 작업은 관리자 승인 후 진행됩니다.')) return;
                      try {
                        await authApi.updateProfile({ withdrawRequest: true }); // fallback
                        const res = await fetch('/api/auth/withdraw', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${useAuthStore.getState().accessToken}` },
                          body: JSON.stringify({ reason, password }),
                        });
                        const data = await res.json();
                        if (data.success) {
                          toast.success('폐업 신청이 접수되었습니다.');
                          const me = await authApi.getMe();
                          setSeller(me.data.data);
                        } else {
                          toast.error(data.error || '폐업 신청 실패');
                        }
                      } catch { toast.error('폐업 신청에 실패했습니다.'); }
                    }}
                    className="w-full py-2.5 bg-red-500 text-white rounded-xl font-semibold text-sm hover:bg-red-600 transition-colors">
                    폐업 신청하기
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
