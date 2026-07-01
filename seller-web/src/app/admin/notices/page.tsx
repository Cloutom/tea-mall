'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import axios from 'axios';
import Link from 'next/link';
import { Shield, ArrowLeft, Bell, Plus, Trash2, Pin, PinOff, Eye, EyeOff, X } from 'lucide-react';


export default function AdminNoticesPage() {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [notices, setNotices] = useState<any[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: '', content: '', isPinned: false });
  const headers = token ? { Authorization: `Bearer ${token}` } : {};

  useEffect(() => {
    const t = localStorage.getItem('admin-token');
    if (!t) { router.replace('/admin/login'); return; }
    setToken(t);
  }, [router]);

  const fetchNotices = () => {
    if (!token) return;
    axios.get(`/api/admin/notices`, { headers }).then(r => setNotices(r.data.data || [])).catch(() => {});
  };
  useEffect(() => { fetchNotices(); }, [token]);

  const handleCreate = async () => {
    if (!form.title || !form.content) return;
    await axios.post(`/api/admin/notices`, form, { headers });
    setForm({ title: '', content: '', isPinned: false }); setShowForm(false); fetchNotices();
  };

  const togglePin = async (id: string, current: boolean) => {
    await axios.put(`/api/admin/notices/${id}`, { isPinned: !current }, { headers }); fetchNotices();
  };
  const toggleActive = async (id: string, current: boolean) => {
    await axios.put(`/api/admin/notices/${id}`, { isActive: !current }, { headers }); fetchNotices();
  };
  const handleDelete = async (id: string) => {
    if (!confirm('삭제하시겠습니까?')) return;
    await axios.delete(`/api/admin/notices/${id}`, { headers }); fetchNotices();
  };

  if (!token) return null;

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <header className="bg-gray-800 border-b border-gray-700 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/admin" className="text-gray-400 hover:text-white"><ArrowLeft size={20} /></Link>
          <Shield size={22} className="text-amber-400" />
          <span className="font-bold text-lg">공지사항 관리</span>
        </div>
        <button onClick={() => setShowForm(true)} className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-sm font-medium rounded-lg flex items-center gap-2">
          <Plus size={16} /> 새 공지
        </button>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-6 space-y-4">
        {showForm && (
          <div className="bg-gray-800 rounded-xl border border-amber-600/50 p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">새 공지사항</h3>
              <button onClick={() => setShowForm(false)}><X size={18} className="text-gray-400" /></button>
            </div>
            <input value={form.title} onChange={e => setForm({...form, title: e.target.value})}
              placeholder="제목" className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-sm" />
            <textarea value={form.content} onChange={e => setForm({...form, content: e.target.value})}
              placeholder="내용" rows={5} className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-sm resize-none" />
            <label className="flex items-center gap-2 text-sm text-gray-400">
              <input type="checkbox" checked={form.isPinned} onChange={e => setForm({...form, isPinned: e.target.checked})} className="accent-amber-500" />
              상단 고정
            </label>
            <button onClick={handleCreate} className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-sm font-medium rounded-lg">등록</button>
          </div>
        )}

        {notices.length === 0 ? (
          <div className="text-center py-16 text-gray-500">
            <Bell size={32} className="mx-auto mb-2 text-gray-600" />
            <p>등록된 공지사항이 없습니다</p>
          </div>
        ) : (
          <div className="space-y-2">
            {notices.map((n: any) => (
              <div key={n.id} className={`bg-gray-800 rounded-xl border p-4 ${n.isActive ? 'border-gray-700' : 'border-gray-800 opacity-50'}`}>
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    {n.isPinned && <Pin size={12} className="text-amber-400 shrink-0" />}
                    <span className="font-medium truncate">{n.title}</span>
                    <span className="text-xs text-gray-500">{new Date(n.createdAt).toLocaleDateString('ko-KR')}</span>
                  </div>
                  <div className="flex items-center gap-1 shrink-0 ml-2">
                    <button onClick={() => togglePin(n.id, n.isPinned)} className="p-1.5 rounded hover:bg-gray-700" title={n.isPinned ? '고정 해제' : '고정'}>
                      {n.isPinned ? <PinOff size={14} className="text-amber-400" /> : <Pin size={14} className="text-gray-500" />}
                    </button>
                    <button onClick={() => toggleActive(n.id, n.isActive)} className="p-1.5 rounded hover:bg-gray-700" title={n.isActive ? '숨기기' : '표시'}>
                      {n.isActive ? <Eye size={14} className="text-green-400" /> : <EyeOff size={14} className="text-gray-500" />}
                    </button>
                    <button onClick={() => handleDelete(n.id)} className="p-1.5 rounded hover:bg-gray-700">
                      <Trash2 size={14} className="text-red-400" />
                    </button>
                  </div>
                </div>
                <p className="text-sm text-gray-400 line-clamp-2">{n.content}</p>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
