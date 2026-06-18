'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { addressApi } from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import NavBar from '@/components/NavBar';
import AddressSearch from '@/components/AddressSearch';
import toast from 'react-hot-toast';
import { Plus, Trash2, Star, Pencil, Home, Briefcase, MapPin } from 'lucide-react';

const LABELS = ['집', '회사', '기타'];
const LABEL_ICONS: Record<string, React.ReactNode> = {
  '집': <Home size={14} />,
  '회사': <Briefcase size={14} />,
  '기타': <MapPin size={14} />,
};

interface Address {
  id: string; label: string; recipientName: string; recipientPhone: string;
  zipCode: string; address: string; addressDetail?: string; isDefault: boolean;
}

interface FormState {
  id?: string; label: string; recipientName: string; recipientPhone: string;
  zipCode: string; address: string; addressDetail: string; isDefault: boolean;
}

const emptyForm: FormState = {
  label: '집', recipientName: '', recipientPhone: '',
  zipCode: '', address: '', addressDetail: '', isDefault: false,
};

export default function AddressesPage() {
  const { accessToken } = useAuthStore();
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);

  const { data: addresses = [], isLoading } = useQuery<Address[]>({
    queryKey: ['addresses', accessToken],
    queryFn: () => addressApi.getAll(accessToken!).then((r) => r.data.data),
    enabled: !!accessToken,
  });

  const refetch = () => qc.invalidateQueries({ queryKey: ['addresses'] });

  const saveMutation = useMutation({
    mutationFn: (data: FormState) =>
      data.id
        ? addressApi.update(data.id, data, accessToken!)
        : addressApi.create(data, accessToken!),
    onSuccess: () => { toast.success('배송지가 저장되었습니다'); setShowForm(false); setForm(emptyForm); refetch(); },
    onError: () => toast.error('저장에 실패했습니다'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => addressApi.delete(id, accessToken!),
    onSuccess: () => { toast.success('배송지가 삭제되었습니다'); refetch(); },
    onError: () => toast.error('삭제에 실패했습니다'),
  });

  const defaultMutation = useMutation({
    mutationFn: (id: string) => addressApi.setDefault(id, accessToken!),
    onSuccess: () => { toast.success('기본 배송지가 변경되었습니다'); refetch(); },
    onError: () => toast.error('변경에 실패했습니다'),
  });

  const openEdit = (addr: Address) => {
    setForm({ ...addr, addressDetail: addr.addressDetail || '' });
    setShowForm(true);
  };

  const openNew = () => { setForm(emptyForm); setShowForm(true); };

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      <NavBar title="배송지 관리" back="/profile" />
      <div className="max-w-2xl mx-auto px-4 py-5">
        {isLoading ? (
          <div className="space-y-3">{[1,2].map(i => <div key={i} className="h-28 bg-white rounded-2xl animate-pulse" />)}</div>
        ) : addresses.length === 0 && !showForm ? (
          <div className="flex flex-col items-center justify-center h-40 bg-white rounded-2xl border border-gray-100 gap-3">
            <MapPin size={28} className="text-gray-300" />
            <p className="text-gray-400 text-sm">등록된 배송지가 없습니다</p>
          </div>
        ) : (
          <div className="space-y-3">
            {addresses.map((addr) => (
              <div key={addr.id} className={`bg-white rounded-2xl border p-4 ${addr.isDefault ? 'border-tea-400' : 'border-gray-100'}`}>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
                      {LABEL_ICONS[addr.label] || <MapPin size={12} />} {addr.label}
                    </span>
                    {addr.isDefault && (
                      <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-tea-50 text-tea-700 font-medium">
                        <Star size={10} fill="currentColor" /> 기본
                      </span>
                    )}
                  </div>
                  <div className="flex gap-1">
                    {!addr.isDefault && (
                      <button onClick={() => defaultMutation.mutate(addr.id)}
                        className="p-1.5 text-gray-400 hover:text-tea-600 hover:bg-tea-50 rounded-lg transition-colors text-xs">
                        기본설정
                      </button>
                    )}
                    <button onClick={() => openEdit(addr)} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
                      <Pencil size={14} />
                    </button>
                    <button onClick={() => deleteMutation.mutate(addr.id)} className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
                <p className="mt-2 text-sm font-semibold text-gray-900">{addr.recipientName} · {addr.recipientPhone}</p>
                <p className="text-sm text-gray-600 mt-0.5">[{addr.zipCode}] {addr.address}</p>
                {addr.addressDetail && <p className="text-sm text-gray-500">{addr.addressDetail}</p>}
              </div>
            ))}
          </div>
        )}

        {showForm && (
          <div className="mt-4 bg-white rounded-2xl border border-tea-200 p-5 space-y-3">
            <h3 className="font-semibold text-gray-800">{form.id ? '배송지 수정' : '새 배송지 추가'}</h3>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">라벨</label>
              <div className="flex gap-2">
                {LABELS.map((l) => (
                  <button key={l} onClick={() => setForm((f) => ({ ...f, label: l }))}
                    className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm border transition-colors ${form.label === l ? 'border-tea-500 bg-tea-50 text-tea-700' : 'border-gray-200 text-gray-500'}`}>
                    {LABEL_ICONS[l]} {l}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-gray-500 mb-1 block">수령인 *</label>
                <input value={form.recipientName} onChange={(e) => setForm((f) => ({ ...f, recipientName: e.target.value }))}
                  placeholder="홍길동"
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-tea-500" />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">연락처 *</label>
                <input value={form.recipientPhone} onChange={(e) => setForm((f) => ({ ...f, recipientPhone: e.target.value }))}
                  placeholder="01012345678"
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-tea-500" />
              </div>
            </div>
            <div className="flex gap-2">
              <input value={form.address} readOnly placeholder="주소 검색 *"
                className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-xl bg-gray-50 text-gray-700" />
              <AddressSearch onSelect={(d) => setForm((f) => ({ ...f, address: d.address, zipCode: d.zipCode }))} />
            </div>
            {form.address && (
              <input value={form.addressDetail} onChange={(e) => setForm((f) => ({ ...f, addressDetail: e.target.value }))}
                placeholder="상세주소 (동/호수 등)"
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-tea-500" />
            )}
            <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
              <input type="checkbox" checked={form.isDefault} onChange={(e) => setForm((f) => ({ ...f, isDefault: e.target.checked }))} className="rounded" />
              기본 배송지로 설정
            </label>
            <div className="flex gap-2 pt-1">
              <button onClick={() => { setShowForm(false); setForm(emptyForm); }}
                className="flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-600 text-sm font-medium hover:bg-gray-50">
                취소
              </button>
              <button onClick={() => saveMutation.mutate(form)} disabled={saveMutation.isPending || !form.recipientName || !form.address}
                className="flex-1 py-2.5 rounded-xl bg-tea-700 text-white text-sm font-medium hover:bg-tea-800 disabled:opacity-50">
                {saveMutation.isPending ? '저장 중...' : '저장'}
              </button>
            </div>
          </div>
        )}

        {!showForm && (
          <button onClick={openNew}
            className="mt-4 w-full py-3 rounded-2xl border-2 border-dashed border-gray-200 text-gray-400 hover:border-tea-400 hover:text-tea-600 transition-colors flex items-center justify-center gap-2 text-sm font-medium">
            <Plus size={16} /> 배송지 추가
          </button>
        )}
      </div>
    </div>
  );
}