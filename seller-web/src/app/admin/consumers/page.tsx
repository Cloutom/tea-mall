'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import axios from 'axios';
import Link from 'next/link';
import { Shield, ArrowLeft, Users, Search, ChevronRight, Eye, EyeOff, Lock, ShoppingBag, Star, MapPin, Gift, X } from 'lucide-react';

const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  PENDING: { label: '대기', cls: 'bg-amber-900/40 text-amber-400' },
  CONFIRMED: { label: '확인', cls: 'bg-blue-900/40 text-blue-400' },
  PREPARING: { label: '준비중', cls: 'bg-purple-900/40 text-purple-400' },
  SHIPPING: { label: '배송중', cls: 'bg-indigo-900/40 text-indigo-400' },
  DELIVERED: { label: '배송완료', cls: 'bg-green-900/40 text-green-400' },
  PURCHASE_CONFIRMED: { label: '구매확정', cls: 'bg-tea-900/40 text-tea-400' },
  CANCELLED: { label: '취소', cls: 'bg-red-900/40 text-red-400' },
  REFUND_REQ: { label: '환불요청', cls: 'bg-orange-900/40 text-orange-400' },
  REFUNDED: { label: '환불완료', cls: 'bg-gray-700 text-gray-400' },
};

export default function AdminConsumersPage() {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [consumers, setConsumers] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<any>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [showUnmask, setShowUnmask] = useState(false);
  const [adminPw, setAdminPw] = useState('');
  const [unmasked, setUnmasked] = useState<any>(null);
  const [unmaskError, setUnmaskError] = useState('');
  const [unmaskLoading, setUnmaskLoading] = useState(false);
  const [detailTab, setDetailTab] = useState<'orders' | 'reviews' | 'addresses' | 'points'>('orders');
  const headers = token ? { Authorization: `Bearer ${token}` } : {};

  useEffect(() => { const t = localStorage.getItem('admin-token'); if (!t) { router.replace('/admin/login'); return; } setToken(t); }, [router]);

  useEffect(() => {
    if (!token) return;
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    params.set('page', String(page)); params.set('limit', '20');
    axios.get(`/api/admin/consumers?${params}`, { headers }).then(r => {
      setConsumers(r.data.data || []); setTotal(r.data.pagination?.total || 0);
    }).catch(() => {});
  }, [token, search, page]);

  const openDetail = async (id: string) => {
    setSelectedId(id); setDetail(null); setUnmasked(null); setShowUnmask(false); setDetailTab('orders'); setDetailLoading(true);
    try {
      const r = await axios.get(`/api/admin/consumers/${id}`, { headers });
      setDetail(r.data.data);
    } catch { alert('소비자 정보를 불러올 수 없습니다.'); }
    setDetailLoading(false);
  };

  const handleUnmask = async () => {
    setUnmaskError(''); setUnmaskLoading(true);
    try {
      const r = await axios.post(`/api/admin/consumers/${selectedId}/unmask`, { password: adminPw }, { headers });
      setUnmasked(r.data.data);
      setShowUnmask(false); setAdminPw('');
    } catch (e: any) {
      setUnmaskError(e.response?.data?.error || '인증 실패');
    }
    setUnmaskLoading(false);
  };

  const displayName = unmasked?.name || detail?.name || '';
  const displayEmail = unmasked?.email || detail?.email || '';
  const displayPhone = unmasked?.phone || detail?.phone || '';

  if (!token) return null;

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <header className="bg-gray-800 border-b border-gray-700 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/admin" className="text-gray-400 hover:text-white"><ArrowLeft size={20} /></Link>
          <Shield size={22} className="text-amber-400" />
          <span className="font-bold text-lg">소비자 관리</span>
          <span className="text-sm text-gray-400">총 {total}명</span>
        </div>
      </header>

      <div className="flex h-[calc(100vh-65px)]">
        {/* 좌측: 소비자 목록 */}
        <div className={`${selectedId ? 'w-80 border-r border-gray-700' : 'flex-1 max-w-5xl mx-auto'} flex flex-col`}>
          <div className="p-4">
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
                placeholder="이름, 이메일, 전화번호 검색"
                className="w-full pl-10 pr-4 py-2.5 bg-gray-800 border border-gray-700 rounded-xl text-white placeholder-gray-500 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500" />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto">
            {consumers.length === 0 ? (
              <p className="text-center py-12 text-gray-500">소비자가 없습니다</p>
            ) : (
              <div className="divide-y divide-gray-700/50">
                {consumers.map((c: any) => (
                  <button key={c.id} onClick={() => openDetail(c.id)}
                    className={`w-full text-left px-4 py-3 hover:bg-gray-800/50 transition-colors ${selectedId === c.id ? 'bg-gray-800 border-l-2 border-amber-400' : ''}`}>
                    <div className="flex items-center justify-between">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm truncate">{c.name}</span>
                          {!c.isActive && <span className="text-[10px] bg-red-900/40 text-red-400 px-1 rounded">비활성</span>}
                        </div>
                        <p className="text-xs text-gray-500 truncate mt-0.5">{c.email}</p>
                      </div>
                      <ChevronRight size={14} className="text-gray-600 shrink-0" />
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
          {total > 20 && (
            <div className="p-3 border-t border-gray-700 flex items-center justify-center gap-2">
              <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="px-3 py-1 text-xs bg-gray-800 rounded-lg disabled:opacity-30">이전</button>
              <span className="text-xs text-gray-400">{page} / {Math.ceil(total / 20)}</span>
              <button disabled={page >= Math.ceil(total / 20)} onClick={() => setPage(p => p + 1)} className="px-3 py-1 text-xs bg-gray-800 rounded-lg disabled:opacity-30">다음</button>
            </div>
          )}
        </div>

        {/* 우측: 소비자 상세 */}
        {selectedId && (
          <div className="flex-1 overflow-y-auto">
            {detailLoading ? (
              <div className="flex items-center justify-center h-full"><div className="animate-spin w-8 h-8 border-2 border-amber-400 border-t-transparent rounded-full" /></div>
            ) : detail ? (
              <div className="p-6 space-y-5">
                {/* 프로필 헤더 */}
                <div className="bg-gray-800 rounded-xl border border-gray-700 p-5">
                  <div className="flex items-start justify-between">
                    <div>
                      <h2 className="text-lg font-bold">{displayName}</h2>
                      <p className="text-sm text-gray-400 mt-0.5">{displayEmail}</p>
                      <p className="text-sm text-gray-400">{displayPhone || '번호 없음'}</p>
                      {unmasked?.birthDate && <p className="text-sm text-gray-400">생년월일: {unmasked.birthDate}</p>}
                    </div>
                    <div className="flex items-center gap-2">
                      {!unmasked ? (
                        <button onClick={() => { setShowUnmask(true); setUnmaskError(''); setAdminPw(''); }}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-xs font-medium rounded-lg transition-colors">
                          <Eye size={13} /> 개인정보 보기
                        </button>
                      ) : (
                        <span className="flex items-center gap-1 text-xs text-green-400"><Eye size={13} /> 열람 중</span>
                      )}
                      <button onClick={() => { setSelectedId(null); setDetail(null); setUnmasked(null); }}
                        className="p-1.5 text-gray-500 hover:text-white"><X size={16} /></button>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 mt-3 text-xs text-gray-500">
                    <span>가입: {new Date(detail.createdAt).toLocaleDateString('ko-KR')}</span>
                    {detail.lastLoginAt && <span>마지막 로그인: {new Date(detail.lastLoginAt).toLocaleDateString('ko-KR')}</span>}
                    {detail.emailVerified && <span className="text-green-500">이메일 인증됨</span>}
                    {detail.teaProfile && <span className="bg-tea-900/40 text-tea-400 px-1.5 py-0.5 rounded">{detail.teaProfile}</span>}
                  </div>

                  {/* 요약 카드 */}
                  <div className="grid grid-cols-4 gap-3 mt-4">
                    <div className="bg-gray-700/50 rounded-lg p-3 text-center">
                      <p className="text-lg font-bold text-amber-400">{detail.orders?.length || 0}</p>
                      <p className="text-[10px] text-gray-400">총 주문</p>
                    </div>
                    <div className="bg-gray-700/50 rounded-lg p-3 text-center">
                      <p className="text-lg font-bold text-green-400">{(detail.orders || []).reduce((s: number, o: any) => s + (o.status === 'PURCHASE_CONFIRMED' ? o.finalAmount : 0), 0).toLocaleString()}원</p>
                      <p className="text-[10px] text-gray-400">총 구매액</p>
                    </div>
                    <div className="bg-gray-700/50 rounded-lg p-3 text-center">
                      <p className="text-lg font-bold text-blue-400">{detail.reviews?.length || 0}</p>
                      <p className="text-[10px] text-gray-400">리뷰</p>
                    </div>
                    <div className="bg-gray-700/50 rounded-lg p-3 text-center">
                      <p className="text-lg font-bold text-purple-400">{detail.points?.reduce((s: number, p: any) => s + p.amount, 0) || 0}</p>
                      <p className="text-[10px] text-gray-400">포인트</p>
                    </div>
                  </div>
                </div>

                {/* 비밀번호 인증 모달 */}
                {showUnmask && (
                  <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center px-4" onClick={() => setShowUnmask(false)}>
                    <div className="bg-gray-800 rounded-2xl border border-gray-700 p-6 w-full max-w-sm space-y-4" onClick={e => e.stopPropagation()}>
                      <div className="flex items-center gap-2">
                        <Lock size={18} className="text-amber-400" />
                        <h3 className="font-bold text-white">개인정보 열람 인증</h3>
                      </div>
                      <p className="text-xs text-gray-400">개인정보 보호를 위해 관리자 비밀번호를 입력해주세요.</p>
                      <input type="password" value={adminPw} onChange={e => setAdminPw(e.target.value)}
                        placeholder="관리자 비밀번호" autoFocus
                        onKeyDown={e => e.key === 'Enter' && handleUnmask()}
                        className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-amber-500" />
                      {unmaskError && <p className="text-red-400 text-xs">{unmaskError}</p>}
                      <div className="flex gap-2">
                        <button onClick={() => setShowUnmask(false)} className="flex-1 py-2.5 text-sm bg-gray-700 rounded-xl hover:bg-gray-600">취소</button>
                        <button onClick={handleUnmask} disabled={unmaskLoading || !adminPw}
                          className="flex-1 py-2.5 text-sm bg-amber-600 rounded-xl hover:bg-amber-500 font-medium disabled:opacity-50">
                          {unmaskLoading ? '확인 중...' : '확인'}
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* 탭 */}
                <div className="flex gap-2">
                  {([
                    { key: 'orders', label: '주문 내역', icon: ShoppingBag, count: detail.orders?.length },
                    { key: 'reviews', label: '리뷰', icon: Star, count: detail.reviews?.length },
                    { key: 'addresses', label: '배송지', icon: MapPin, count: detail.addresses?.length },
                    { key: 'points', label: '포인트', icon: Gift, count: detail.points?.length },
                  ] as const).map(t => (
                    <button key={t.key} onClick={() => setDetailTab(t.key)}
                      className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${detailTab === t.key ? 'bg-amber-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}>
                      <t.icon size={13} /> {t.label} ({t.count || 0})
                    </button>
                  ))}
                </div>

                {/* 주문 내역 */}
                {detailTab === 'orders' && (
                  <div className="space-y-2">
                    {(detail.orders || []).length === 0 ? <p className="text-center py-8 text-gray-500 text-sm">주문 내역이 없습니다</p> :
                    (detail.orders || []).map((o: any) => (
                      <div key={o.id} className="bg-gray-800 rounded-xl border border-gray-700 p-4">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-mono font-medium">{o.orderNumber}</span>
                            <span className={`text-[10px] px-1.5 py-0.5 rounded ${STATUS_BADGE[o.status]?.cls || 'bg-gray-700 text-gray-400'}`}>
                              {STATUS_BADGE[o.status]?.label || o.status}
                            </span>
                          </div>
                          <span className="text-xs text-gray-500">{new Date(o.createdAt).toLocaleDateString('ko-KR')}</span>
                        </div>
                        <div className="space-y-1">
                          {o.items?.map((item: any, i: number) => (
                            <div key={i} className="flex items-center justify-between text-xs">
                              <span className="text-gray-300">{item.productName} x{item.quantity}</span>
                              <span className="text-gray-400">{item.totalPrice?.toLocaleString()}원</span>
                            </div>
                          ))}
                        </div>
                        <div className="flex items-center justify-between mt-2 pt-2 border-t border-gray-700">
                          <span className="text-xs text-gray-500">{o.store?.name}</span>
                          <span className="text-sm font-bold text-amber-400">{o.finalAmount?.toLocaleString()}원</span>
                        </div>
                        {o.trackingNumber && <p className="text-xs text-gray-500 mt-1">운송장: {o.courier} {o.trackingNumber}</p>}
                        <div className="flex items-center gap-2 mt-2 pt-2 border-t border-gray-700/50">
                          <select value={o.status} onChange={async (e) => {
                            const newStatus = e.target.value;
                            if (!confirm(`주문 상태를 "${STATUS_BADGE[newStatus]?.label || newStatus}"(으)로 변경하시겠습니까?`)) return;
                            try {
                              await axios.patch(`/api/admin/orders/${o.id}/status`, { status: newStatus }, { headers });
                              openDetail(selectedId!);
                            } catch { alert('상태 변경 실패'); }
                          }}
                            className="bg-gray-700 border border-gray-600 rounded-lg px-2 py-1.5 text-xs text-white flex-1">
                            {Object.entries(STATUS_BADGE).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                          </select>
                          {!['CANCELLED', 'REFUNDED'].includes(o.status) && (
                            <button onClick={async () => {
                              if (!confirm(`${o.orderNumber} 주문을 환불 처리하시겠습니까?\n환불 금액: ${o.finalAmount?.toLocaleString()}원`)) return;
                              try {
                                await axios.patch(`/api/admin/orders/${o.id}/status`, { status: 'REFUNDED' }, { headers });
                                openDetail(selectedId!);
                              } catch { alert('환불 처리 실패'); }
                            }}
                              className="px-2.5 py-1.5 text-[10px] font-medium bg-red-900/40 text-red-400 border border-red-700 rounded-lg hover:bg-red-900/60 shrink-0">
                              환불
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* 리뷰 */}
                {detailTab === 'reviews' && (
                  <div className="space-y-2">
                    {(detail.reviews || []).length === 0 ? <p className="text-center py-8 text-gray-500 text-sm">리뷰가 없습니다</p> :
                    (detail.reviews || []).map((r: any) => (
                      <div key={r.id} className="bg-gray-800 rounded-xl border border-gray-700 p-4">
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium">{r.product?.name}</span>
                            <span className="text-yellow-400 text-xs">{'★'.repeat(r.rating)}{'☆'.repeat(5 - r.rating)}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-gray-500">{new Date(r.createdAt).toLocaleDateString('ko-KR')}</span>
                            <button onClick={async () => {
                              if (!confirm('이 리뷰를 삭제(숨김) 처리하시겠습니까?')) return;
                              try {
                                await axios.delete(`/api/admin/reviews/${r.id}`, { headers });
                                openDetail(selectedId!);
                              } catch { alert('리뷰 삭제 실패'); }
                            }}
                              className="px-2 py-1 text-[10px] font-medium bg-red-900/40 text-red-400 border border-red-700 rounded-lg hover:bg-red-900/60">
                              삭제
                            </button>
                          </div>
                        </div>
                        {r.content && <p className="text-sm text-gray-300">{r.content}</p>}
                      </div>
                    ))}
                  </div>
                )}

                {/* 배송지 */}
                {detailTab === 'addresses' && (
                  <div className="space-y-2">
                    {(detail.addresses || []).length === 0 ? <p className="text-center py-8 text-gray-500 text-sm">배송지가 없습니다</p> :
                    (detail.addresses || []).map((a: any) => {
                      const ua = unmasked?.addresses?.find((x: any) => x.id === a.id);
                      return (
                        <div key={a.id} className="bg-gray-800 rounded-xl border border-gray-700 p-4">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-sm font-medium">{ua?.recipientName || a.recipientName}</span>
                            <span className="text-xs text-gray-500">{a.label}</span>
                            {a.isDefault && <span className="text-[10px] bg-amber-900/40 text-amber-400 px-1.5 py-0.5 rounded">기본</span>}
                          </div>
                          <p className="text-xs text-gray-400">{ua?.recipientPhone || a.recipientPhone}</p>
                          <p className="text-xs text-gray-400">[{a.zipCode}] {ua?.address || a.address} {ua?.addressDetail || a.addressDetail}</p>
                        </div>
                      );
                    })}
                    {!unmasked && <p className="text-xs text-gray-500 text-center">상세 주소는 "개인정보 보기" 인증 후 확인 가능합니다</p>}
                  </div>
                )}

                {/* 포인트 */}
                {detailTab === 'points' && (
                  <div className="space-y-2">
                    {(detail.points || []).length === 0 ? <p className="text-center py-8 text-gray-500 text-sm">포인트 내역이 없습니다</p> :
                    (detail.points || []).map((p: any) => (
                      <div key={p.id} className="bg-gray-800 rounded-xl border border-gray-700 px-4 py-3 flex items-center justify-between">
                        <div>
                          <p className="text-sm text-gray-300">{p.reason}</p>
                          <p className="text-xs text-gray-500">{new Date(p.createdAt).toLocaleDateString('ko-KR')}</p>
                        </div>
                        <span className={`text-sm font-bold ${p.amount > 0 ? 'text-green-400' : 'text-red-400'}`}>
                          {p.amount > 0 ? '+' : ''}{p.amount.toLocaleString()}P
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}
