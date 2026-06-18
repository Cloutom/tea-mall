'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { courierApi } from '@/lib/api';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import { Plus, X, Loader2, Truck, Edit2, Star, Trash2, CheckCircle2, AlertCircle } from 'lucide-react';
import { clsx } from 'clsx';
import AddressSearch from '@/components/AddressSearch';

const COURIER_LIST = [
  { code: 'CJ', name: 'CJ대한통운' },
  { code: 'HANJIN', name: '한진택배' },
  { code: 'LOTTE', name: '롯데택배' },
  { code: 'LOGEN', name: '로젠택배' },
  { code: 'EPOST', name: '우체국택배' },
  { code: 'KDEXP', name: '경동택배' },
  { code: 'CVSNET', name: 'GS편의점택배' },
  { code: 'CHUNILPS', name: '천일택배' },
];

export default function ShippingPage() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['courier-accounts'],
    queryFn: () => courierApi.getAccounts().then((r) => r.data.data),
  });

  const { register, handleSubmit, formState: { errors }, reset, setValue } = useForm({
    defaultValues: {
      courierCode: 'CJ', senderName: '', senderPhone: '',
      senderZipCode: '', senderAddress: '', senderAddressDetail: '',
      accountId: '', clientKey: '', isDefault: false,
    },
  });

  const createMutation = useMutation({
    mutationFn: (d: any) => courierApi.createAccount({ ...d, courierName: COURIER_LIST.find((c) => c.code === d.courierCode)?.name || d.courierCode }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['courier-accounts'] }); setShowForm(false); reset(); toast.success('택배사가 등록되었습니다.'); },
    onError: () => toast.error('등록에 실패했습니다.'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) =>
      courierApi.updateAccount(id, { ...data, courierName: COURIER_LIST.find((c) => c.code === data.courierCode)?.name || data.courierCode }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['courier-accounts'] }); setEditingId(null); setShowForm(false); reset(); toast.success('수정되었습니다.'); },
    onError: () => toast.error('수정에 실패했습니다.'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => courierApi.deleteAccount(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['courier-accounts'] }); toast.success('삭제되었습니다.'); },
  });

  const setDefaultMutation = useMutation({
    mutationFn: (id: string) => courierApi.setDefault(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['courier-accounts'] }); toast.success('기본 택배사로 설정되었습니다.'); },
  });

  const onSubmit = (data: any) => {
    if (editingId) {
      updateMutation.mutate({ id: editingId, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const openEdit = (account: any) => {
    setEditingId(account.id);
    setValue('courierCode', account.courierCode);
    setValue('senderName', account.senderName);
    setValue('senderPhone', account.senderPhone);
    setValue('senderZipCode', account.senderZipCode || '');
    setValue('senderAddress', account.senderAddress);
    setValue('senderAddressDetail', account.senderAddressDetail || '');
    setValue('accountId', account.accountId || '');
    setValue('clientKey', account.clientKey || '');
    setValue('isDefault', account.isDefault);
    setShowForm(true);
  };

  const cancelForm = () => { setShowForm(false); setEditingId(null); reset(); };

  const accounts = data || [];

  return (
    <div className="max-w-2xl mx-auto space-y-5 px-4 sm:px-0 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">배송 관리</h1>
          <p className="text-gray-500 text-sm mt-0.5">택배사를 등록하고 발송 정보를 관리하세요</p>
        </div>
        {!showForm && (
          <button onClick={() => setShowForm(true)} className="btn-primary py-2">
            <Plus size={16} /> 택배사 추가
          </button>
        )}
      </div>

      {/* 안내 배너 */}
      {accounts.length === 0 && !isLoading && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
          <AlertCircle size={18} className="text-amber-600 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-medium text-amber-800">택배사를 먼저 등록해주세요</p>
            <p className="text-xs text-amber-600 mt-0.5">주문이 들어왔을 때 운송장 출력 및 택배사 연동을 위해 필요합니다.</p>
          </div>
        </div>
      )}

      {/* 등록 / 수정 폼 */}
      {showForm && (
        <form onSubmit={handleSubmit(onSubmit)} className="card space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-gray-900">{editingId ? '택배사 수정' : '택배사 추가'}</h2>
            <button type="button" onClick={cancelForm}><X size={18} className="text-gray-400 hover:text-gray-600" /></button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="label-base">택배사 *</label>
              <div className="grid grid-cols-4 gap-2">
                {COURIER_LIST.map((c) => (
                  <label key={c.code} className={clsx('relative flex flex-col items-center gap-1 p-2.5 rounded-xl border-2 cursor-pointer text-xs font-medium transition-all text-center',
                    'hover:border-tea-300')}>
                    <input type="radio" {...register('courierCode')} value={c.code} className="sr-only peer" />
                    <span className="text-gray-600 peer-checked:text-tea-700 leading-tight font-medium">{c.name}</span>
                    <div className="absolute inset-0 rounded-xl border-2 border-transparent peer-checked:border-tea-500 pointer-events-none" />
                  </label>
                ))}
              </div>
            </div>
            <div>
              <label className="label-base">발송인 이름 *</label>
              <input {...register('senderName', { required: '발송인 이름을 입력해주세요' })} className="input-base" placeholder="홍길동" />
              {errors.senderName && <p className="text-red-500 text-xs mt-1">{errors.senderName.message as string}</p>}
            </div>
            <div>
              <label className="label-base">발송인 연락처 *</label>
              <input {...register('senderPhone', { required: '연락처를 입력해주세요' })} className="input-base" placeholder="010-0000-0000" />
              {errors.senderPhone && <p className="text-red-500 text-xs mt-1">{errors.senderPhone.message as string}</p>}
            </div>
            <div className="sm:col-span-2">
              <label className="label-base">발송지 주소 *</label>
              <div className="flex gap-2 mb-2">
                <input {...register('senderZipCode')} readOnly className="input-base w-28 bg-gray-50" placeholder="우편번호" />
                <AddressSearch onSelect={({ zipCode, address }) => {
                  setValue('senderZipCode', zipCode);
                  setValue('senderAddress', address);
                }} className="shrink-0" />
              </div>
              <input {...register('senderAddress', { required: '주소를 입력해주세요' })} readOnly className="input-base bg-gray-50 mb-2" placeholder="주소 검색 버튼을 눌러주세요" />
              {errors.senderAddress && <p className="text-red-500 text-xs mt-1">{errors.senderAddress.message as string}</p>}
              <input {...register('senderAddressDetail')} className="input-base" placeholder="상세 주소 (동/호수)" />
            </div>
            <div>
              <label className="label-base">계약번호 (선택)</label>
              <input {...register('accountId')} className="input-base" placeholder="택배사 계약/고객번호" />
            </div>
            <div>
              <label className="label-base">API 키 (선택)</label>
              <input {...register('clientKey')} className="input-base" placeholder="Open API 사용 시" />
            </div>
          </div>

          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" {...register('isDefault')} className="w-4 h-4 accent-tea-600" />
            <span className="text-sm text-gray-700">기본 택배사로 설정</span>
          </label>

          <div className="flex gap-3">
            <button type="button" onClick={cancelForm} className="btn-secondary flex-1 py-2.5">취소</button>
            <button type="submit" disabled={createMutation.isPending || updateMutation.isPending} className="btn-primary flex-1 py-2.5">
              {(createMutation.isPending || updateMutation.isPending) ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
              {editingId ? '수정 완료' : '등록하기'}
            </button>
          </div>
        </form>
      )}

      {/* 택배사 목록 */}
      {isLoading ? (
        <div className="flex items-center justify-center h-32"><Loader2 size={24} className="animate-spin text-tea-600" /></div>
      ) : (
        <div className="space-y-3">
          {accounts.map((account: any) => {
            const courier = COURIER_LIST.find((c) => c.code === account.courierCode);
            return (
              <div key={account.id} className="card flex flex-col sm:flex-row sm:items-center gap-4">
                <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center shrink-0">
                  <Truck size={16} className="text-gray-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-semibold text-gray-900">{account.courierName}</h3>
                    {account.isDefault && (
                      <span className="flex items-center gap-1 text-xs font-medium text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">
                        <Star size={10} className="fill-amber-500 text-amber-500" /> 기본
                      </span>
                    )}
                    {!account.isActive && (
                      <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">비활성</span>
                    )}
                  </div>
                  <p className="text-sm text-gray-600 mt-0.5">{account.senderName} · {account.senderPhone}</p>
                  <p className="text-xs text-gray-400 mt-0.5 truncate">{account.senderAddress} {account.senderAddressDetail}</p>
                  {account.accountId && <p className="text-xs text-gray-400">계약번호: {account.accountId}</p>}
                </div>
                <div className="flex items-center gap-2 sm:flex-col sm:items-end shrink-0">
                  {!account.isDefault && (
                    <button onClick={() => setDefaultMutation.mutate(account.id)} disabled={setDefaultMutation.isPending}
                      className="text-xs text-tea-600 hover:underline whitespace-nowrap">기본으로 설정</button>
                  )}
                  <div className="flex gap-2">
                    <button onClick={() => openEdit(account)}
                      className="p-1.5 text-gray-400 hover:text-tea-600 hover:bg-tea-50 rounded-lg transition-colors">
                      <Edit2 size={15} />
                    </button>
                    <button onClick={() => { if (confirm('삭제하시겠습니까?')) deleteMutation.mutate(account.id); }}
                      className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 운송장 출력 안내 */}
      {accounts.length > 0 && (
        <div className="card bg-blue-50 border-blue-200">
          <div className="flex items-start gap-3">
            <Truck size={18} className="text-blue-600 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-semibold text-blue-800">운송장 출력 및 택배 연동</p>
              <p className="text-xs text-blue-600 mt-1 leading-relaxed">
                주문 관리 → 주문 상세에서 운송장 번호를 입력하면 자동으로 구매자에게 발송 알림이 전송됩니다.<br />
                택배사 API 연동(계약 후 API 키 등록 시)을 통해 운송장 자동 출력 및 수거 요청이 가능합니다.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
