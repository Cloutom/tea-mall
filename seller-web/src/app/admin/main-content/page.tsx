'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import axios from 'axios';
import Link from 'next/link';
import {
  Shield, ArrowLeft, Image, Megaphone, Upload, Trash2, Plus, X, Eye, EyeOff,
  GripVertical, ExternalLink, LogOut, Users,
} from 'lucide-react';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? '';
const imgUrl = (p?: string | null) => p ? (p.startsWith('/') ? `${API_URL}${p}` : p) : null;

function useAdminAuth() {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  useEffect(() => {
    const t = localStorage.getItem('admin-token');
    if (!t) { router.replace('/admin/login'); return; }
    setToken(t);
  }, [router]);
  return token;
}

export default function MainContentPage() {
  const token = useAdminAuth();
  const [tab, setTab] = useState<'banners' | 'popups'>('banners');
  const [banners, setBanners] = useState<any[]>([]);
  const [popups, setPopups] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const bannerFileRef = useRef<HTMLInputElement>(null);
  const popupFileRef = useRef<HTMLInputElement>(null);

  const headers = token ? { Authorization: `Bearer ${token}` } : {};

  const fetchData = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const [b, p] = await Promise.all([
        axios.get(`/api/admin/banners`, { headers }),
        axios.get(`/api/admin/popups`, { headers }),
      ]);
      setBanners(b.data.data || []);
      setPopups(p.data.data || []);
    } catch {}
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, [token]);

  // ── 배너 ──
  const handleBannerUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const fd = new FormData();
    fd.append('image', file);
    const linkUrl = prompt('배너 클릭 시 이동할 URL (없으면 빈칸):') || '';
    const title = prompt('배너 제목 (없으면 빈칸):') || '';
    const height = prompt('배너 높이 (px, 기본 300):', '300') || '300';
    if (linkUrl) fd.append('linkUrl', linkUrl);
    if (title) fd.append('title', title);
    fd.append('height', height);
    await axios.post(`/api/admin/banners`, fd, { headers: { ...headers, 'Content-Type': 'multipart/form-data' } });
    e.target.value = '';
    fetchData();
  };

  const toggleBanner = async (id: string, isActive: boolean) => {
    const fd = new FormData();
    fd.append('isActive', String(!isActive));
    await axios.put(`/api/admin/banners/${id}`, fd, { headers: { ...headers, 'Content-Type': 'multipart/form-data' } });
    fetchData();
  };

  const deleteBanner = async (id: string) => {
    if (!confirm('배너를 삭제하시겠습니까?')) return;
    await axios.delete(`/api/admin/banners/${id}`, { headers });
    fetchData();
  };

  // ── 팝업 ──
  const [showPopupForm, setShowPopupForm] = useState(false);
  const [popupForm, setPopupForm] = useState({ linkUrl: '', hasLink: false, width: 400, height: 500, startAt: '', endAt: '', closeType: 'close_only' });

  const handlePopupCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const file = popupFileRef.current?.files?.[0];
    const fd = new FormData();
    if (file) fd.append('image', file);
    fd.append('linkUrl', popupForm.linkUrl);
    fd.append('hasLink', String(popupForm.hasLink));
    fd.append('width', String(popupForm.width));
    fd.append('height', String(popupForm.height));
    fd.append('startAt', popupForm.startAt);
    fd.append('endAt', popupForm.endAt);
    fd.append('closeType', popupForm.closeType);
    await axios.post(`/api/admin/popups`, fd, { headers: { ...headers, 'Content-Type': 'multipart/form-data' } });
    setShowPopupForm(false);
    setPopupForm({ linkUrl: '', hasLink: false, width: 400, height: 500, startAt: '', endAt: '', closeType: 'close_only' });
    if (popupFileRef.current) popupFileRef.current.value = '';
    fetchData();
  };

  const togglePopup = async (id: string, isActive: boolean) => {
    const fd = new FormData();
    fd.append('isActive', String(!isActive));
    await axios.put(`/api/admin/popups/${id}`, fd, { headers: { ...headers, 'Content-Type': 'multipart/form-data' } });
    fetchData();
  };

  const deletePopup = async (id: string) => {
    if (!confirm('팝업을 삭제하시겠습니까?')) return;
    await axios.delete(`/api/admin/popups/${id}`, { headers });
    fetchData();
  };

  if (!token) return null;

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* 헤더 */}
      <header className="bg-gray-800 border-b border-gray-700 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/admin" className="text-gray-400 hover:text-white"><ArrowLeft size={20} /></Link>
          <Shield size={22} className="text-amber-400" />
          <span className="font-bold text-lg">메인 페이지 관리</span>
        </div>
        <div className="flex items-center gap-4">
          <Link href="/admin/sellers" className="text-sm text-gray-300 hover:text-white flex items-center gap-1"><Users size={14} /> 판매자</Link>
          <Link href="/admin" className="text-sm text-gray-300 hover:text-white">대시보드</Link>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8">
        {/* 탭 */}
        <div className="flex gap-2 mb-6">
          <button onClick={() => setTab('banners')}
            className={`px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors ${tab === 'banners' ? 'bg-amber-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'}`}>
            <Image size={16} /> 메인 배너
            <span className="bg-black/20 px-1.5 py-0.5 rounded text-xs">{banners.length}</span>
          </button>
          <button onClick={() => setTab('popups')}
            className={`px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors ${tab === 'popups' ? 'bg-amber-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'}`}>
            <Megaphone size={16} /> 메인 팝업
            <span className="bg-black/20 px-1.5 py-0.5 rounded text-xs">{popups.length}</span>
          </button>
        </div>

        {loading ? (
          <div className="text-center py-20 text-gray-500">로딩 중...</div>
        ) : tab === 'banners' ? (
          /* ── 배너 관리 ── */
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-400">소비자 메인 페이지 상단에 표시되는 슬라이드 배너입니다.</p>
              <button onClick={() => bannerFileRef.current?.click()}
                className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-sm font-medium rounded-lg flex items-center gap-2">
                <Plus size={16} /> 배너 추가
              </button>
              <input ref={bannerFileRef} type="file" accept="image/*" className="hidden" onChange={handleBannerUpload} />
            </div>

            {banners.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 bg-gray-800 rounded-xl border border-gray-700">
                <Image size={40} className="text-gray-600 mb-3" />
                <p className="text-gray-500">등록된 배너가 없습니다</p>
                <p className="text-gray-600 text-sm mt-1">배너를 추가하면 소비자 메인 페이지에 슬라이드로 표시됩니다</p>
              </div>
            ) : (
              <div className="grid gap-3">
                {banners.map((b) => (
                  <div key={b.id} className="bg-gray-800 rounded-xl border border-gray-700 p-4 flex gap-4 items-center">
                    <div className="w-40 h-20 rounded-lg overflow-hidden bg-gray-700 shrink-0">
                      {imgUrl(b.imageUrl) && <img src={imgUrl(b.imageUrl)!} alt="" className="w-full h-full object-cover" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{b.title || '(제목 없음)'}</p>
                      {b.linkUrl && <p className="text-xs text-gray-400 truncate flex items-center gap-1"><ExternalLink size={10} />{b.linkUrl}</p>}
                      <div className="flex items-center gap-3 mt-1">
                        <span className="text-xs text-gray-500">순서: {b.order + 1}</span>
                        <span className="text-xs text-gray-500">높이: </span>
                        <input type="number" defaultValue={b.height || 300} min={150} max={600} step={50}
                          className="w-16 bg-gray-700 border border-gray-600 rounded px-1.5 py-0.5 text-xs text-white"
                          onBlur={async (e) => {
                            const h = parseInt(e.target.value);
                            if (h && h !== (b.height || 300)) {
                              const fd = new FormData(); fd.append('height', String(h));
                              await axios.put(`/api/admin/banners/${b.id}`, fd, { headers: { ...headers, 'Content-Type': 'multipart/form-data' } });
                              fetchData();
                            }
                          }} />
                        <span className="text-xs text-gray-500">px</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button onClick={() => toggleBanner(b.id, b.isActive)}
                        className={`p-2 rounded-lg ${b.isActive ? 'text-green-400 bg-green-900/20' : 'text-gray-500 bg-gray-700'}`}
                        title={b.isActive ? '활성' : '비활성'}>
                        {b.isActive ? <Eye size={16} /> : <EyeOff size={16} />}
                      </button>
                      <button onClick={() => deleteBanner(b.id)} className="p-2 rounded-lg text-red-400 bg-red-900/20 hover:bg-red-900/40">
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          /* ── 팝업 관리 ── */
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-400">소비자 메인 페이지 접속 시 표시되는 팝업입니다.</p>
              <button onClick={() => setShowPopupForm(true)}
                className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-sm font-medium rounded-lg flex items-center gap-2">
                <Plus size={16} /> 팝업 추가
              </button>
            </div>

            {/* 팝업 생성 폼 */}
            {showPopupForm && (
              <form onSubmit={handlePopupCreate} className="bg-gray-800 rounded-xl border border-amber-600/50 p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold flex items-center gap-2"><Megaphone size={16} className="text-amber-400" /> 새 팝업</h3>
                  <button type="button" onClick={() => setShowPopupForm(false)} className="text-gray-400 hover:text-white"><X size={18} /></button>
                </div>
                <div>
                  <label className="text-sm text-gray-400 block mb-1">팝업 이미지</label>
                  <input ref={popupFileRef} type="file" accept="image/*" className="text-sm text-gray-300" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm text-gray-400 block mb-1">시작일시</label>
                    <input type="datetime-local" value={popupForm.startAt} onChange={(e) => setPopupForm({ ...popupForm, startAt: e.target.value })}
                      className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-sm" required />
                  </div>
                  <div>
                    <label className="text-sm text-gray-400 block mb-1">종료일시</label>
                    <input type="datetime-local" value={popupForm.endAt} onChange={(e) => setPopupForm({ ...popupForm, endAt: e.target.value })}
                      className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-sm" required />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm text-gray-400 block mb-1">링크 URL (선택)</label>
                    <input type="url" value={popupForm.linkUrl} onChange={(e) => setPopupForm({ ...popupForm, linkUrl: e.target.value })}
                      className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-sm" placeholder="https://" />
                  </div>
                  <div>
                    <label className="text-sm text-gray-400 block mb-1">닫기 방식</label>
                    <select value={popupForm.closeType} onChange={(e) => setPopupForm({ ...popupForm, closeType: e.target.value })}
                      className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-sm">
                      <option value="close_only">닫기만</option>
                      <option value="hide_week">일주일간 보지 않기</option>
                    </select>
                  </div>
                </div>
                <button type="submit" className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-sm font-medium rounded-lg">생성</button>
              </form>
            )}

            {popups.length === 0 && !showPopupForm ? (
              <div className="flex flex-col items-center justify-center py-16 bg-gray-800 rounded-xl border border-gray-700">
                <Megaphone size={40} className="text-gray-600 mb-3" />
                <p className="text-gray-500">등록된 팝업이 없습니다</p>
              </div>
            ) : (
              <div className="grid gap-3">
                {popups.map((p) => {
                  const now = new Date();
                  const isLive = p.isActive && new Date(p.startAt) <= now && new Date(p.endAt) >= now;
                  return (
                    <div key={p.id} className="bg-gray-800 rounded-xl border border-gray-700 p-4 flex gap-4 items-center">
                      <div className="w-24 h-28 rounded-lg overflow-hidden bg-gray-700 shrink-0">
                        {imgUrl(p.imageUrl) && <img src={imgUrl(p.imageUrl)!} alt="" className="w-full h-full object-cover" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${isLive ? 'bg-green-900/40 text-green-400' : 'bg-gray-700 text-gray-400'}`}>
                            {isLive ? '노출 중' : '비활성'}
                          </span>
                          <span className="text-xs text-gray-500">{p.closeType === 'hide_week' ? '일주일간 숨기기' : '닫기만'}</span>
                        </div>
                        <p className="text-xs text-gray-400">
                          {new Date(p.startAt).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })} ~ {new Date(p.endAt).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
                        </p>
                        {p.linkUrl && <p className="text-xs text-gray-500 truncate mt-0.5"><ExternalLink size={10} className="inline" /> {p.linkUrl}</p>}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <button onClick={() => togglePopup(p.id, p.isActive)}
                          className={`p-2 rounded-lg ${p.isActive ? 'text-green-400 bg-green-900/20' : 'text-gray-500 bg-gray-700'}`}>
                          {p.isActive ? <Eye size={16} /> : <EyeOff size={16} />}
                        </button>
                        <button onClick={() => deletePopup(p.id)} className="p-2 rounded-lg text-red-400 bg-red-900/20 hover:bg-red-900/40">
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
