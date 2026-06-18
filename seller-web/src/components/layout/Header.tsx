'use client';

import { useState } from 'react';
import { Bell, Search, ExternalLink } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { analyticsApi } from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import { Notification } from '@/types';
import { formatDistanceToNow } from 'date-fns';
import { ko } from 'date-fns/locale';
import Link from 'next/link';
import { clsx } from 'clsx';

export default function Header() {
  const { seller } = useAuthStore();
  const [showNotifications, setShowNotifications] = useState(false);
  const queryClient = useQueryClient();

  const { data: notifData } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => analyticsApi.getNotifications().then((r) => r.data.data),
    refetchInterval: 60000,
  });

  const markReadMutation = useMutation({
    mutationFn: () => analyticsApi.markNotificationsRead(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  });

  const handleBellClick = () => {
    setShowNotifications(!showNotifications);
    if (!showNotifications && (notifData?.unreadCount || 0) > 0) {
      markReadMutation.mutate();
    }
  };

  return (
    <header className="h-16 bg-white border-b border-gray-100 flex items-center px-6 gap-4 sticky top-0 z-20">
      {/* 페이지 타이틀 (breadcrumb 영역) */}
      <div className="flex-1" />

      {/* 내 스토어 바로가기 */}
      {seller?.store && (
        <Link
          href={seller.store.slug
            ? `${process.env.NEXT_PUBLIC_CLIENT_URL || 'http://localhost:3000'}/store/${seller.store.slug}`
            : '/store-preview'}
          target="_blank"
          className="hidden sm:flex items-center gap-1.5 text-sm text-gray-600 hover:text-tea-600 transition-colors px-3 py-1.5 rounded-lg hover:bg-tea-50"
        >
          <ExternalLink size={14} />
          내 스토어 보기
        </Link>
      )}

      {/* 알림 */}
      <div className="relative">
        <button
          onClick={handleBellClick}
          className="relative p-2 rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition-colors"
        >
          <Bell size={20} />
          {(notifData?.unreadCount || 0) > 0 && (
            <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 text-white text-xs rounded-full flex items-center justify-center font-bold">
              {notifData!.unreadCount > 9 ? '9+' : notifData!.unreadCount}
            </span>
          )}
        </button>

        {/* 알림 드롭다운 */}
        {showNotifications && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setShowNotifications(false)} />
            <div className="absolute right-0 top-12 w-80 bg-white rounded-xl shadow-xl border border-gray-100 z-20 overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                <span className="font-semibold text-gray-900 text-sm">알림</span>
                {(notifData?.unreadCount || 0) > 0 && (
                  <span className="text-xs text-tea-600 bg-tea-50 px-2 py-0.5 rounded-full">
                    {notifData!.unreadCount}개의 새 알림
                  </span>
                )}
              </div>
              <div className="max-h-80 overflow-y-auto">
                {notifData?.notifications?.length ? (
                  notifData.notifications.map((notif: Notification) => (
                    <div
                      key={notif.id}
                      className={clsx(
                        'px-4 py-3 border-b border-gray-50 hover:bg-gray-50 cursor-pointer transition-colors',
                        !notif.isRead && 'bg-tea-50/50'
                      )}
                    >
                      <div className="flex items-start gap-2">
                        <div className={clsx(
                          'w-2 h-2 rounded-full mt-1.5 shrink-0',
                          notif.type === 'order' ? 'bg-blue-500' :
                          notif.type === 'review' ? 'bg-amber-500' : 'bg-tea-500'
                        )} />
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-gray-900">{notif.title}</p>
                          <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{notif.message}</p>
                          <p className="text-xs text-gray-400 mt-1">
                            {formatDistanceToNow(new Date(notif.createdAt), { addSuffix: true, locale: ko })}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="px-4 py-8 text-center text-gray-400 text-sm">알림이 없습니다</div>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </header>
  );
}
