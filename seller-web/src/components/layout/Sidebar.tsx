'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { clsx } from 'clsx';
import {
  LayoutDashboard, Package, ShoppingBag, Store,
  Wallet, Settings, LogOut, ChevronLeft, ChevronRight, Truck, MessageSquare, Bot,
} from 'lucide-react';
import { useState } from 'react';
import { useAuthStore } from '@/store/authStore';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { authApi } from '@/lib/api';
import Image from 'next/image';

const navItems = [
  { href: '/dashboard', icon: LayoutDashboard, label: '대시보드 · 통계', exact: true },
  { href: '/dashboard/products', icon: Package, label: '상품 관리' },
  { href: '/dashboard/orders', icon: ShoppingBag, label: '주문 관리' },
  { href: '/dashboard/shipping', icon: Truck, label: '배송 관리' },
  { href: '/dashboard/store', icon: Store, label: '상점 꾸미기' },
  { href: '/dashboard/reviews', icon: MessageSquare, label: '리뷰 관리' },
  { href: '/dashboard/qna', icon: MessageSquare, label: 'QnA 관리' },
  { href: '/dashboard/chatbot', icon: Bot, label: '챗봇 설정' },
  { href: '/dashboard/settlement', icon: Wallet, label: '정산 관리' },
];

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

export default function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { seller, refreshToken, logout } = useAuthStore();

  const isActive = (href: string, exact?: boolean) => {
    if (exact) return pathname === href;
    return pathname.startsWith(href);
  };

  const handleLogout = async () => {
    try {
      if (refreshToken) await authApi.logout(refreshToken);
    } catch {}
    logout();
    router.push('/auth/login');
    toast.success('로그아웃되었습니다.');
  };

  return (
    <aside
      className={clsx(
        'fixed left-0 top-0 h-screen bg-white border-r border-gray-100 flex flex-col',
        'transition-all duration-300 ease-in-out z-30 shadow-sm',
        collapsed ? 'w-16' : 'w-60'
      )}
    >
      {/* 로고 */}
      <div className="flex items-center h-16 px-4 border-b border-gray-100">
        <Link href="/dashboard" className="flex items-center gap-3 min-w-0">
          <div className="w-8 h-8 bg-tea-600 rounded-lg flex items-center justify-center shrink-0">
            <span className="text-xs font-bold text-white">차</span>
          </div>
          {!collapsed && (
            <span className="font-bold text-gray-900 truncate">teabri</span>
          )}
        </Link>
        <button
          onClick={onToggle}
          className="ml-auto p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition-colors"
        >
          {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>
      </div>

      {/* 판매자 프로필 */}
      {!collapsed && (
        <div className="mx-3 mt-4 p-3 bg-tea-50 rounded-xl">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-tea-200 rounded-full flex items-center justify-center shrink-0">
              {seller?.profileImageUrl ? (
                <Image src={seller.profileImageUrl} alt={seller.name} width={36} height={36} className="rounded-full object-cover" />
              ) : (
                <span className="text-tea-700 font-semibold text-sm">
                  {seller?.name?.[0] || 'S'}
                </span>
              )}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-gray-900 truncate">{seller?.name || '판매자'}</p>
              <p className="text-xs text-gray-500 truncate">{seller?.store?.name || '스토어 미설정'}</p>
            </div>
          </div>
          {seller?.businessVerified ? (
            <div className="mt-2 flex items-center gap-1 text-xs text-green-600">
              <span className="w-1.5 h-1.5 bg-green-500 rounded-full"></span>
              사업자 인증 완료
            </div>
          ) : (
            <Link href="/auth/register" className="mt-2 flex items-center gap-1 text-xs text-amber-600 hover:underline">
              <span className="w-1.5 h-1.5 bg-amber-500 rounded-full"></span>
              사업자 인증 필요
            </Link>
          )}
        </div>
      )}

      {/* 네비게이션 */}
      <nav className="flex-1 px-3 mt-4 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const active = isActive(item.href, item.exact);
          return (
            <Link
              key={item.href}
              href={item.href}
              title={collapsed ? item.label : undefined}
              className={clsx(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 group',
                active
                  ? 'bg-tea-600 text-white shadow-sm'
                  : 'text-gray-600 hover:bg-tea-50 hover:text-tea-700'
              )}
            >
              <item.icon
                size={20}
                className={clsx('shrink-0', active ? 'text-white' : 'text-gray-500 group-hover:text-tea-600')}
              />
              {!collapsed && (
                <span className="text-sm font-medium truncate">{item.label}</span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* 하단 메뉴 */}
      <div className="px-3 pb-4 space-y-1 border-t border-gray-100 pt-3">
        <Link
          href="/dashboard/settings"
          title={collapsed ? '설정' : undefined}
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-gray-600 hover:bg-gray-50 hover:text-gray-900 transition-colors"
        >
          <Settings size={20} className="shrink-0 text-gray-400" />
          {!collapsed && <span className="text-sm font-medium">설정</span>}
        </Link>
        <button
          onClick={handleLogout}
          title={collapsed ? '로그아웃' : undefined}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-gray-600 hover:bg-red-50 hover:text-red-600 transition-colors"
        >
          <LogOut size={20} className="shrink-0 text-gray-400" />
          {!collapsed && <span className="text-sm font-medium">로그아웃</span>}
        </button>
      </div>
    </aside>
  );
}
