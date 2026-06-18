'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';

export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { isAuthenticated, _hasHydrated, seller } = useAuthStore();
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (!mounted || !_hasHydrated) return;
    if (!isAuthenticated) { router.replace('/auth/login'); return; }
    // 이미 스토어가 있으면 대시보드로
    if (seller?.store) { router.replace('/dashboard'); }
  }, [mounted, _hasHydrated, isAuthenticated, seller, router]);

  if (!mounted || !_hasHydrated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-cream-50">
        <div className="text-center"><p className="text-tea-600 font-medium">로딩 중...</p></div>
      </div>
    );
  }

  return <>{children}</>;
}
