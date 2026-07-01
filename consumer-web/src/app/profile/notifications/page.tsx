'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { consumerAuthApi } from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import NavBar from '@/components/NavBar';
import Link from 'next/link';
import { Bell, CheckCheck, Tag, Store, AlertTriangle } from 'lucide-react';

const TYPE_CONFIG: Record<string, { icon: any; color: string; bg: string }> = {
  store_new_product: { icon: Store, color: 'text-tea-600', bg: 'bg-tea-50' },
  store_discount: { icon: Tag, color: 'text-red-500', bg: 'bg-red-50' },
  product_discount: { icon: Tag, color: 'text-orange-500', bg: 'bg-orange-50' },
  product_low_stock: { icon: AlertTriangle, color: 'text-amber-500', bg: 'bg-amber-50' },
};

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return '방금';
  if (m < 60) return `${m}분 전`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}시간 전`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}일 전`;
  return new Date(dateStr).toLocaleDateString('ko-KR');
}

export default function NotificationsPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { consumer, accessToken } = useAuthStore();

  useEffect(() => {
    if (!consumer) router.replace('/auth/login?redirect=%2Fprofile%2Fnotifications');
  }, [consumer, router]);

  if (!consumer) return null;

  const { data, isLoading } = useQuery({
    queryKey: ['consumer-notifications'],
    queryFn: () => consumerAuthApi.getNotifications(accessToken!).then(r => r.data.data),
    enabled: !!accessToken,
  });

  const readAllMutation = useMutation({
    mutationFn: () => consumerAuthApi.readAllNotifications(accessToken!),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['consumer-notifications'] }),
  });

  const readMutation = useMutation({
    mutationFn: (id: string) => consumerAuthApi.readNotification(id, accessToken!),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['consumer-notifications'] }),
  });

  const notifications: any[] = data?.notifications || [];
  const unreadCount: number = data?.unreadCount || 0;

  const handleClick = (n: any) => {
    if (!n.isRead) readMutation.mutate(n.id);
    if (n.link) router.push(n.link);
  };

  return (
    <div className="min-h-screen bg-tea-50 pb-16">
      <NavBar title="알림" back={true} />

      <div className="max-w-lg mx-auto px-4 py-4">
        {unreadCount > 0 && (
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm text-gray-500">읽지 않은 알림 {unreadCount}개</span>
            <button onClick={() => readAllMutation.mutate()}
              className="text-xs text-tea-600 hover:text-tea-700 font-medium flex items-center gap-1">
              <CheckCheck size={14} /> 모두 읽음
            </button>
          </div>
        )}

        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="bg-white rounded-2xl p-4 animate-pulse">
                <div className="flex gap-3"><div className="w-10 h-10 rounded-full bg-gray-200" /><div className="flex-1 space-y-2"><div className="h-4 bg-gray-200 rounded w-3/4" /><div className="h-3 bg-gray-200 rounded w-1/2" /></div></div>
              </div>
            ))}
          </div>
        ) : notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center">
              <Bell size={28} className="text-gray-300" />
            </div>
            <p className="text-gray-500 font-medium">알림이 없습니다</p>
            <p className="text-gray-400 text-sm text-center">스토어나 상품을 찜하면<br/>소식을 알림으로 받을 수 있어요</p>
            <Link href="/profile/wishlists" className="mt-2 px-5 py-2.5 bg-tea-600 text-white rounded-xl text-sm font-medium hover:bg-tea-700">
              찜 목록 보기
            </Link>
          </div>
        ) : (
          <div className="space-y-2">
            {notifications.map((n: any) => {
              const cfg = TYPE_CONFIG[n.type] || TYPE_CONFIG.store_new_product;
              const Icon = cfg.icon;
              return (
                <button key={n.id} onClick={() => handleClick(n)}
                  className={`w-full text-left rounded-2xl border p-4 flex gap-3 transition-colors ${n.isRead ? 'bg-white border-gray-100' : 'bg-white border-tea-200 shadow-sm'}`}>
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${cfg.bg}`}>
                    <Icon size={18} className={cfg.color} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className={`text-sm font-semibold ${n.isRead ? 'text-gray-600' : 'text-gray-900'}`}>{n.title}</p>
                      {!n.isRead && <span className="w-2 h-2 rounded-full bg-tea-500 shrink-0" />}
                    </div>
                    <p className={`text-sm mt-0.5 ${n.isRead ? 'text-gray-400' : 'text-gray-600'}`}>{n.message}</p>
                    <p className="text-xs text-gray-400 mt-1">{timeAgo(n.createdAt)}</p>
                  </div>
                  {n.imageUrl && (
                    <img src={n.imageUrl.startsWith('/') ? `${process.env.NEXT_PUBLIC_API_URL ?? ''}${n.imageUrl}` : n.imageUrl}
                      alt="" className="w-12 h-12 rounded-lg object-cover shrink-0" />
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
