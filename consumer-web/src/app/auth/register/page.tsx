'use client';

import { useState, useMemo, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { consumerAuthApi } from '@/lib/api';
import { useAuthStore } from '@/store/authStore';

declare global { interface Window { IMP?: any } }
const IMP_CODE = process.env.NEXT_PUBLIC_IMP_CODE || '';

const PW_RULES = [
  { test: (v: string) => v.length >= 8 && v.length <= 20, label: '8~20자' },
  { test: (v: string) => /[a-zA-Z]/.test(v), label: '영문자' },
  { test: (v: string) => /[0-9]/.test(v), label: '숫자' },
  { test: (v: string) => /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?`~]/.test(v), label: '특수문자' },
];

const formatPhone = (v: string) => {
  const d = v.replace(/\D/g, '').slice(0, 11);
  if (d.length <= 3) return d;
  if (d.length <= 7) return `${d.slice(0, 3)}-${d.slice(3)}`;
  return `${d.slice(0, 3)}-${d.slice(3, 7)}-${d.slice(7)}`;
};

const formatBirth = (v: string) => {
  const d = v.replace(/\D/g, '').slice(0, 8);
  if (d.length <= 4) return d;
  if (d.length <= 6) return `${d.slice(0, 4)}-${d.slice(4)}`;
  return `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6)}`;
};

const isValidEmail = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
const isValidPhone = (p: string) => p.replace(/\D/g, '').length >= 10;
const isValidBirth = (b: string) => {
  const d = b.replace(/\D/g, '');
  if (d.length !== 8) return false;
  const y = parseInt(d.slice(0, 4)), m = parseInt(d.slice(4, 6)), dd = parseInt(d.slice(6, 8));
  return y >= 1900 && y <= new Date().getFullYear() && m >= 1 && m <= 12 && dd >= 1 && dd <= 31;
};

export default function RegisterPage() {
  const router = useRouter();
  const { setAuth } = useAuthStore();

  const [form, setForm] = useState({ username: '', email: '', password: '', passwordConfirm: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // 아이디
  const [usernameChecked, setUsernameChecked] = useState(false);
  const [usernameAvailable, setUsernameAvailable] = useState(false);
  const [usernameChecking, setUsernameChecking] = useState(false);
  const usernameValid = /^[a-z0-9_]{4,20}$/.test(form.username);

  // 이메일 상태
  const emailValid = form.email.length > 0 && isValidEmail(form.email);
  const emailInvalid = form.email.length > 0 && !isValidEmail(form.email);

  // 본인인증
  const [identity, setIdentity] = useState<{ name: string; phone: string; birthDate: string; uniqueKey: string } | null>(null);
  const [identityLoading, setIdentityLoading] = useState(false);

  // SMS
  const [smsMode, setSmsMode] = useState(false);
  const [smsName, setSmsName] = useState('');
  const [smsBirth, setSmsBirth] = useState('');
  const [smsPhone, setSmsPhone] = useState('');
  const [smsSent, setSmsSent] = useState(false);
  const [smsCode, setSmsCode] = useState('');
  const [smsVerified, setSmsVerified] = useState(false);
  const [smsSending, setSmsSending] = useState(false);
  const [smsVerifying, setSmsVerifying] = useState(false);
  const [smsTimer, setSmsTimer] = useState(0);

  const smsReady = smsName.length >= 2 && isValidBirth(smsBirth) && isValidPhone(smsPhone);

  // 약관
  const [agreeAll, setAgreeAll] = useState(false);
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [agreePrivacy, setAgreePrivacy] = useState(false);
  const [agreeIdentity, setAgreeIdentity] = useState(false);

  useEffect(() => { if (smsTimer <= 0) return; const t = setTimeout(() => setSmsTimer(v => v - 1), 1000); return () => clearTimeout(t); }, [smsTimer]);
  useEffect(() => { setAgreeAll(agreeTerms && agreePrivacy && agreeIdentity); }, [agreeTerms, agreePrivacy, agreeIdentity]);
  const allAgreed = agreeTerms && agreePrivacy && agreeIdentity;
  const handleAgreeAll = (c: boolean) => { setAgreeAll(c); setAgreeTerms(c); setAgreePrivacy(c); setAgreeIdentity(c); };

  // 아이디 중복확인
  const handleCheckUsername = async () => {
    if (!usernameValid) { setError('아이디는 영문 소문자, 숫자, 밑줄만 가능 (4~20자)'); return; }
    setUsernameChecking(true); setError('');
    try {
      const res = await consumerAuthApi.checkUsername(form.username);
      setUsernameChecked(true);
      setUsernameAvailable(res.data.available);
      if (!res.data.available) setError('이미 사용 중인 아이디입니다.');
    } catch { setError('중복 확인 실패'); }
    finally { setUsernameChecking(false); }
  };

  // PortOne
  const handleIdentityVerify = () => {
    if (!allAgreed) { setError('약관에 모두 동의해주세요.'); return; }
    if (!IMP_CODE || !window.IMP) { setSmsMode(true); return; }
    setIdentityLoading(true); setError('');
    window.IMP.init(IMP_CODE);
    window.IMP.certification({ merchant_uid: `id_${Date.now()}`, popup: true }, async (res: any) => {
      if (!res.success) { setError(res.error_msg || '본인인증 취소'); setIdentityLoading(false); return; }
      try { const r = await consumerAuthApi.verifyIdentity(res.imp_uid); setIdentity(r.data.data); }
      catch (err: any) { setError(err?.response?.data?.error || '본인인증 검증 실패'); }
      finally { setIdentityLoading(false); }
    });
  };

  // SMS
  const handleSmsSend = async () => {
    if (!smsName || smsName.length < 2) { setError('이름을 2자 이상 입력해주세요.'); return; }
    if (!isValidBirth(smsBirth)) { setError('올바른 생년월일을 입력해주세요.'); return; }
    if (!isValidPhone(smsPhone)) { setError('올바른 휴대폰 번호를 입력해주세요.'); return; }
    setSmsSending(true); setError('');
    try { await consumerAuthApi.sendPhoneCode(smsPhone); setSmsSent(true); setSmsTimer(180); }
    catch (err: any) { setError(err?.response?.data?.error || '인증번호 발송 실패'); }
    finally { setSmsSending(false); }
  };

  const handleSmsVerify = async () => {
    if (smsCode.length !== 6) { setError('6자리 인증번호를 입력해주세요.'); return; }
    setSmsVerifying(true); setError('');
    try {
      await consumerAuthApi.verifyPhoneCode(smsPhone, smsCode);
      setSmsVerified(true);
      setIdentity({ name: smsName, phone: smsPhone.replace(/\D/g, ''), birthDate: smsBirth.replace(/\D/g, ''), uniqueKey: '' });
    } catch (err: any) { setError(err?.response?.data?.error || '인증번호 불일치'); }
    finally { setSmsVerifying(false); }
  };

  const pwChecks = useMemo(() => PW_RULES.map(r => ({ ...r, pass: r.test(form.password) })), [form.password]);
  const pwValid = pwChecks.every(c => c.pass);
  const canSubmit = usernameChecked && usernameAvailable && emailValid && pwValid && form.password === form.passwordConfirm;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setError('');
    if (!usernameChecked || !usernameAvailable) { setError('아이디 중복확인을 해주세요.'); return; }
    if (!emailValid) { setError('올바른 이메일을 입력해주세요.'); return; }
    if (!pwValid) { setError('비밀번호 조건을 모두 충족해주세요.'); return; }
    if (form.password !== form.passwordConfirm) { setError('비밀번호가 일치하지 않습니다.'); return; }
    setLoading(true);
    try {
      const res = await consumerAuthApi.register({
        username: form.username, email: form.email, password: form.password,
        name: identity?.name || '', phone: identity?.phone || '', birthDate: identity?.birthDate || '',
        uniqueKey: identity?.uniqueKey || undefined,
      });
      setAuth(res.data.data.accessToken, res.data.data.consumer);
      router.push('/');
    } catch (err: any) { setError(err?.response?.data?.error || '회원가입 실패'); }
    finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen bg-tea-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-6">
          <Link href="/" className="inline-block">
            <h1 className="text-3xl font-bold text-tea-700">teabri</h1>
            <p className="text-tea-600 text-sm mt-1">차 전문 마켓플레이스</p>
          </Link>
        </div>

        <div className="bg-white rounded-2xl shadow-lg p-7">
          <h2 className="text-xl font-bold text-gray-800 mb-5">회원가입</h2>
          {error && <div className="mb-4 p-3 bg-red-50 text-red-600 rounded-lg text-sm">{error}</div>}

          <form onSubmit={handleSubmit} className="space-y-4">

            {/* 아이디 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">아이디 <span className="text-red-500">*</span></label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <input type="text" value={form.username}
                    onChange={e => { const v = e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''); setForm({...form, username: v}); setUsernameChecked(false); setUsernameAvailable(false); }}
                    className={`w-full border rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-tea-500 pr-8 ${
                      usernameChecked ? (usernameAvailable ? 'border-green-300' : 'border-red-300') : 'border-gray-300'}`}
                    placeholder="영문소문자, 숫자, _ (4~20자)" maxLength={20} autoComplete="username" />
                  {usernameChecked && (
                    <span className={`absolute right-3 top-1/2 -translate-y-1/2 text-sm ${usernameAvailable ? 'text-green-500' : 'text-red-500'}`}>
                      {usernameAvailable ? 'V' : 'X'}
                    </span>
                  )}
                </div>
                <button type="button" onClick={handleCheckUsername}
                  disabled={usernameChecking || !usernameValid}
                  className={`shrink-0 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                    usernameChecked && usernameAvailable ? 'bg-green-100 text-green-700 border border-green-200'
                    : 'bg-tea-600 text-white hover:bg-tea-700 disabled:opacity-50'}`}>
                  {usernameChecking ? '...' : usernameChecked && usernameAvailable ? '확인됨' : '중복확인'}
                </button>
              </div>
              {form.username.length > 0 && !usernameValid && <p className="text-xs text-red-500 mt-1">영문 소문자, 숫자, 밑줄만 가능 (4~20자)</p>}
            </div>

            {/* 약관 */}
            <div className="border border-gray-200 rounded-xl p-4 space-y-2">
              <p className="text-sm font-semibold text-gray-800 mb-1">약관 동의</p>
              <label className="flex items-center gap-2.5 cursor-pointer py-1 border-b border-gray-100 pb-2">
                <input type="checkbox" checked={agreeAll} onChange={e => handleAgreeAll(e.target.checked)} className="w-4 h-4 accent-tea-600" />
                <span className="text-sm font-semibold text-gray-800">전체 동의</span>
              </label>
              {[
                { state: agreeTerms, set: setAgreeTerms, label: '[필수] 서비스 이용약관 동의' },
                { state: agreePrivacy, set: setAgreePrivacy, label: '[필수] 개인정보 수집/이용 동의' },
                { state: agreeIdentity, set: setAgreeIdentity, label: '[필수] 본인인증 서비스 이용 동의' },
              ].map(item => (
                <label key={item.label} className="flex items-center gap-2.5 cursor-pointer py-0.5">
                  <input type="checkbox" checked={item.state} onChange={e => item.set(e.target.checked)} className="w-4 h-4 accent-tea-600" />
                  <span className="text-sm text-gray-600">{item.label}</span>
                </label>
              ))}
            </div>

            {/* 본인인증 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">본인인증 <span className="text-red-500">*</span></label>
              {identity ? (
                <div className="bg-green-50 border border-green-200 rounded-xl p-4">
                  <p className="text-green-700 text-sm font-semibold mb-2">본인인증 완료</p>
                  <div className="grid grid-cols-3 gap-2 text-sm text-green-800">
                    <div><span className="text-green-600 text-xs block">이름</span>{identity.name}</div>
                    <div><span className="text-green-600 text-xs block">생년월일</span>{identity.birthDate.replace(/(\d{4})(\d{2})(\d{2})/, '$1.$2.$3')}</div>
                    <div><span className="text-green-600 text-xs block">휴대폰</span>{identity.phone.replace(/(\d{3})(\d{4})(\d{4})/, '$1-****-$3')}</div>
                  </div>
                </div>
              ) : smsMode ? (
                <div className="border border-gray-200 rounded-xl p-4 space-y-3">
                  <p className="text-xs text-gray-500">SMS 인증으로 본인확인</p>
                  <div>
                    <label className="text-xs text-gray-600 block mb-1">이름</label>
                    <input type="text" value={smsName} onChange={e => setSmsName(e.target.value.replace(/[^가-힣a-zA-Z\s]/g, ''))}
                      className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-tea-500 ${smsName.length > 0 && smsName.length < 2 ? 'border-red-300' : 'border-gray-300'}`}
                      placeholder="실명 (한글/영문)" />
                  </div>
                  <div>
                    <label className="text-xs text-gray-600 block mb-1">생년월일</label>
                    <input type="text" value={smsBirth} onChange={e => setSmsBirth(formatBirth(e.target.value))}
                      className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-tea-500 ${smsBirth.length > 0 && !isValidBirth(smsBirth) ? 'border-red-300' : 'border-gray-300'}`}
                      placeholder="YYYY-MM-DD" maxLength={10} />
                  </div>
                  <div>
                    <label className="text-xs text-gray-600 block mb-1">휴대폰 번호</label>
                    <div className="flex gap-2">
                      <input type="tel" value={smsPhone}
                        onChange={e => { setSmsPhone(formatPhone(e.target.value)); setSmsSent(false); setSmsVerified(false); setSmsCode(''); }}
                        disabled={smsVerified}
                        className={`flex-1 border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-tea-500 disabled:bg-gray-50 ${
                          smsPhone.length > 0 && !isValidPhone(smsPhone) ? 'border-red-300' : 'border-gray-300'}`}
                        placeholder="010-0000-0000" maxLength={13} />
                      <button type="button" onClick={handleSmsSend} disabled={smsSending || smsVerified || !smsReady}
                        className={`shrink-0 px-3 py-2 rounded-lg text-sm font-medium ${
                          smsVerified ? 'bg-green-100 text-green-700'
                          : !smsReady ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                          : 'bg-tea-600 text-white hover:bg-tea-700 disabled:opacity-50'}`}>
                        {smsSending ? '발송 중...' : smsVerified ? '완료' : smsSent ? '재발송' : '인증요청'}
                      </button>
                    </div>
                    {smsPhone.length > 0 && !isValidPhone(smsPhone) && <p className="text-xs text-red-500 mt-1">올바른 휴대폰 번호를 입력해주세요</p>}
                    {!smsReady && smsPhone.length > 0 && isValidPhone(smsPhone) && (!smsName || smsName.length < 2 || !isValidBirth(smsBirth)) && (
                      <p className="text-xs text-amber-600 mt-1">이름과 생년월일을 먼저 올바르게 입력해주세요</p>
                    )}
                  </div>
                  {smsSent && !smsVerified && (
                    <div className="flex gap-2">
                      <input type="text" maxLength={6} value={smsCode} onChange={e => setSmsCode(e.target.value.replace(/\D/g, ''))}
                        placeholder="인증번호 6자리" className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm text-center tracking-widest font-mono focus:outline-none focus:ring-2 focus:ring-tea-500" />
                      <button type="button" onClick={handleSmsVerify} disabled={smsVerifying || smsCode.length !== 6}
                        className="shrink-0 px-3 py-2 bg-tea-600 text-white rounded-lg text-sm font-medium hover:bg-tea-700 disabled:opacity-50">
                        {smsVerifying ? '...' : '확인'}</button>
                    </div>)}
                  {smsSent && !smsVerified && smsTimer > 0 && <p className="text-xs text-amber-600">남은 시간: {Math.floor(smsTimer/60)}:{String(smsTimer%60).padStart(2,'0')}</p>}
                </div>
              ) : (
                <button type="button" onClick={handleIdentityVerify} disabled={identityLoading || !allAgreed}
                  className={`w-full py-3 rounded-xl text-sm font-semibold transition-colors flex items-center justify-center gap-2 ${
                    !allAgreed ? 'bg-gray-200 text-gray-400 cursor-not-allowed' : 'bg-blue-600 text-white hover:bg-blue-700'}`}>
                  {identityLoading ? <span className="animate-pulse">인증 진행 중...</span> : '휴대폰 본인인증'}
                </button>
              )}
              {!allAgreed && !identity && !smsMode && <p className="text-xs text-gray-400 mt-1">약관에 모두 동의 후 본인인증이 가능합니다</p>}
            </div>

            {/* 이메일 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">이메일 <span className="text-red-500">*</span></label>
              <div className="relative">
                <input type="email" value={form.email} onChange={e => setForm({...form, email: e.target.value})}
                  className={`w-full border rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-tea-500 pr-8 ${
                    emailValid ? 'border-green-300' : emailInvalid ? 'border-red-300' : 'border-gray-300'}`}
                  placeholder="your@email.com" autoComplete="email" />
                {form.email.length > 0 && (
                  <span className={`absolute right-3 top-1/2 -translate-y-1/2 text-sm ${emailValid ? 'text-green-500' : 'text-red-500'}`}>
                    {emailValid ? 'V' : 'X'}
                  </span>
                )}
              </div>
              {emailInvalid && <p className="text-xs text-red-500 mt-1">올바른 이메일 형식을 입력해주세요</p>}
            </div>

            {/* 비밀번호 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">비밀번호 <span className="text-red-500">*</span></label>
              <input type="password" value={form.password} onChange={e => setForm({...form, password: e.target.value})} maxLength={20}
                className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-tea-500"
                placeholder="영문, 숫자, 특수문자 포함 8~20자" autoComplete="new-password" />
              {form.password && (
                <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1.5">
                  {pwChecks.map(c => (
                    <span key={c.label} className={`text-xs flex items-center gap-1 ${c.pass ? 'text-green-600' : 'text-gray-400'}`}>{c.pass ? 'V' : 'O'} {c.label}</span>
                  ))}
                </div>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">비밀번호 확인 <span className="text-red-500">*</span></label>
              <div className="relative">
                <input type="password" value={form.passwordConfirm} onChange={e => setForm({...form, passwordConfirm: e.target.value})} maxLength={20}
                  className={`w-full border rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-tea-500 pr-8 ${
                    form.passwordConfirm.length > 0 ? (form.password === form.passwordConfirm ? 'border-green-300' : 'border-red-300') : 'border-gray-300'}`}
                  placeholder="비밀번호 재입력" autoComplete="new-password" />
                {form.passwordConfirm.length > 0 && (
                  <span className={`absolute right-3 top-1/2 -translate-y-1/2 text-sm ${form.password === form.passwordConfirm ? 'text-green-500' : 'text-red-500'}`}>
                    {form.password === form.passwordConfirm ? 'V' : 'X'}
                  </span>
                )}
              </div>
            </div>

            <button type="submit" disabled={loading || !canSubmit}
              className="w-full bg-tea-600 text-white rounded-lg py-3 font-medium hover:bg-tea-700 disabled:opacity-50 transition-colors mt-2">
              {loading ? '가입 중...' : '회원가입'}
            </button>
          </form>

          <div className="mt-6 text-center text-sm text-gray-500">
            이미 계정이 있으신가요?{' '}
            <Link href="/auth/login" className="text-tea-600 font-medium hover:underline">로그인</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
