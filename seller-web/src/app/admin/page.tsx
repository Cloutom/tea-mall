'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import axios from 'axios';
import Link from 'next/link';
import { Shield, Clock, CheckCircle, XCircle, Package, ShoppingBag, LogOut, Image, Users, Bell, Gift, Settings, Flag, UserCheck } from 'lucide-react';


function useAdminAuth() {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [admin, setAdmin] = useState<any>(null);

  useEffect(() => {
    const t = localStorage.getItem('admin-token');
    const a = localStorage.getItem('admin-info');
    if (!t) { router.replace('/admin/login'); return; }
    setToken(t);
    if (a) setAdmin(JSON.parse(a));
  }, [router]);

  const logout = () => {
    localStorage.removeItem('admin-token');
    localStorage.removeItem('admin-info');
    router.replace('/admin/login');
  };

  return { token, admin, logout };
}

export default function AdminDashboard() {
  const { token, admin, logout } = useAdminAuth();
  const [stats, setStats] = useState<any>(null);
  const [pendingSellers, setPendingSellers] = useState<any[]>([]);

  useEffect(() => {
    if (!token) return;
    const headers = { Authorization: `Bearer ${token}` };
    const handleErr = (e: any) => { if (e.response?.status === 401) { localStorage.removeItem('admin-token'); window.location.href = '/admin/login'; } };
    axios.get(`/api/admin/stats`, { headers }).then((r) => setStats(r.data.data)).catch(handleErr);
    axios.get(`/api/admin/sellers?status=PENDING&limit=5`, { headers }).then((r) => setPendingSellers(r.data.data || [])).catch(handleErr);
  }, [token]);

  const handleApprove = async (id: string) => {
    if (!token) return;
    await axios.patch(`/api/admin/sellers/${id}/approve`, {}, { headers: { Authorization: `Bearer ${token}` } });
    setPendingSellers((prev) => prev.filter((s) => s.id !== id));
    if (stats) setStats({ ...stats, pendingSellers: stats.pendingSellers - 1, approvedSellers: stats.approvedSellers + 1 });
  };

  const handleReject = async (id: string) => {
    const reason = prompt('거절 사유를 입력하세요:');
    if (reason === null) return;
    if (!token) return;
    await axios.patch(`/api/admin/sellers/${id}/reject`, { reason }, { headers: { Authorization: `Bearer ${token}` } });
    setPendingSellers((prev) => prev.filter((s) => s.id !== id));
    if (stats) setStats({ ...stats, pendingSellers: stats.pendingSellers - 1, rejectedSellers: stats.rejectedSellers + 1 });
  };

  if (!token) return null;

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <header className="bg-gray-800 border-b border-gray-700 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Shield size={22} className="text-amber-400" />
          <span className="font-bold text-lg">teabri Admin</span>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <Link href="/admin/sellers" className="text-sm text-gray-300 hover:text-white flex items-center gap-1"><Users size={14} /> 판매자</Link>
          <Link href="/admin/consumers" className="text-sm text-gray-300 hover:text-white flex items-center gap-1"><UserCheck size={14} /> 소비자</Link>
          <Link href="/admin/reports" className="text-sm text-gray-300 hover:text-white flex items-center gap-1"><Flag size={14} /> 신고/문의</Link>
          <Link href="/admin/notices" className="text-sm text-gray-300 hover:text-white flex items-center gap-1"><Bell size={14} /> 공지</Link>
          <Link href="/admin/main-content" className="text-sm text-gray-300 hover:text-white flex items-center gap-1"><Image size={14} /> 메인 관리</Link>
          <Link href="/admin/settings" className="text-sm text-gray-300 hover:text-white flex items-center gap-1"><Settings size={14} /> 설정</Link>
          <span className="text-sm text-gray-400 ml-1">{admin?.name}</span>
          <button onClick={logout} className="text-gray-400 hover:text-red-400"><LogOut size={18} /></button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8 space-y-8">
        {/* 통계 */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: '승인 대기', value: stats?.pendingSellers ?? '-', icon: Clock, color: 'text-amber-400 bg-amber-900/30' },
            { label: '승인된 판매자', value: stats?.approvedSellers ?? '-', icon: CheckCircle, color: 'text-green-400 bg-green-900/30' },
            { label: '전체 주문', value: stats?.totalOrders ?? '-', icon: ShoppingBag, color: 'text-blue-400 bg-blue-900/30' },
            { label: '전체 상품', value: stats?.totalProducts ?? '-', icon: Package, color: 'text-purple-400 bg-purple-900/30' },
          ].map(({ label, value, icon: Icon, color }) => (
            <div key={label} className="bg-gray-800 rounded-xl p-4 border border-gray-700">
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center mb-3 ${color}`}>
                <Icon size={20} />
              </div>
              <p className="text-2xl font-bold">{value}</p>
              <p className="text-sm text-gray-400">{label}</p>
            </div>
          ))}
        </div>

        {/* 퀵 링크 */}
        <div className="grid grid-cols-2 gap-4">
          <Link href="/admin/main-content" className="bg-gray-800 rounded-xl border border-gray-700 p-5 hover:border-amber-500/50 transition-colors group">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-amber-900/30 text-amber-400"><Image size={20} /></div>
              <h3 className="font-semibold group-hover:text-amber-400 transition-colors">메인 배너 관리</h3>
            </div>
            <p className="text-sm text-gray-400">소비자 메인 페이지의 배너와 팝업을 관리합니다</p>
          </Link>
          <Link href="/admin/sellers" className="bg-gray-800 rounded-xl border border-gray-700 p-5 hover:border-green-500/50 transition-colors group">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-green-900/30 text-green-400"><Users size={20} /></div>
              <h3 className="font-semibold group-hover:text-green-400 transition-colors">판매자 관리</h3>
            </div>
            <p className="text-sm text-gray-400">판매자 승인, 거절, 취소를 관리합니다</p>
          </Link>
          <Link href="/admin/consumers" className="bg-gray-800 rounded-xl border border-gray-700 p-5 hover:border-cyan-500/50 transition-colors group">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-cyan-900/30 text-cyan-400"><UserCheck size={20} /></div>
              <h3 className="font-semibold group-hover:text-cyan-400 transition-colors">소비자 관리</h3>
            </div>
            <p className="text-sm text-gray-400">소비자 계정 조회 (개인정보 마스킹)</p>
          </Link>
          <Link href="/admin/reports" className="bg-gray-800 rounded-xl border border-gray-700 p-5 hover:border-red-500/50 transition-colors group">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-red-900/30 text-red-400"><Flag size={20} /></div>
              <h3 className="font-semibold group-hover:text-red-400 transition-colors">신고 / 문의</h3>
            </div>
            <p className="text-sm text-gray-400">신고 처리 및 1:1 문의 답변</p>
          </Link>
          <Link href="/admin/notices" className="bg-gray-800 rounded-xl border border-gray-700 p-5 hover:border-blue-500/50 transition-colors group">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-blue-900/30 text-blue-400"><Bell size={20} /></div>
              <h3 className="font-semibold group-hover:text-blue-400 transition-colors">공지사항 관리</h3>
            </div>
            <p className="text-sm text-gray-400">소비자에게 보이는 공지사항을 관리합니다</p>
          </Link>
          <Link href="/admin/settings" className="bg-gray-800 rounded-xl border border-gray-700 p-5 hover:border-purple-500/50 transition-colors group">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-purple-900/30 text-purple-400"><Settings size={20} /></div>
              <h3 className="font-semibold group-hover:text-purple-400 transition-colors">관리자 설정</h3>
            </div>
            <p className="text-sm text-gray-400">포인트·리뷰 적립, 수수료, 알림 번호 등 설정</p>
          </Link>
        </div>

        {/* 승인 대기 판매자 */}
        <div className="bg-gray-800 rounded-xl border border-gray-700 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-lg flex items-center gap-2">
              <Clock size={18} className="text-amber-400" /> 승인 대기 판매자
            </h2>
            <Link href="/admin/sellers?status=PENDING" className="text-sm text-amber-400 hover:underline">전체 보기</Link>
          </div>

          {pendingSellers.length === 0 ? (
            <p className="text-gray-500 text-sm text-center py-8">승인 대기 중인 판매자가 없습니다</p>
          ) : (
            <div className="space-y-3">
              {pendingSellers.map((seller) => (
                <div key={seller.id} className="flex items-center justify-between bg-gray-700/50 rounded-xl p-4">
                  <div>
                    <p className="font-medium">{seller.name} <span className="text-gray-400 text-sm">({seller.email})</span></p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {seller.businessName || '사업자 미등록'} · {new Date(seller.createdAt).toLocaleDateString('ko-KR')} 가입
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => handleApprove(seller.id)}
                      className="px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white text-xs font-bold rounded-lg flex items-center gap-1">
                      <CheckCircle size={14} /> 승인
                    </button>
                    <button onClick={() => handleReject(seller.id)}
                      className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-lg flex items-center gap-1">
                      <XCircle size={14} /> 거절
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
