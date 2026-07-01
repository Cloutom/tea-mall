'use client';

import { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { consumerAuthApi } from '@/lib/api';
import { useAuthStore } from '@/store/authStore';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? '';

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = searchParams.get('redirect') || '/';
  const socialError = searchParams.get('error');
  const { setAuth } = useAuthStore();

  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState(socialError === 'social_failed' ? '소셜 로그인에 실패했습니다. 다시 시도해주세요.' : '');
  const [loading, setLoading] = useState(false);
  const [showReactivate, setShowReactivate] = useState(false);
  const [reactivating, setReactivating] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.email || !form.password) { setError('이메일과 비밀번호를 입력해주세요.'); return; }
    setLoading(true);
    setError('');
    setShowReactivate(false);
    try {
      const res = await consumerAuthApi.login({ email: form.email, password: form.password });
      const { accessToken, consumer } = res.data.data;
      setAuth(accessToken, consumer);
      router.push(decodeURIComponent(redirect));
    } catch (err: any) {
      const data = err?.response?.data;
      if (data?.canReactivate) {
        setShowReactivate(true);
        setError(`탈퇴 신청된 계정입니다. ${new Date(data.withdrawScheduledAt).toLocaleDateString('ko-KR')}까지 복구 가능합니다.`);
      } else {
        setError(data?.error || '로그인에 실패했습니다.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleReactivate = async () => {
    setReactivating(true);
    try {
      await consumerAuthApi.reactivateAccount({ email: form.email, password: form.password });
      setError('');
      setShowReactivate(false);
      const res = await consumerAuthApi.login({ email: form.email, password: form.password });
      setAuth(res.data.data.accessToken, res.data.data.consumer);
      router.push('/');
    } catch (err: any) {
      setError(err?.response?.data?.error || '복구 실패');
    } finally { setReactivating(false); }
  };

  const handleSocialLogin = (provider: 'kakao' | 'google' | 'naver') => {
    window.location.href = `${API_URL}/api/consumer/auth/social/${provider}`;
  };

  return (
    <div className="min-h-screen bg-tea-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link href="/" className="inline-block">
            <h1 className="text-3xl font-bold text-tea-700">teabri</h1>
            <p className="text-tea-600 text-sm mt-1">차 전문 마켓플레이스</p>
          </Link>
        </div>

        <div className="bg-white rounded-2xl shadow-lg p-8">
          <h2 className="text-xl font-bold text-gray-800 mb-6">로그인</h2>

          {error && (
            <div className="mb-4 p-3 bg-red-50 text-red-600 rounded-lg text-sm">
              {error}
              {showReactivate && (
                <button onClick={handleReactivate} disabled={reactivating}
                  className="mt-2 w-full py-2 bg-tea-600 text-white rounded-lg text-sm font-medium hover:bg-tea-700 disabled:opacity-50">
                  {reactivating ? '복구 중...' : '계정 복구하기'}
                </button>
              )}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">이메일</label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-tea-500"
                placeholder="your@email.com"
                autoComplete="email"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">비밀번호</label>
              <input
                type="password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-tea-500"
                placeholder="비밀번호 입력"
                autoComplete="current-password"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-tea-600 text-white rounded-lg py-3 font-medium hover:bg-tea-700 disabled:opacity-50 transition-colors">
              {loading ? '로그인 중...' : '로그인'}
            </button>
          </form>

          {/* 소셜 로그인 */}
          <div className="mt-5">
            <div className="relative flex items-center gap-3 mb-4">
              <div className="flex-1 h-px bg-gray-200" />
              <span className="text-xs text-gray-400 shrink-0">간편 로그인</span>
              <div className="flex-1 h-px bg-gray-200" />
            </div>
            <div className="grid grid-cols-3 gap-2">
              <button
                onClick={() => handleSocialLogin('kakao')}
                className="flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-colors"
                style={{ background: '#FEE500', color: '#000' }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 3C6.477 3 2 6.477 2 10.8c0 2.742 1.555 5.157 3.938 6.643-.14.49-.896 3.155-.926 3.35 0 0-.016.137.073.19.09.052.193.012.193.012.25-.035 2.905-1.912 3.387-2.235.76.1 1.548.155 2.335.155C17.523 19 22 15.522 22 10.8S17.523 3 12 3z" />
                </svg>
                카카오
              </button>
              <button
                onClick={() => handleSocialLogin('naver')}
                className="flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium text-white transition-colors"
                style={{ background: '#03C75A' }}
              >
                <span className="font-bold text-base leading-none">N</span>
                네이버
              </button>
              <button
                onClick={() => handleSocialLogin('google')}
                className="flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium text-gray-700 border border-gray-200 hover:bg-gray-50 transition-colors bg-white"
              >
                <svg width="16" height="16" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                </svg>
                구글
              </button>
            </div>
          </div>

          <div className="mt-6 text-center text-sm text-gray-500">
            아직 회원이 아니신가요?{' '}
            <Link href="/auth/register" className="text-tea-600 font-medium hover:underline">
              회원가입
            </Link>
          </div>
          <div className="mt-3 text-center">
            <Link href="/" className="text-xs text-gray-400 hover:text-gray-600">
              비회원으로 계속하기
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-tea-50" />}>
      <LoginContent />
    </Suspense>
  );
}
