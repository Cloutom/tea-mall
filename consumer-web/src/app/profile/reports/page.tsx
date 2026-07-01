'use client';

import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { consumerAuthApi } from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import NavBar from '@/components/NavBar';
import { Flag, Clock, CheckCircle, XCircle } from 'lucide-react';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? '';
const imgUrl = (p?: string | null) => p ? (p.startsWith('/') ? `${API_URL}${p}` : p) : null;

const STATUS: Record<string, { label: string; icon: any; cls: string }> = {
  PENDING: { label: '처리 대기', icon: Clock, cls: 'text-amber-500 bg-amber-50' },
  RESOLVED: { label: '처리 완료', icon: CheckCircle, cls: 'text-green-600 bg-green-50' },
  REJECTED: { label: '반려', icon: XCircle, cls: 'text-gray-500 bg-gray-100' },
};

export default function MyReportsPage() {
  const router = useRouter();
  const { accessToken } = useAuthStore();

  const { data: reports, isLoading } = useQuery({
    queryKey: ['my-reports', accessToken],
    queryFn: () => consumerAuthApi.getMyReports(accessToken!).then(r => r.data.data),
    enabled: !!accessToken,
  });

  if (!accessToken) { router.replace('/auth/login'); return null; }

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <NavBar title="내 신고 내역" back="/profile" />
      <div className="max-w-2xl mx-auto px-4 py-5 space-y-3">
        {isLoading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="bg-white rounded-2xl p-4 animate-pulse">
              <div className="h-4 bg-gray-100 rounded w-1/2 mb-2" />
              <div className="h-3 bg-gray-100 rounded w-1/3" />
            </div>
          ))
        ) : !reports?.length ? (
          <div className="text-center py-16">
            <Flag size={40} className="mx-auto text-gray-200 mb-3" />
            <p className="text-sm text-gray-400">신고 내역이 없습니다</p>
          </div>
        ) : (
          reports.map((r: any) => {
            const s = STATUS[r.status] || STATUS.PENDING;
            const Icon = s.icon;
            return (
              <div key={r.id} className="bg-white rounded-2xl border border-gray-100 p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">{r.type === 'PRODUCT' ? '상품' : r.type}</span>
                    <span className="text-sm font-semibold text-gray-800">{r.reason}</span>
                  </div>
                  <span className={`flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${s.cls}`}>
                    <Icon size={12} /> {s.label}
                  </span>
                </div>

                {r.targetName && (
                  <div className="flex items-center gap-2 bg-gray-50 rounded-xl p-2.5">
                    {r.targetThumbnail && (
                      <img src={imgUrl(r.targetThumbnail)!} alt="" className="w-10 h-10 rounded-lg object-cover shrink-0" />
                    )}
                    <p className="text-sm text-gray-700 truncate">{r.targetName}</p>
                  </div>
                )}

                {r.detail && <p className="text-sm text-gray-500">{r.detail}</p>}

                {r.adminNote && (
                  <div className="bg-tea-50 rounded-xl p-3 border-l-3 border-tea-400">
                    <p className="text-xs font-semibold text-tea-700 mb-0.5">관리자 처리 결과</p>
                    <p className="text-sm text-gray-700">{r.adminNote}</p>
                  </div>
                )}

                <p className="text-xs text-gray-400">{new Date(r.createdAt).toLocaleDateString('ko-KR')}</p>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
