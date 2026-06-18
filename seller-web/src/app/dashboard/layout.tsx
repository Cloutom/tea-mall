'use client';

import { useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';
import Sidebar from '@/components/layout/Sidebar';
import Header from '@/components/layout/Header';
import { clsx } from 'clsx';

// 스토어가 없어도 접근 가능한 경로
const STORE_SETUP_PATHS = ['/dashboard/store', '/dashboard/shipping'];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { isAuthenticated, _hasHydrated, seller } = useAuthStore();
  const [collapsed, setCollapsed] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!_hasHydrated) return;
    if (!isAuthenticated) {
      router.replace('/auth/login');
      return;
    }
    // 스토어가 없으면 온보딩으로, 단 설정 페이지는 예외
    if (seller && !seller.store) {
      const isAllowed = STORE_SETUP_PATHS.some((p) => pathname?.startsWith(p));
      if (!isAllowed) {
        router.replace('/onboarding');
      }
    }
  }, [isAuthenticated, _hasHydrated, seller, pathname, router]);

  if (!mounted || !_hasHydrated || !isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-cream-50">
        <div className="text-center">
          <p className="text-tea-600 font-medium">로딩 중...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-cream-50">
      <Sidebar collapsed={collapsed} onToggle={() => setCollapsed(!collapsed)} />
      <div className={clsx(
        'transition-all duration-300 ease-in-out',
        collapsed ? 'ml-16' : 'ml-60'
      )}>
        <Header />
        <main className="p-4 sm:p-6 min-h-[calc(100vh-4rem)]">
          {children}
        </main>
      </div>
    </div>
  );
}
