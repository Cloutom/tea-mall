'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import axios from 'axios';
import Link from 'next/link';
import { Shield, ArrowLeft, CheckCircle, XCircle, Trash2, Send, ExternalLinkIcon } from 'lucide-react';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? '';
const imgUrl = (p?: string | null) => p ? (p.startsWith('/') ? `${API_URL}${p}` : p) : null;

const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  PENDING: { label: '대기', cls: 'bg-amber-900/40 text-amber-400' },
  RESOLVED: { label: '처리완료', cls: 'bg-green-900/40 text-green-400' },
  REJECTED: { label: '반려', cls: 'bg-gray-700 text-gray-400' },
};

export default function AdminReportsPage() {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [reports, setReports] = useState<any[]>([]);
  const [inquiries, setInquiries] = useState<any[]>([]);
  const [tab, setTab] = useState<'reports' | 'inquiries'>('reports');
  const [filter, setFilter] = useState<string>('');
  const [actionId, setActionId] = useState<string | null>(null);
  const [adminNote, setAdminNote] = useState('');
  const headers = token ? { Authorization: `Bearer ${token}` } : {};

  useEffect(() => { const t = localStorage.getItem('admin-token'); if (!t) { router.replace('/admin/login'); return; } setToken(t); }, [router]);

  const fetchData = () => {
    if (!token) return;
    const q = filter ? `?status=${filter}` : '';
    axios.get(`/api/admin/reports${q}`, { headers }).then(r => setReports(r.data.data || [])).catch(() => {});
    axios.get(`/api/admin/inquiries`, { headers }).then(r => setInquiries(r.data.data || [])).catch(() => {});
  };
  useEffect(() => { fetchData(); }, [token, filter]);

  const handleResolve = async (id: string, status: string) => {
    if (!adminNote.trim() && status === 'RESOLVED') {
      alert('처리 내용을 입력해주세요.'); return;
    }
    await axios.patch(`/api/admin/reports/${id}`, { status, adminNote: adminNote.trim() }, { headers });
    setActionId(null);
    setAdminNote('');
    fetchData();
  };

  const handleDeleteProduct = async (productId: string) => {
    if (!confirm('해당 상품을 비활성화(삭제) 처리하시겠습니까?')) return;
    await axios.delete(`/api/admin/reports/product/${productId}`, { headers });
    alert('상품이 비활성화되었습니다.');
    fetchData();
  };

  const handleAnswer = async (id: string) => {
    const answer = prompt('답변을 입력해주세요:');
    if (!answer) return;
    await axios.patch(`/api/admin/inquiries/${id}/answer`, { answer }, { headers });
    fetchData();
  };

  if (!token) return null;

  const pendingCount = reports.filter(r => r.status === 'PENDING').length;

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <header className="bg-gray-800 border-b border-gray-700 px-6 py-4 flex items-center gap-3">
        <Link href="/admin" className="text-gray-400 hover:text-white"><ArrowLeft size={20} /></Link>
        <Shield size={22} className="text-amber-400" />
        <span className="font-bold text-lg">신고 / 문의 관리</span>
      </header>
      <main className="max-w-4xl mx-auto px-6 py-6 space-y-4">
        <div className="flex gap-2">
          <button onClick={() => setTab('reports')} className={`px-4 py-2 rounded-lg text-sm font-medium ${tab === 'reports' ? 'bg-amber-600 text-white' : 'bg-gray-800 text-gray-400'}`}>
            신고 {pendingCount > 0 && <span className="ml-1 bg-red-500 text-white text-xs px-1.5 py-0.5 rounded-full">{pendingCount}</span>}
          </button>
          <button onClick={() => setTab('inquiries')} className={`px-4 py-2 rounded-lg text-sm font-medium ${tab === 'inquiries' ? 'bg-amber-600 text-white' : 'bg-gray-800 text-gray-400'}`}>
            1:1 문의 ({inquiries.filter((i: any) => i.status === 'WAITING').length})
          </button>
        </div>

        {tab === 'reports' ? (
          <>
            {/* 필터 */}
            <div className="flex gap-2">
              {['', 'PENDING', 'RESOLVED', 'REJECTED'].map(s => (
                <button key={s} onClick={() => setFilter(s)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium ${filter === s ? 'bg-amber-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}>
                  {s === '' ? '전체' : STATUS_BADGE[s]?.label}
                </button>
              ))}
            </div>

            {reports.length === 0 ? <p className="text-center py-12 text-gray-500">신고가 없습니다</p> :
            <div className="space-y-3">
              {reports.map((r: any) => (
                <div key={r.id} className={`bg-gray-800 rounded-xl border p-4 ${r.status === 'PENDING' ? 'border-amber-700' : 'border-gray-700'}`}>
                  {/* 헤더 */}
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs bg-gray-700 px-2 py-0.5 rounded">{r.type}</span>
                      <span className="text-sm font-semibold">{r.reason}</span>
                      <span className={`text-xs px-1.5 py-0.5 rounded ${STATUS_BADGE[r.status]?.cls}`}>{STATUS_BADGE[r.status]?.label}</span>
                    </div>
                    <span className="text-xs text-gray-500">{new Date(r.createdAt).toLocaleDateString('ko-KR')}</span>
                  </div>

                  {r.detail && <p className="text-sm text-gray-300 mb-2">{r.detail}</p>}

                  {/* 상품 정보 */}
                  {r.product && (
                    <div className="flex items-center gap-3 bg-gray-700/50 rounded-lg p-3 mb-2">
                      {r.product.thumbnail && (
                        <img src={imgUrl(r.product.thumbnail)!} alt="" className="w-12 h-12 rounded-lg object-cover shrink-0" />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{r.product.name}</p>
                        <p className="text-xs text-gray-400">{r.product.store?.name} · {r.product.isActive ? '판매중' : '비활성'}</p>
                      </div>
                      {r.product.store?.slug && (
                        <a href={`${API_URL.replace('/api', '')}/../store/${r.product.store.slug}/products/${r.targetId}`}
                          target="_blank" rel="noopener noreferrer"
                          className="text-xs text-amber-400 hover:underline flex items-center gap-1 shrink-0">
                          보기 <ExternalLinkIcon size={11} />
                        </a>
                      )}
                      {r.product.isActive && r.status === 'PENDING' && (
                        <button onClick={() => handleDeleteProduct(r.targetId)}
                          className="flex items-center gap-1 text-xs text-red-400 hover:text-red-300 bg-red-900/30 px-2 py-1 rounded-lg shrink-0">
                          <Trash2 size={12} /> 상품삭제
                        </button>
                      )}
                    </div>
                  )}

                  {/* 신고자 */}
                  {r.consumer && (
                    <p className="text-xs text-gray-500 mb-2">신고자: {r.consumer.name} ({r.consumer.email})</p>
                  )}

                  {/* 처리 메모 */}
                  {r.adminNote && r.status !== 'PENDING' && (
                    <div className="bg-gray-700/50 rounded-lg p-2 mb-2">
                      <p className="text-xs text-amber-400 font-medium mb-0.5">처리 내용</p>
                      <p className="text-sm text-gray-300">{r.adminNote}</p>
                    </div>
                  )}

                  {/* 처리 액션 */}
                  {r.status === 'PENDING' && (
                    actionId === r.id ? (
                      <div className="space-y-2 mt-2">
                        <textarea value={adminNote} onChange={(e) => setAdminNote(e.target.value)}
                          placeholder="처리 내용을 입력하세요 (소비자에게 알림으로 전송됩니다)"
                          className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 resize-none h-16 focus:outline-none focus:ring-1 focus:ring-amber-500" />
                        <div className="flex gap-2">
                          <button onClick={() => { setActionId(null); setAdminNote(''); }}
                            className="px-3 py-1.5 text-xs bg-gray-700 rounded-lg hover:bg-gray-600">취소</button>
                          <button onClick={() => handleResolve(r.id, 'RESOLVED')}
                            className="flex items-center gap-1 px-3 py-1.5 text-xs bg-green-700 rounded-lg hover:bg-green-600">
                            <CheckCircle size={13} /> 처리 완료
                          </button>
                          <button onClick={() => handleResolve(r.id, 'REJECTED')}
                            className="flex items-center gap-1 px-3 py-1.5 text-xs bg-gray-700 rounded-lg hover:bg-gray-600">
                            <XCircle size={13} /> 반려
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button onClick={() => { setActionId(r.id); setAdminNote(''); }}
                        className="mt-2 flex items-center gap-1 text-xs text-amber-400 hover:underline">
                        <Send size={12} /> 처리하기
                      </button>
                    )
                  )}
                </div>
              ))}
            </div>}
          </>
        ) : (
          inquiries.length === 0 ? <p className="text-center py-12 text-gray-500">문의가 없습니다</p> :
          <div className="space-y-2">
            {inquiries.map((q: any) => (
              <div key={q.id} className={`bg-gray-800 rounded-xl border p-4 ${q.status === 'WAITING' ? 'border-blue-700' : 'border-gray-700'}`}>
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs bg-gray-700 px-2 py-0.5 rounded">{q.category}</span>
                    <span className="text-sm font-medium">{q.title}</span>
                    <span className={`text-xs px-1.5 py-0.5 rounded ${q.status === 'WAITING' ? 'bg-blue-900/40 text-blue-400' : 'bg-green-900/40 text-green-400'}`}>{q.status === 'WAITING' ? '대기' : '답변완료'}</span>
                  </div>
                  {q.status === 'WAITING' && <button onClick={() => handleAnswer(q.id)} className="text-xs text-amber-400 hover:underline">답변하기</button>}
                </div>
                <p className="text-sm text-gray-300 mt-1">{q.content}</p>
                {q.answer && <div className="mt-2 p-2 bg-gray-700/50 rounded-lg text-xs text-gray-300"><span className="text-amber-400 font-medium">답변:</span> {q.answer}</div>}
                <p className="text-xs text-gray-500 mt-1">{q.name} ({q.email}) | {new Date(q.createdAt).toLocaleDateString('ko-KR')}</p>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
