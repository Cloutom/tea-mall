'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import axios from 'axios';
import Link from 'next/link';
import { Shield, Users, CheckCircle, XCircle, Clock, ArrowLeft, Search } from 'lucide-react';
import { Suspense } from 'react';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? '';

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  PENDING: { label: '대기', color: 'bg-amber-100 text-amber-800' },
  APPROVED: { label: '승인', color: 'bg-green-100 text-green-800' },
  REJECTED: { label: '거절', color: 'bg-red-100 text-red-800' },
};

function SellersContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [token, setToken] = useState<string | null>(null);
  const [sellers, setSellers] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [status, setStatus] = useState(searchParams.get('status') || '');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  useEffect(() => {
    const t = localStorage.getItem('admin-token');
    if (!t) { router.replace('/admin/login'); return; }
    setToken(t);
  }, [router]);

  useEffect(() => {
    if (!token) return;
    const params = new URLSearchParams();
    if (status) params.set('status', status);
    if (search) params.set('search', search);
    params.set('page', String(page));
    params.set('limit', '20');

    axios.get(`${API_URL}/api/admin/sellers?${params}`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => { setSellers(r.data.data || []); setTotal(r.data.pagination?.total || 0); })
      .catch(() => {});
  }, [token, status, search, page]);

  const handleAction = async (id: string, action: 'approve' | 'reject') => {
    if (!token) return;
    const headers = { Authorization: `Bearer ${token}` };
    if (action === 'reject') {
      const reason = prompt('거절 사유:');
      if (reason === null) return;
      await axios.patch(`${API_URL}/api/admin/sellers/${id}/reject`, { reason }, { headers });
    } else {
      await axios.patch(`${API_URL}/api/admin/sellers/${id}/approve`, {}, { headers });
    }
    setSellers((prev) => prev.map((s) =>
      s.id === id ? { ...s, status: action === 'approve' ? 'APPROVED' : 'REJECTED' } : s
    ));
  };

  if (!token) return null;

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <header className="bg-gray-800 border-b border-gray-700 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/admin" className="text-gray-400 hover:text-white"><ArrowLeft size={20} /></Link>
          <Shield size={22} className="text-amber-400" />
          <span className="font-bold text-lg">판매자 관리</span>
          <span className="text-sm text-gray-400 ml-2">총 {total}명</span>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-6 space-y-4">
        {/* 필터 */}
        <div className="flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              placeholder="이름, 이메일, 사업자명 검색"
              className="w-full pl-10 pr-4 py-2.5 bg-gray-800 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
          </div>
          <div className="flex gap-1">
            {['', 'PENDING', 'APPROVED', 'REJECTED'].map((s) => (
              <button
                key={s}
                onClick={() => { setStatus(s); setPage(1); }}
                className={`px-3 py-2 text-sm rounded-lg transition-colors ${
                  status === s ? 'bg-amber-500 text-gray-900 font-bold' : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                }`}
              >
                {s === '' ? '전체' : STATUS_MAP[s]?.label}
              </button>
            ))}
          </div>
        </div>

        {/* 판매자 목록 */}
        <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
          {sellers.length === 0 ? (
            <p className="text-gray-500 text-sm text-center py-12">판매자가 없습니다</p>
          ) : (
            <div className="divide-y divide-gray-700">
              {sellers.map((seller) => (
                <div key={seller.id} className="flex items-center justify-between px-5 py-4 hover:bg-gray-700/30">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{seller.name}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${STATUS_MAP[seller.status]?.color}`}>
                        {STATUS_MAP[seller.status]?.label}
                      </span>
                      {seller.store && (
                        <span className="text-xs text-gray-400 bg-gray-700 px-2 py-0.5 rounded-full">{seller.store.name}</span>
                      )}
                    </div>
                    <p className="text-sm text-gray-400 mt-0.5">{seller.email} · {seller.businessName || '사업자 미등록'}</p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      가입: {new Date(seller.createdAt).toLocaleDateString('ko-KR')}
                      {seller.approvedAt && ` · 승인: ${new Date(seller.approvedAt).toLocaleDateString('ko-KR')}`}
                      {seller.rejectionReason && ` · 거절사유: ${seller.rejectionReason}`}
                    </p>
                  </div>
                  {seller.status === 'PENDING' && (
                    <div className="flex gap-2 ml-4">
                      <button onClick={() => handleAction(seller.id, 'approve')}
                        className="px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white text-xs font-bold rounded-lg flex items-center gap-1">
                        <CheckCircle size={14} /> 승인
                      </button>
                      <button onClick={() => handleAction(seller.id, 'reject')}
                        className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-lg flex items-center gap-1">
                        <XCircle size={14} /> 거절
                      </button>
                    </div>
                  )}
                  {seller.status === 'REJECTED' && (
                    <button onClick={() => handleAction(seller.id, 'approve')}
                      className="px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white text-xs font-bold rounded-lg flex items-center gap-1 ml-4">
                      <CheckCircle size={14} /> 재승인
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

export default function AdminSellersPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gray-900 flex items-center justify-center text-white">로딩 중...</div>}>
      <SellersContent />
    </Suspense>
  );
}
