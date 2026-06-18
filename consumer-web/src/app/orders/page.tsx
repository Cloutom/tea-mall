'use client';

import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { paymentApi, consumerAuthApi } from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import Link from 'next/link';
import { Search, Package, ChevronRight, AlertCircle, X } from 'lucide-react';
import NavBar from '@/components/NavBar';
import toast from 'react-hot-toast';

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  PENDING:    { label: '결제대기',   color: 'text-yellow-600 bg-yellow-50' },
  CONFIRMED:  { label: '주문확인',   color: 'text-blue-600 bg-blue-50' },
  PREPARING:  { label: '준비중',     color: 'text-purple-600 bg-purple-50' },
  SHIPPING:   { label: '배송중',     color: 'text-tea-700 bg-tea-50' },
  DELIVERED:  { label: '배송완료',   color: 'text-green-700 bg-green-50' },
  CANCELLED:  { label: '취소됨',     color: 'text-red-600 bg-red-50' },
  REFUND_REQ: { label: '취소/환불신청', color: 'text-orange-600 bg-orange-50' },
  REFUNDED:   { label: '환불완료',   color: 'text-gray-500 bg-gray-50' },
};

// 취소 가능한 상태
const CANCELLABLE = ['CONFIRMED', 'PREPARING'];
const REFUNDABLE  = ['SHIPPING', 'DELIVERED'];

interface CancelModalProps {
  order: any;
  onClose: () => void;
  onSubmit: (reason: string) => Promise<void>;
}

