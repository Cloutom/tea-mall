'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { ShoppingCart, Package, User, LogOut, ArrowLeft } from 'lucide-react';
import { useCartStore } from '@/store/cartStore';
import { useAuthStore } from '@/store/authStore';
import { consumerAuthApi } from '@/lib/api';

interface NavBarProps {
  /** 뒤로가기 버튼 표시. true면 router.back(), string이면 해당 경로로 이동 */
  back?: boolean | string;
  /** 중앙 타이틀 */
  title?: string;
  /** 카트 아이콘 색상 (스토어 테마) */
  themeColor?: string;
}

export default function NavBar({ back, title, themeColor = '#2D6A4F' }: NavBarProps) {
  const router = useRouter();
  const totalItems = useCartStore((s) => s.totalItems);
  const { consumer, accessToken, clearAuth } = useAuthStore();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const handleBack = () => {
    if (typeof back === 'string') router.push(back);
    else router.back();
  };

  const handleLogout = async () => {
    try { if (accessToken) await consumerAuthApi.logout(accessToken); } catch {}
    clearAuth();
  };

  return (
    <header className="sticky top-0 z-30 bg-white border-b border-gray-100 shadow-sm">
      <div className="max-w-5xl mx-auto px-4 h-14 flex items-center gap-2">
        {/* 뒤로가기 */}
        {back && (
          <button onClick={handleBack} className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 shrink-0">
            <ArrowLeft size={20} />
          </button>
        )}

        {/* 로고 */}
        <Link href="/" className="flex items-center gap-1.5 shrink-0 group">
          <span className="font-bold text-gray-900 text-sm group-hover:text-tea-700 transition-colors">teabri</span>
        </Link>

        {/* 구분선 + 타이틀 */}
        {title && (
          <>
            <span className="text-gray-300 text-lg font-light shrink-0">/</span>
            <span className="text-sm font-semibold text-gray-700 truncate">{title}</span>
          </>
        )}

        <div className="flex-1" />

        {/* 우측 아이콘들 */}
        <nav className="flex items-center gap-0.5">
          <Link href="/orders" className="p-2 text-gray-500 hover:text-gray-700 rounded-lg hover:bg-gray-50" title="주문조회">
            <Package size={20} />
          </Link>

          {mounted && (
            consumer ? (
              <>
                <Link href="/profile" className="p-2 text-gray-500 hover:text-tea-700 rounded-lg hover:bg-gray-50" title={`${consumer.name}님`}>
                  <User size={20} />
                </Link>
                <button onClick={handleLogout} className="p-2 text-gray-400 hover:text-red-500 rounded-lg hover:bg-gray-50" title="로그아웃">
                  <LogOut size={18} />
                </button>
              </>
            ) : (
              <Link href="/auth/login" className="px-3 py-1.5 text-xs font-medium bg-tea-600 text-white rounded-full hover:bg-tea-700 transition-colors ml-1">
                로그인
              </Link>
            )
          )}

          <Link href="/cart" className="relative p-2 ml-1 rounded-lg hover:bg-gray-50">
            <ShoppingCart size={22} className="text-gray-700" />
            {mounted && totalItems() > 0 && (
              <span className="absolute -top-0.5 -right-0.5 w-5 h-5 text-white text-[10px] rounded-full flex items-center justify-center font-bold"
                style={{ backgroundColor: themeColor }}>
                {totalItems() > 9 ? '9+' : totalItems()}
              </span>
            )}
          </Link>
        </nav>
      </div>
    </header>
  );
}