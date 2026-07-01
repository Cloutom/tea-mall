'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';
import { consumerAuthApi } from '@/lib/api';
import NavBar from '@/components/NavBar';
import toast from 'react-hot-toast';
import { Lock, UserX, AlertTriangle } from 'lucide-react';

const PW_RULES = [
  { test: (v: string) => v.length >= 8 && v.length <= 20, label: '8~20자' },
  { test: (v: string) => /[a-zA-Z]/.test(v), label: '영문자' },
  { test: (v: string) => /[0-9]/.test(v), label: '숫자' },
  { test: (v: string) => /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?`~]/.test(v), label: '특수문자' },
];

export default function SecurityPage() {
  const router = useRouter();
  const { consumer, accessToken, clearAuth } = useAuthStore();
  useEffect(() => { if (!consumer) router.replace('/auth/login'); }, [consumer, router]);
  if (!consumer) return null;

  // 비밀번호 변경
  const [pwForm, setPwForm] = useState({ current: '', newPw: '', confirm: '' });
  const [pwLoading, setPwLoading] = useState(false);
  const pwChecks = PW_RULES.map(r => ({ ...r, pass: r.test(pwForm.newPw) }));
  const pwValid = pwChecks.every(c => c.pass) && pwForm.newPw === pwForm.confirm && pwForm.current.length > 0;

  const handleChangePw = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pwValid) return;
    setPwLoading(true);
    try {
      await consumerAuthApi.changePassword({ currentPassword: pwForm.current, newPassword: pwForm.newPw }, accessToken!);
      toast.success('비밀번호가 변경되었습니다');
      setPwForm({ current: '', newPw: '', confirm: '' });
    } catch (err: any) {
      toast.error(err?.response?.data?.error || '변경 실패');
    } finally { setPwLoading(false); }
  };

  // 탈퇴
  const [showWithdraw, setShowWithdraw] = useState(false);
  const [wdForm, setWdForm] = useState({ reason: '', password: '' });
  const [wdLoading, setWdLoading] = useState(false);

  const handleWithdraw = async () => {
    if (!wdForm.password) { toast.error('비밀번호를 입력해주세요'); return; }
    setWdLoading(true);
    try {
      await consumerAuthApi.requestWithdraw({ reason: wdForm.reason, password: wdForm.password }, accessToken!);
      toast.success('탈퇴 신청 완료. 30일 후 정보가 삭제됩니다.');
      clearAuth();
      router.push('/');
    } catch (err: any) {
      toast.error(err?.response?.data?.error || '탈퇴 신청 실패');
    } finally { setWdLoading(false); }
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-16">
      <NavBar title="보안 설정" back={true} />

      <div className="max-w-lg mx-auto px-4 py-6 space-y-4">

        {/* 비밀번호 변경 */}
        <div className="bg-white rounded-2xl border border-gray-100 p-5">
          <h3 className="text-sm font-semibold text-gray-800 flex items-center gap-2 mb-4">
            <Lock size={16} className="text-tea-600" /> 비밀번호 변경
          </h3>
          <form onSubmit={handleChangePw} className="space-y-3">
            <div>
              <label className="text-xs text-gray-500 block mb-1">현재 비밀번호</label>
              <input type="password" value={pwForm.current} onChange={e => setPwForm({...pwForm, current: e.target.value})}
                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-tea-500"
                placeholder="현재 비밀번호 입력" />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">새 비밀번호</label>
              <input type="password" value={pwForm.newPw} onChange={e => setPwForm({...pwForm, newPw: e.target.value})} maxLength={20}
                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-tea-500"
                placeholder="영문, 숫자, 특수문자 포함 8~20자" />
              {pwForm.newPw && (
                <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1">
                  {pwChecks.map(c => (
                    <span key={c.label} className={`text-xs ${c.pass ? 'text-green-600' : 'text-gray-400'}`}>{c.pass ? 'V' : 'O'} {c.label}</span>
                  ))}
                </div>
              )}
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">새 비밀번호 확인</label>
              <input type="password" value={pwForm.confirm} onChange={e => setPwForm({...pwForm, confirm: e.target.value})} maxLength={20}
                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-tea-500"
                placeholder="새 비밀번호 재입력" />
              {pwForm.confirm && pwForm.newPw !== pwForm.confirm && <p className="text-xs text-red-500 mt-1">비밀번호가 일치하지 않습니다</p>}
            </div>
            <button type="submit" disabled={pwLoading || !pwValid}
              className="w-full py-2.5 bg-tea-600 text-white rounded-lg text-sm font-medium hover:bg-tea-700 disabled:opacity-50">
              {pwLoading ? '변경 중...' : '비밀번호 변경'}
            </button>
          </form>
        </div>

        {/* 회원 탈퇴 */}
        <div className="bg-white rounded-2xl border border-gray-100 p-5">
          <h3 className="text-sm font-semibold text-gray-800 flex items-center gap-2 mb-2">
            <UserX size={16} className="text-red-500" /> 회원 탈퇴
          </h3>
          {!showWithdraw ? (
            <div>
              <p className="text-xs text-gray-400 mb-3">탈퇴 신청 후 30일간 데이터가 보관되며, 기간 내 재이용 시 철회 가능합니다.</p>
              <button onClick={() => setShowWithdraw(true)}
                className="text-sm text-red-500 hover:underline">탈퇴 신청하기</button>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-start gap-2">
                <AlertTriangle size={16} className="text-red-500 shrink-0 mt-0.5" />
                <div className="text-xs text-red-700">
                  <p className="font-semibold mb-1">탈퇴 시 유의사항</p>
                  <ul className="space-y-0.5 list-disc list-inside">
                    <li>보유 포인트가 모두 소멸됩니다</li>
                    <li>주문 내역, 리뷰 등이 30일 후 삭제됩니다</li>
                    <li>30일 이내 로그인 시 탈퇴를 철회할 수 있습니다</li>
                  </ul>
                </div>
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">탈퇴 사유 (선택)</label>
                <select value={wdForm.reason} onChange={e => setWdForm({...wdForm, reason: e.target.value})}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-tea-500">
                  <option value="">선택해주세요</option>
                  <option value="서비스 불만족">서비스 불만족</option>
                  <option value="사용 빈도 낮음">사용 빈도 낮음</option>
                  <option value="개인정보 우려">개인정보 우려</option>
                  <option value="다른 서비스 이용">다른 서비스 이용</option>
                  <option value="기타">기타</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">비밀번호 확인</label>
                <input type="password" value={wdForm.password} onChange={e => setWdForm({...wdForm, password: e.target.value})}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-400"
                  placeholder="본인 확인을 위해 비밀번호를 입력해주세요" />
              </div>
              <div className="flex gap-2">
                <button onClick={() => setShowWithdraw(false)} className="flex-1 py-2.5 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50">취소</button>
                <button onClick={handleWithdraw} disabled={wdLoading || !wdForm.password}
                  className="flex-1 py-2.5 bg-red-500 text-white rounded-lg text-sm font-medium hover:bg-red-600 disabled:opacity-50">
                  {wdLoading ? '처리 중...' : '탈퇴 신청'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