function CancelModal({ order, onClose, onSubmit }: CancelModalProps) {
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const isRefund = REFUNDABLE.includes(order.status);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason.trim()) { toast.error('사유를 입력해주세요'); return; }
    setLoading(true);
    await onSubmit(reason);
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-md p-5 shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-gray-900">{isRefund ? '환불 신청' : '취소 신청'}</h3>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-700"><X size={20} /></button>
        </div>

        <div className="bg-gray-50 rounded-xl p-3 mb-4 text-sm text-gray-600">
          <p className="font-medium text-gray-800 mb-1">{order.orderNumber}</p>
          <p className="text-xs text-gray-400">
            {isRefund
              ? '배송 중/완료된 주문은 판매자 확인 후 환불 처리됩니다.'
              : '판매자 확인 후 결제 취소 처리됩니다.'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="text-xs text-gray-500 mb-1 block">{isRefund ? '환불' : '취소'} 사유 *</label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="사유를 입력해주세요"
              rows={3}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-tea-500 resize-none"
            />
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={onClose}
              className="flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-600 text-sm font-medium hover:bg-gray-50">
              닫기
            </button>
            <button type="submit" disabled={loading}
              className="flex-1 py-2.5 rounded-xl bg-red-500 text-white text-sm font-medium hover:bg-red-600 disabled:opacity-50">
              {loading ? '신청 중...' : `${isRefund ? '환불' : '취소'} 신청`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function OrderCard({ order, onCancelRequest }: { order: any; onCancelRequest: (o: any) => void }) {
  const statusInfo = STATUS_MAP[order.status] || { label: order.status, color: 'text-gray-600 bg-gray-50' };
  const canRequest = CANCELLABLE.includes(order.status) || REFUNDABLE.includes(order.status);

  return (
    <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden mb-3">
      <div className="px-5 py-4 border-b border-gray-50">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs font-mono text-gray-500">{order.orderNumber}</span>
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusInfo.color}`}>{statusInfo.label}</span>
        </div>
        <p className="text-xs text-gray-400">{new Date(order.createdAt).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
        {order.store && (
          <Link href={`/store/${order.store.slug}`} className="flex items-center gap-1 mt-2 text-sm text-tea-700 hover:underline">
            {order.store.name} <ChevronRight size={13} />
          </Link>
        )}
      </div>

      <div className="divide-y divide-gray-50">
        {order.items?.map((item: any) => (
          <div key={item.id} className="flex gap-3 px-5 py-3">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 line-clamp-1">{item.productName}</p>
              <p className="text-xs text-gray-400 mt-0.5">{item.quantity}개 × {item.unitPrice.toLocaleString()}원</p>
            </div>
            <p className="text-sm font-bold text-gray-900 shrink-0">{item.totalPrice.toLocaleString()}원</p>
          </div>
        ))}
      </div>

      <div className="px-5 py-4 bg-gray-50 space-y-2">
        {order.recipientName && (
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">수령인</span>
            <span className="text-gray-700 text-xs">{order.recipientName} {order.recipientPhone}</span>
          </div>
        )}
        <div className="flex justify-between text-sm">
          <span className="text-gray-500">배송지</span>
          <span className="text-gray-700 text-right max-w-[60%] text-xs">
            {order.postalCode && `[${order.postalCode}] `}{order.address}{order.addressDetail ? ` ${order.addressDetail}` : ''}
          </span>
        </div>
        {order.deliveryMemo && (
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">배송메모</span>
            <span className="text-gray-700 text-right max-w-[60%] text-xs">{order.deliveryMemo}</span>
          </div>
        )}
        <div className="flex justify-between text-sm font-semibold">
          <span className="text-gray-800">총 결제금액</span>
          <span className="text-gray-900">{order.finalAmount.toLocaleString()}원</span>
        </div>
        {order.trackingNumber && (
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">운송장</span>
            <span className="text-gray-700 font-mono">{order.courier} {order.trackingNumber}</span>
          </div>
        )}
        {order.cancelReason && (order.status === 'REFUND_REQ' || order.status === 'CANCELLED' || order.status === 'REFUNDED') && (
          <div className="flex items-start gap-1.5 text-xs text-orange-600 pt-1">
            <AlertCircle size={13} className="shrink-0 mt-0.5" />
            <span>{order.cancelReason}</span>
          </div>
        )}
        {canRequest && (
          <button
            onClick={() => onCancelRequest(order)}
            className="w-full mt-1 py-2 rounded-xl border border-red-200 text-red-500 text-xs font-medium hover:bg-red-50 transition-colors">
            {REFUNDABLE.includes(order.status) ? '환불 신청' : '취소 신청'}
          </button>
        )}
      </div>
    </div>
  );
}

export default function OrdersPage() {
  const { consumer, accessToken } = useAuthStore();
  const [tab, setTab] = useState<'my' | 'lookup'>(consumer ? 'my' : 'lookup');
  const [orderNumber, setOrderNumber] = useState('');
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [lookedUpOrder, setLookedUpOrder] = useState<any>(null);
  const [error, setError] = useState('');
  const [cancelTarget, setCancelTarget] = useState<any>(null);

  useEffect(() => { setTab(consumer ? 'my' : 'lookup'); }, [consumer]);

  const { data: myOrders, isLoading: ordersLoading, refetch } = useQuery({
    queryKey: ['my-orders', accessToken],
    queryFn: () => consumerAuthApi.getMyOrders(accessToken!).then((r) => r.data.data),
    enabled: !!consumer && !!accessToken,
  });

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLookedUpOrder(null);
    setLoading(true);
    try {
      const res = await paymentApi.lookupOrder({ orderNumber: orderNumber.trim(), phone: phone.trim() });
      setLookedUpOrder(res.data.data);
    } catch (err: any) {
      setError(err?.response?.data?.error || '주문을 찾을 수 없습니다');
    } finally {
      setLoading(false);
    }
  };

  const handleCancelSubmit = async (reason: string) => {
    try {
      const order = cancelTarget;
      let res: any;
      if (consumer && accessToken) {
        res = await paymentApi.cancelRequest({ orderId: order.id, reason }, accessToken);
      } else {
        res = await paymentApi.cancelRequest({ orderNumber: order.orderNumber, phone: order.buyerPhone, reason });
      }
      toast.success(res.data.message);
      setCancelTarget(null);
      // 상태 갱신
      if (consumer) {
        refetch();
      } else {
        // 비회원: 조회된 주문 상태 업데이트
        setLookedUpOrder((prev: any) => ({ ...prev, status: res.data.data.status, cancelReason: reason }));
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.error || '처리에 실패했습니다');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-16">
      <NavBar title="주문 조회" back={true} />

      <div className="max-w-2xl mx-auto px-4 py-5">
        {consumer && (
          <div className="flex rounded-xl bg-gray-100 p-1 mb-5">
            <button onClick={() => setTab('my')}
              className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors ${tab === 'my' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'}`}>
              내 주문 내역
            </button>
            <button onClick={() => setTab('lookup')}
              className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors ${tab === 'lookup' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'}`}>
              주문번호 조회
            </button>
          </div>
        )}

        {tab === 'my' && consumer && (
          <div>
            {ordersLoading ? (
              <div className="space-y-3">{[1, 2].map((i) => <div key={i} className="h-32 bg-white rounded-2xl animate-pulse" />)}</div>
            ) : !myOrders?.length ? (
              <div className="flex flex-col items-center justify-center h-48 bg-white rounded-2xl border border-gray-100 gap-3">
                <Package size={32} className="text-gray-300" />
                <p className="text-gray-400 text-sm">아직 주문 내역이 없습니다</p>
                <Link href="/" className="text-sm text-tea-700 hover:underline">쇼핑하러 가기</Link>
              </div>
            ) : (
              myOrders.map((order: any) => (
                <OrderCard key={order.id} order={order} onCancelRequest={setCancelTarget} />
              ))
            )}
          </div>
        )}

        {tab === 'lookup' && (
          <div>
            <div className="bg-white rounded-2xl border border-gray-100 p-5 mb-4">
              <div className="flex items-center gap-2 mb-4">
                <Package size={18} className="text-tea-600" />
                <h2 className="font-semibold text-gray-800">주문번호로 조회</h2>
              </div>
              <form onSubmit={handleSearch} className="space-y-3">
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">주문번호</label>
                  <input value={orderNumber} onChange={(e) => setOrderNumber(e.target.value)}
                    placeholder="ORD-20250101-XXXXX"
                    className="w-full px-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-tea-500 focus:border-transparent" required />
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">주문 시 입력한 연락처</label>
                  <input value={phone} onChange={(e) => setPhone(e.target.value)}
                    placeholder="01012345678"
                    className="w-full px-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-tea-500 focus:border-transparent" required />
                </div>
                {error && <p className="text-sm text-red-500">{error}</p>}
                <button type="submit" disabled={loading}
                  className="w-full py-2.5 rounded-xl bg-tea-700 text-white font-semibold text-sm hover:bg-tea-800 transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
                  <Search size={15} />
                  {loading ? '조회중...' : '주문 조회'}
                </button>
              </form>
            </div>
            {lookedUpOrder && (
              <OrderCard order={lookedUpOrder} onCancelRequest={setCancelTarget} />
            )}
          </div>
        )}
      </div>

      {cancelTarget && (
        <CancelModal
          order={cancelTarget}
          onClose={() => setCancelTarget(null)}
          onSubmit={handleCancelSubmit}
        />
      )}
    </div>
  );
}