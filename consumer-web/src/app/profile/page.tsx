'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';
import { consumerAuthApi } from '@/lib/api';
import NavBar from '@/components/NavBar';
import Link from 'next/link';
import { User, Phone, Mail, Save, LogOut, MapPin, CreditCard, Fingerprint, Package } from 'lucide-react';
import toast from 'react-hot-toast';

export default function ProfilePage() {
  const router = useRouter();
  const { consumer, accessToken, clearAuth, updateConsumer } = useAuthStore();

  const [form, setForm] = useState({ name: consumer?.name || '', phone: consumer?.phone || '' });
  const [loading, setLoading] = useState(false);

  if (!consumer) {
    router.replace('/auth/login?redirect=%2Fprofile');
    return null;
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) { toast.error('이름을 입력해주세요'); return; }
    setLoading(true);
    try {
      const res = await consumerAuthApi.updateProfile({ name: form.name, phone: form.phone }, accessToken!);
      updateConsumer(res.data.data);
      toast.success('프로필이 저장되었습니다');
    } catch {
      toast.error('저장에 실패했습니다');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    try { if (accessToken) await consumerAuthApi.logout(accessToken); } catch {}
    clearAuth();
    router.push('/');
  };

  return (
    <div className="min-h-screen bg-tea-50 pb-16">
      <NavBar title="내 프로필" back={true} />

      <div className="max-w-lg mx-auto px-4 py-6 space-y-4">
        {/* 아바타 영역 */}
        <div className="bg-white rounded-2xl border border-gray-100 p-6 flex flex-col items-center gap-3">
          <div className="w-16 h-16 rounded-full bg-tea-100 flex items-center justify-center">
            <User size={28} className="text-tea-600" />
          </div>
          <div className="text-center">
            <p className="font-bold text-gray-900 text-lg">{consumer.name}</p>
            <p className="text-sm text-gray-500">{consumer.email}</p>
          </div>
        </div>

        {/* 정보 수정 */}
        <div className="bg-white rounded-2xl border border-gray-100 p-5">
          <h2 className="font-semibold text-gray-800 mb-4">정보 수정</h2>
          <form onSubmit={handleSave} className="space-y-3">
            <div>
              <label className="text-xs text-gray-500 mb-1 block">이메일</label>
              <div className="relative">
                <Mail size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300" />
                <input value={consumer.email} disabled
                  className="w-full pl-9 pr-4 py-2.5 text-sm border border-gray-200 rounded-xl bg-gray-50 text-gray-400 cursor-not-allowed" />
              </div>
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">이름</label>
              <div className="relative">
                <User size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full pl-9 pr-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-tea-500" />
              </div>
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">연락처</label>
              <div className="relative">
                <Phone size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  placeholder="010-0000-0000"
                  className="w-full pl-9 pr-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-tea-500" />
              </div>
            </div>
            <button type="submit" disabled={loading}
              className="w-full py-2.5 rounded-xl bg-tea-600 text-white font-medium text-sm hover:bg-tea-700 disabled:opacity-50 flex items-center justify-center gap-2">
              <Save size={15} /> {loading ? '저장중...' : '저장'}
            </button>
          </form>
        </div>

        {/* 메뉴 링크 */}
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden divide-y divide-gray-50">
          <Link href="/orders" className="flex items-center justify-between p-4 hover:bg-gray-50 transition-colors">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-tea-50 flex items-center justify-center">
                <Package size={15} className="text-tea-600" />
              </div>
              <span className="text-sm font-medium text-gray-800">주문 내역</span>
            </div>
            <span className="text-gray-400 text-sm">→</span>
          </Link>
          <Link href="/profile/addresses" className="flex items-center justify-between p-4 hover:bg-gray-50 transition-colors">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-blue-50 flex items-center justify-center">
                <MapPin size={15} className="text-blue-600" />
              </div>
              <span className="text-sm font-medium text-gray-800">배송지 관리</span>
            </div>
            <span className="text-gray-400 text-sm">→</span>
          </Link>
          <Link href="/profile/billing" className="flex items-center justify-between p-4 hover:bg-gray-50 transition-colors">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-purple-50 flex items-center justify-center">
                <Fingerprint size={15} className="text-purple-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-800">결제수단 · 지문인증</p>
                <p className="text-xs text-gray-400">카드 등록 및 생체인증 관리</p>
              </div>
            </div>
            <span className="text-gray-400 text-sm">→</span>
          </Link>
        </div>

        {/* 로그아웃 */}
        <button onClick={handleLogout}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl border border-red-100 text-red-500 hover:bg-red-50 transition-colors text-sm font-medium">
          <LogOut size={16} /> 로그아웃
        </button>
      </div>
    </div>
  );
}