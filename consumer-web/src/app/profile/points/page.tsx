'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { consumerAuthApi } from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import NavBar from '@/components/NavBar';
import { Gift } from 'lucide-react';

export default function PointsPage() {
  const router = useRouter();
  const { consumer, accessToken } = useAuthStore();
  useEffect(() => { if (!consumer) router.replace('/auth/login'); }, [consumer, router]);
  if (!consumer) return null;

  const { data, isLoading } = useQuery({
    queryKey: ['my-points'], queryFn: () => consumerAuthApi.getPoints(accessToken!).then(r => r.data.data), enabled: !!accessToken,
  });

  const balance = data?.balance || 0;
  const histories: any[] = data?.histories || [];

  return (
    <div className="min-h-screen bg-gray-50 pb-16">
      <NavBar title="포인트" back={true} />
      <div className="max-w-lg mx-auto px-4 py-6 space-y-4">
        <div className="bg-tea-600 text-white rounded-2xl p-6 text-center">
          <p className="text-sm text-tea-200 mb-1">보유 포인트</p>
          <p className="text-3xl font-bold">{balance.toLocaleString()}<span className="text-lg ml-1">P</span></p>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          <h3 className="text-sm font-semibold text-gray-800 p-4 pb-2">포인트 내역</h3>
          {isLoading ? (
            <div className="p-8 text-center text-gray-400 text-sm">로딩 중...</div>
          ) : histories.length === 0 ? (
            <div className="p-8 text-center">
              <Gift size={28} className="text-gray-200 mx-auto mb-2" />
              <p className="text-gray-400 text-sm">포인트 내역이 없습니다</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {histories.map((h: any) => (
                <div key={h.id} className="flex items-center justify-between px-4 py-3">
                  <div>
                    <p className="text-sm text-gray-800">{h.reason}</p>
                    <p className="text-xs text-gray-400">{new Date(h.createdAt).toLocaleDateString('ko-KR')}</p>
                  </div>
                  <span className={`text-sm font-bold ${h.amount > 0 ? 'text-tea-600' : 'text-red-500'}`}>
                    {h.amount > 0 ? '+' : ''}{h.amount.toLocaleString()}P
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
