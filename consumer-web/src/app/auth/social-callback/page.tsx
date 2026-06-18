'use client';

import { useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';

function SocialCallbackContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { setAuth } = useAuthStore();

  useEffect(() => {
    const token = searchParams.get('token');
    const name = searchParams.get('name');
    const email = searchParams.get('email');
    const id = searchParams.get('id');
    const error = searchParams.get('error');

    if (error || !token) {
      router.replace('/auth/login?error=social_failed');
      return;
    }

    if (token && name && email && id) {
      setAuth(token, { id, name: decodeURIComponent(name), email: decodeURIComponent(email), phone: undefined });
      router.replace('/');
    }
  }, [searchParams, setAuth, router]);

  return (
    <div className="min-h-screen bg-tea-50 flex items-center justify-center">
      <div className="text-center">
        <div className="w-10 h-10 border-4 border-tea-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        <p className="text-gray-600 text-sm">로그인 처리 중...</p>
      </div>
    </div>
  );
}

export default function SocialCallbackPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-tea-50 flex items-center justify-center"><div className="w-10 h-10 border-4 border-tea-600 border-t-transparent rounded-full animate-spin" /></div>}>
      <SocialCallbackContent />
    </Suspense>
  );
}
