'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import axios from 'axios';
import Link from 'next/link';
import {
  Shield, Users, CheckCircle, XCircle, Clock, ArrowLeft, Search,
  ChevronDown, ChevronUp, Store, Phone, Mail, Building2, MapPin,
  ShieldCheck, ShieldX, Image as ImageIcon, Package, ShoppingBag, Calendar,
} from 'lucide-react';
import { Suspense } from 'react';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? '';
const imgUrl = (p?: string | null) => p ? (p.startsWith('/') ? `${API_URL}${p}` : p) : null;

const STATUS_MAP: Record<string, { label: string; color: string; bg: string }> = {
  PENDING: { label: '승인 대기', color: 'text-amber-300', bg: 'bg-amber-900/40 border-amber-700' },
  APPROVED: { label: '승인됨', color: 'text-green-300', bg: 'bg-green-900/40 border-green-700' },
  REJECTED: { label: '거절됨', color: 'text-red-300', bg: 'bg-red-900/40 border-red-700' },
  WITHDRAW_REQUESTED: { label: '폐업 신청', color: 'text-orange-300', bg: 'bg-orange-900/40 border-orange-700' },
  CLOSED: { label: '폐업', color: 'text-gray-400', bg: 'bg-gray-700 border-gray-600' },
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
  const [reloadKey, setReloadKey] = useState(0);
  const [expandedId, setExpandedId] = useState<string | null>(null);

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

    axios.get(`/api/admin/sellers?${params}`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => { setSellers(r.data.data || []); setTotal(r.data.pagination?.total || 0); })
      .catch((e: any) => { if (e.response?.status === 401) { localStorage.removeItem('admin-token'); router.replace('/admin/login'); } });
  }, [token, status, search, page, reloadKey]);

  const handlePublish = async (storeId: string, publish: boolean) => {
    if (!token) return;
    await axios.patch(`/api/admin/stores/${storeId}/publish`, { publish }, { headers: { Authorization: `Bearer ${token}` } });
    setSellers((prev) => prev.map((s) => s.store?.id === storeId ? { ...s, store: { ...s.store, isPublished: publish } } : s));
  };

  const handleAction = async (id: string, action: 'approve' | 'reject' | 'suspend') => {
    if (!token) return;
    const headers = { Authorization: `Bearer ${token}` };
    if (action === 'reject') {
      const reason = prompt('거절 사유:');
      if (reason === null) return;
      await axios.patch(`/api/admin/sellers/${id}/reject`, { reason }, { headers });
    } else if (action === 'suspend') {
      const reason = prompt('승인 취소 사유:');
      if (reason === null) return;
      await axios.patch(`/api/admin/sellers/${id}/suspend`, { reason }, { headers });
    } else {
      await axios.patch(`/api/admin/sellers/${id}/approve`, {}, { headers });
    }
    const newStatus = action === 'approve' ? 'APPROVED' : 'REJECTED';
    setSellers((prev) => prev.map((s) =>
      s.id === id ? { ...s, status: newStatus, rejectionReason: action !== 'approve' ? '상태 변경됨' : null } : s
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
        <Link href="/admin/main-content" className="text-sm text-gray-300 hover:text-white flex items-center gap-1">
          <ImageIcon size={14} /> 메인 관리
        </Link>
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
            {['', 'PENDING', 'APPROVED', 'REJECTED', 'WITHDRAW_REQUESTED', 'CLOSED'].map((s) => (
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
        <div className="space-y-3">
          {sellers.length === 0 ? (
            <div className="bg-gray-800 rounded-xl border border-gray-700 p-12 text-center">
              <Users size={32} className="text-gray-600 mx-auto mb-2" />
              <p className="text-gray-500 text-sm">판매자가 없습니다</p>
            </div>
          ) : sellers.map((seller) => {
            const expanded = expandedId === seller.id;
            const st = STATUS_MAP[seller.status] || STATUS_MAP.PENDING;
            return (
              <div key={seller.id} className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
                {/* 요약 행 */}
                <div
                  className="flex items-center justify-between px-5 py-4 cursor-pointer hover:bg-gray-700/30 transition-colors"
                  onClick={() => setExpandedId(expanded ? null : seller.id)}
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    {/* 스토어 로고 */}
                    <div className="w-10 h-10 rounded-lg overflow-hidden bg-gray-700 shrink-0 flex items-center justify-center">
                      {seller.store?.logoUrl ? (
                        <img src={imgUrl(seller.store.logoUrl)!} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <Store size={16} className="text-gray-500" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold">{seller.name}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-bold border ${st.bg} ${st.color}`}>
                          {st.label}
                        </span>
                        {seller.businessVerified && (
                          <span className="text-xs text-blue-400 flex items-center gap-0.5"><ShieldCheck size={12} /> 사업자인증</span>
                        )}
                      </div>
                      <p className="text-sm text-gray-400 truncate">
                        {seller.email} {seller.store ? `· ${seller.store.name}` : ''}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 ml-4">
                    {/* 액션 버튼 */}
                    {seller.status === 'PENDING' && (
                      <>
                        <button onClick={(e) => { e.stopPropagation(); handleAction(seller.id, 'approve'); }}
                          className="px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white text-xs font-bold rounded-lg flex items-center gap-1">
                          <CheckCircle size={14} /> 승인
                        </button>
                        <button onClick={(e) => { e.stopPropagation(); handleAction(seller.id, 'reject'); }}
                          className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-lg flex items-center gap-1">
                          <XCircle size={14} /> 거절
                        </button>
                      </>
                    )}
                    {seller.status === 'APPROVED' && (
                      <button onClick={(e) => { e.stopPropagation(); handleAction(seller.id, 'suspend'); }}
                        className="px-3 py-1.5 bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold rounded-lg flex items-center gap-1">
                        <XCircle size={14} /> 승인취소
                      </button>
                    )}
                    {seller.status === 'REJECTED' && (
                      <button onClick={(e) => { e.stopPropagation(); handleAction(seller.id, 'approve'); }}
                        className="px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white text-xs font-bold rounded-lg flex items-center gap-1">
                        <CheckCircle size={14} /> 재승인
                      </button>
                    )}
                    {seller.status === 'WITHDRAW_REQUESTED' && (
                      <>
                        <button onClick={async (e) => {
                          e.stopPropagation();
                          if (!confirm(`${seller.name}의 폐업 신청을 승인하시겠습니까?\n사유: ${seller.withdrawReason || '없음'}\n\n승인 시 스토어가 비공개 처리됩니다.`)) return;
                          try {
                            await axios.patch(`/api/admin/sellers/${seller.id}/approve-withdraw`, {}, { headers: { Authorization: `Bearer ${token}` } });
                            setReloadKey(k => k + 1);
                          } catch { alert('처리 실패'); }
                        }}
                          className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-lg flex items-center gap-1">
                          <CheckCircle size={14} /> 폐업 승인
                        </button>
                        <button onClick={async (e) => {
                          e.stopPropagation();
                          if (!confirm('폐업 신청을 반려하시겠습니까?')) return;
                          try {
                            await axios.patch(`/api/admin/sellers/${seller.id}/reject-withdraw`, {}, { headers: { Authorization: `Bearer ${token}` } });
                            setReloadKey(k => k + 1);
                          } catch { alert('처리 실패'); }
                        }}
                          className="px-3 py-1.5 bg-gray-600 hover:bg-gray-700 text-white text-xs font-bold rounded-lg flex items-center gap-1">
                          <XCircle size={14} /> 반려
                        </button>
                      </>
                    )}
                    {expanded ? <ChevronUp size={18} className="text-gray-400" /> : <ChevronDown size={18} className="text-gray-400" />}
                  </div>
                </div>

                {/* 상세 정보 */}
                {expanded && (
                  <div className="border-t border-gray-700 px-5 py-4 bg-gray-800/50">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* 계정 정보 */}
                      <div className="space-y-2">
                        <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider">계정 정보</h4>
                        <div className="space-y-1.5 text-sm">
                          <p className="flex items-center gap-2 text-gray-300">
                            <Mail size={14} className="text-gray-500 shrink-0" /> {seller.email}
                          </p>
                          <p className="flex items-center gap-2 text-gray-300">
                            <Phone size={14} className="text-gray-500 shrink-0" /> {seller.phone || '미등록'}
                          </p>
                          <p className="flex items-center gap-2 text-gray-300">
                            <Calendar size={14} className="text-gray-500 shrink-0" />
                            가입: {new Date(seller.createdAt).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' })}
                          </p>
                          {seller.lastLoginAt && (
                            <p className="flex items-center gap-2 text-gray-400 text-xs">
                              <Clock size={12} className="text-gray-500 shrink-0" />
                              최근 로그인: {new Date(seller.lastLoginAt).toLocaleString('ko-KR')}
                            </p>
                          )}
                          {seller.approvedAt && (
                            <p className="flex items-center gap-2 text-green-400 text-xs">
                              <CheckCircle size={12} className="shrink-0" />
                              승인일: {new Date(seller.approvedAt).toLocaleDateString('ko-KR')}
                            </p>
                          )}
                          {seller.rejectionReason && (
                            <p className="flex items-start gap-2 text-red-400 text-xs">
                              <XCircle size={12} className="shrink-0 mt-0.5" />
                              거절사유: {seller.rejectionReason}
                            </p>
                          )}
                        </div>
                      </div>

                      {/* 사업자 정보 */}
                      <div className="space-y-2">
                        <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider">사업자 정보</h4>
                        {seller.businessNumber ? (
                          <div className="space-y-1.5 text-sm">
                            <p className="flex items-center gap-2 text-gray-300">
                              <Building2 size={14} className="text-gray-500 shrink-0" />
                              {seller.businessName || '상호 미입력'}
                              {seller.businessVerified ? (
                                <span className="text-xs bg-blue-900/40 text-blue-400 px-1.5 py-0.5 rounded border border-blue-700"><ShieldCheck size={10} className="inline" /> 인증완료</span>
                              ) : (
                                <span className="text-xs bg-gray-700 text-gray-400 px-1.5 py-0.5 rounded"><ShieldX size={10} className="inline" /> 미인증</span>
                              )}
                            </p>
                            <p className="text-gray-400 text-xs ml-6">사업자번호: {seller.businessNumber}</p>
                            {seller.businessOwner && <p className="text-gray-400 text-xs ml-6">대표자: {seller.businessOwner}</p>}
                            {seller.businessAddress && (
                              <p className="flex items-start gap-2 text-gray-400 text-xs">
                                <MapPin size={12} className="text-gray-500 shrink-0 mt-0.5" /> {seller.businessAddress}
                              </p>
                            )}
                            {seller.businessType && <p className="text-gray-400 text-xs ml-6">업태: {seller.businessType} {seller.businessCategory ? `/ ${seller.businessCategory}` : ''}</p>}
                          </div>
                        ) : (
                          <p className="text-gray-500 text-sm">사업자 정보 미등록</p>
                        )}
                      </div>

                      {/* 제출 서류 */}
                      {(seller.businessLicenseUrl || seller.salesPermitUrl || seller.bankCopyUrl) && (
                        <div className="space-y-2">
                          <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider">제출 서류</h4>
                          <div className="space-y-1.5 text-xs">
                            {seller.businessLicenseUrl && (
                              <a href={imgUrl(seller.businessLicenseUrl)!} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-blue-400 hover:underline">사업자등록증 보기</a>
                            )}
                            {seller.salesPermitUrl && (
                              <a href={imgUrl(seller.salesPermitUrl)!} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-blue-400 hover:underline">통신판매업신고증 보기</a>
                            )}
                            {seller.bankCopyUrl && (
                              <a href={imgUrl(seller.bankCopyUrl)!} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-blue-400 hover:underline">통장사본 보기</a>
                            )}
                          </div>
                        </div>
                      )}

                      {/* 계좌 정보 */}
                      {seller.bankName && (
                        <div className="space-y-2">
                          <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider">정산 계좌</h4>
                          <div className="text-xs text-gray-300 space-y-1">
                            <p>{seller.bankName} {seller.bankAccountNo}</p>
                            <p>예금주: {seller.bankAccountHolder}</p>
                          </div>
                        </div>
                      )}

                      {/* 스토어 정보 */}
                      {seller.store && (
                        <div className="space-y-2 md:col-span-2">
                          <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider">스토어 정보</h4>
                          <div className="flex items-center gap-3 bg-gray-700/30 rounded-xl p-3">
                            <div className="w-12 h-12 rounded-lg overflow-hidden bg-gray-700 shrink-0 flex items-center justify-center">
                              {seller.store.logoUrl ? (
                                <img src={imgUrl(seller.store.logoUrl)!} alt="" className="w-full h-full object-cover" />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center" style={{ backgroundColor: seller.store.themeColor || '#2D6A4F' }}>
                                  <span className="text-white text-sm font-bold">{seller.store.name?.[0]}</span>
                                </div>
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-semibold">{seller.store.name}</p>
                              {seller.store.description && <p className="text-xs text-gray-400 truncate">{seller.store.description}</p>}
                              <div className="flex items-center gap-3 mt-1 text-xs text-gray-400">
                                <span className="flex items-center gap-1"><Package size={11} /> 상품 {seller.store._count?.products || 0}개</span>
                                <span className="flex items-center gap-1"><ShoppingBag size={11} /> 주문 {seller.store._count?.orders || 0}건</span>
                                <span className={seller.store.isOpen ? 'text-green-400' : 'text-gray-500'}>
                                  {seller.store.isOpen ? '영업 중' : '영업 종료'}
                                </span>
                                <span className={seller.store.isPublished ? 'text-blue-400' : 'text-amber-400'}>
                                  {seller.store.isPublished ? '게시됨' : '미게시'}
                                </span>
                              </div>
                            </div>
                            {seller.status === 'APPROVED' && (
                              <button onClick={(e) => { e.stopPropagation(); handlePublish(seller.store.id, !seller.store.isPublished); }}
                                className={`shrink-0 px-3 py-1.5 text-xs font-bold rounded-lg ${
                                  seller.store.isPublished ? 'bg-amber-600 hover:bg-amber-700 text-white' : 'bg-blue-600 hover:bg-blue-700 text-white'}`}>
                                {seller.store.isPublished ? '게시 해제' : '게시 승인'}
                              </button>
                            )}
                          </div>
                          {/* 개별 수수료 */}
                          {seller.status === 'APPROVED' && (
                            <div className="mt-3 p-3 bg-gray-700/30 rounded-lg space-y-1.5">
                              <p className="text-[10px] font-bold text-gray-400">개별 수수료 (비워두면 전체 기본값)</p>
                              <div className="flex gap-2">
                                <div className="flex-1">
                                  <label className="text-[9px] text-gray-500">플랫폼 (%)</label>
                                  <input type="number" step="0.1" min="0" max="50"
                                    defaultValue={seller.store?.customPlatformFee ?? ''}
                                    placeholder="기본값"
                                    onBlur={(e) => { const v = e.target.value ? parseFloat(e.target.value) : null; axios.patch(`/api/admin/stores/${seller.store.id}/fees`, { customPlatformFee: v }, { headers: { Authorization: `Bearer ${token}` } }).catch(() => {}); }}
                                    className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1 text-xs" />
                                </div>
                                <div className="flex-1">
                                  <label className="text-[9px] text-gray-500">결제 (%)</label>
                                  <input type="number" step="0.1" min="0" max="50"
                                    defaultValue={seller.store?.customPaymentFee ?? ''}
                                    placeholder="기본값"
                                    onBlur={(e) => { const v = e.target.value ? parseFloat(e.target.value) : null; axios.patch(`/api/admin/stores/${seller.store.id}/fees`, { customPaymentFee: v }, { headers: { Authorization: `Bearer ${token}` } }).catch(() => {}); }}
                                    className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1 text-xs" />
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* 페이지네이션 */}
        {total > 20 && (
          <div className="flex justify-center gap-2 pt-4">
            {Array.from({ length: Math.ceil(total / 20) }, (_, i) => (
              <button key={i} onClick={() => setPage(i + 1)}
                className={`w-8 h-8 rounded-lg text-sm ${page === i + 1 ? 'bg-amber-500 text-gray-900 font-bold' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}>
                {i + 1}
              </button>
            ))}
          </div>
        )}
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
