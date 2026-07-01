'use client';

import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { paymentApi, consumerAuthApi, publicApi } from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import Link from 'next/link';
import { Search, Package, ChevronRight, AlertCircle, X, Truck, Star } from 'lucide-react';
import NavBar from '@/components/NavBar';
import toast from 'react-hot-toast';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? '';
const imgUrl = (p?: string | null) => p ? (p.startsWith('/') ? `${API_URL}${p}` : p) : null;

function getTrackingUrl(courier: string, trackingNumber: string): string {
  const map: Record<string, string> = {
    CJ: `https://trace.cjlogistics.com/tracking.html?gnbInvcNo=${trackingNumber}`,
    HANJIN: `https://www.hanjin.com/kor/CMS/DeliveryMg/waybill/tracking?wblnumText2=${trackingNumber}`,
    LOTTE: `https://www.lotteglogis.com/home/reservation/tracking/linkView?InvNo=${trackingNumber}`,
    LOGEN: `https://www.ilogen.com/web/personal/trace/${trackingNumber}`,
    EPOST: `https://service.epost.go.kr/trace.RetrieveDomRi498001Cmd.postal?sid1=${trackingNumber}`,
    KDEXP: `https://kdexp.com/basicNewDelivery.kd?barcode=${trackingNumber}`,
  };
  return map[courier?.toUpperCase()] || `https://search.naver.com/search.naver?query=${courier}+${trackingNumber}`;
}

const STATUS_LABEL: Record<string, string> = {
  PENDING: '결제대기', CONFIRMED: '주문확인', PREPARING: '상품 준비중',
  SHIPPING: '배송중', DELIVERED: '배송완료', PURCHASE_CONFIRMED: '구매확정완료',
  CANCELLED: '취소됨', REFUND_REQ: '취소/환불 신청', REFUNDED: '환불완료',
};

function OrderCard({ order, onAction }: { order: any; onAction: (type: string, order: any) => void }) {
  const status = order.status;
  const statusLabel = STATUS_LABEL[status] || status;
  const isDelivered = status === 'DELIVERED';
  const isConfirmed = status === 'CONFIRMED' && order.paidAt;
  const isPreparing = status === 'PREPARING';
  const isShipping = status === 'SHIPPING';

  // 포인트 예상 적립
  const [pointSetting, setPointSetting] = useState<any>(null);
  useEffect(() => { publicApi.getPointSetting().then(r => setPointSetting(r.data.data)).catch(() => {}); }, []);
  const earnPoints = pointSetting && order.finalAmount >= pointSetting.minOrderAmount && order.discountAmount === 0
    ? Math.min(Math.round(order.finalAmount * pointSetting.earnRate / 100), pointSetting.maxEarnAmount) : 0;

  return (
    <div className="bg-white rounded-xl border border-gray-100 overflow-hidden mb-3">
      {/* 상태 헤더 */}
      <div className="px-4 py-3 border-b border-gray-50 flex items-center justify-between">
        <div>
          <p className={`text-sm font-bold ${status === 'PURCHASE_CONFIRMED' ? 'text-tea-600' : isDelivered ? 'text-green-600' : isShipping ? 'text-blue-600' : ['CANCELLED','REFUND_REQ','REFUNDED'].includes(status) ? 'text-red-500' : 'text-gray-800'}`}>{statusLabel}</p>
          <p className="text-[11px] text-gray-400 mt-0.5">
            {new Date(order.createdAt).toLocaleDateString('ko-KR', { month: 'numeric', day: 'numeric' })}. {new Date(order.createdAt).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })} 주문
          </p>
        </div>
        <button className="text-gray-300 hover:text-gray-500"><X size={16} /></button>
      </div>

      {/* 상품 */}
      {order.items?.map((item: any) => (
        <div key={item.id} className="flex gap-3 px-4 py-3 border-b border-gray-50">
          <div className="w-16 h-16 rounded-lg overflow-hidden bg-gray-100 shrink-0">
            {imgUrl(item.productImage) ? <img src={imgUrl(item.productImage)!} alt="" className="w-full h-full object-cover" /> :
              <div className="w-full h-full flex items-center justify-center"><Package size={18} className="text-gray-300" /></div>}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900 truncate">{item.productName}</p>
            <p className="text-sm font-bold text-gray-900 mt-0.5">{item.totalPrice.toLocaleString()}원</p>
            <p className="text-[11px] text-gray-400">{item.quantity}개</p>
          </div>
        </div>
      ))}

      {/* 배송 추적 - 구매확정/취소/환불 제외 항상 표시 */}
      {!['PURCHASE_CONFIRMED', 'CANCELLED', 'REFUND_REQ', 'REFUNDED'].includes(status) && (
        <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-100">
          {order.trackingNumber ? (
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5">
                <Truck size={13} className="text-tea-600" />
                <span className="text-xs text-gray-600">{order.courier} {order.trackingNumber}</span>
              </div>
              <a href={getTrackingUrl(order.courier, order.trackingNumber)} target="_blank" rel="noopener noreferrer"
                className="text-xs text-tea-600 font-medium hover:underline">배송조회</a>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 mb-2">
              <Truck size={13} className="text-gray-400" />
              <span className="text-xs text-gray-400">운송장 번호 등록 전</span>
            </div>
          )}
          <div className="flex items-center">
            {['접수', '준비', '발송', '배송중', '완료'].map((step, i) => {
              const done = status === 'DELIVERED' ? true : status === 'SHIPPING' ? i <= 3 : status === 'PREPARING' ? i <= 1 : i === 0;
              return (
                <div key={step} className="flex-1 flex flex-col items-center">
                  <div className="flex items-center w-full">
                    <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${done ? 'bg-tea-500' : 'bg-gray-200'}`} />
                    {i < 4 && <div className={`flex-1 h-0.5 ${done ? 'bg-tea-400' : 'bg-gray-200'}`} />}
                  </div>
                  <span className={`text-[9px] mt-1 ${done ? 'text-tea-700 font-medium' : 'text-gray-300'}`}>{step}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 취소/반품 사유 */}
      {order.cancelReason && ['REFUND_REQ', 'CANCELLED', 'REFUNDED'].includes(status) && (
        <div className="px-4 py-2 bg-orange-50 border-b border-orange-100">
          {order.refundType && (
            <div className="flex items-center gap-1.5 mb-1">
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${order.refundType === 'BUYER_REMORSE' ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}`}>
                {order.refundType === 'BUYER_REMORSE' ? '단순변심' : '상품문제'}
              </span>
              {order.refundType === 'BUYER_REMORSE' && <span className="text-[10px] text-amber-600">반품비 본인부담</span>}
            </div>
          )}
          <div className="flex items-start gap-1.5 text-xs text-orange-600">
            <AlertCircle size={12} className="shrink-0 mt-0.5" />
            <span>{order.cancelReason}</span>
          </div>
          {order.returnShippingCost > 0 && status === 'REFUNDED' && (
            <p className="text-[11px] text-gray-500 mt-1">반품 배송비: {order.returnShippingCost.toLocaleString()}원 ({order.returnShippingPayer === 'BUYER' ? '구매자 부담' : '판매자 부담'})</p>
          )}
          {order.refundAmount > 0 && status === 'REFUNDED' && (
            <p className="text-[11px] text-green-600 mt-0.5 font-medium">환불 금액: {order.refundAmount.toLocaleString()}원</p>
          )}
        </div>
      )}

      {/* 액션 버튼 - 상태별 명확 분리 */}
      <div className="px-4 py-2.5 flex gap-2 flex-wrap">
        {status === 'DELIVERED' && (
          <>
            <button onClick={() => onAction('confirm', order)}
              className="flex-1 py-2 rounded-lg border-2 border-tea-500 text-tea-700 text-xs font-bold hover:bg-tea-50 transition-colors">
              구매확정{earnPoints > 0 ? ` (${earnPoints}P 적립)` : ''}
            </button>
            <button onClick={() => onAction('cancel', order)}
              className="py-2 px-3 rounded-lg border border-gray-200 text-gray-500 text-xs font-medium hover:bg-gray-50">환불 신청</button>
          </>
        )}
        {status === 'PURCHASE_CONFIRMED' && !order.hasReview && (
          <button onClick={() => onAction('review', order)}
            className="flex-1 py-2 rounded-lg border-2 border-amber-400 text-amber-700 text-xs font-bold hover:bg-amber-50 transition-colors flex items-center justify-center gap-1">
            <Star size={12} /> 리뷰 작성
          </button>
        )}
        {status === 'PURCHASE_CONFIRMED' && order.hasReview && (
          <span className="flex-1 py-2 rounded-lg bg-gray-50 text-gray-400 text-xs font-medium text-center">리뷰 작성 완료</span>
        )}
        {status === 'SHIPPING' && (
          <button onClick={() => onAction('cancel', order)}
            className="flex-1 py-2 rounded-lg border border-gray-200 text-gray-500 text-xs font-medium hover:bg-gray-50">환불 신청</button>
        )}
        {['CONFIRMED', 'PREPARING'].includes(status) && (
          <button onClick={() => onAction('cancel', order)}
            className="flex-1 py-2 rounded-lg border border-gray-200 text-gray-500 text-xs font-medium hover:bg-gray-50">취소 신청</button>
        )}
        {!['CANCELLED', 'REFUND_REQ', 'REFUNDED'].includes(status) && order.store && (
          <Link href={`/store/${order.store.slug}`}
            className="py-2 px-3 rounded-lg border border-gray-200 text-gray-500 text-xs font-medium hover:bg-gray-50 flex items-center gap-1">
            판매자정보 <ChevronRight size={11} />
          </Link>
        )}
      </div>
    </div>
  );
}

function CancelModal({ order, onClose, onSubmit }: { order: any; onClose: () => void; onSubmit: (reason: string, refundType?: string) => Promise<void> }) {
  const [reason, setReason] = useState('');
  const [refundType, setRefundType] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const isRefund = ['SHIPPING', 'DELIVERED'].includes(order.status);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-md p-5 shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-gray-900">{isRefund ? '반품/환불 신청' : '취소 신청'}</h3>
          <button onClick={onClose}><X size={20} className="text-gray-400" /></button>
        </div>

        {isRefund && (
          <div className="mb-4">
            <p className="text-sm font-medium text-gray-700 mb-2">반품 사유를 선택해주세요</p>
            <div className="grid grid-cols-2 gap-2">
              <button type="button" onClick={() => setRefundType('BUYER_REMORSE')}
                className={`p-3 rounded-xl border-2 text-left transition-all ${refundType === 'BUYER_REMORSE' ? 'border-amber-500 bg-amber-50' : 'border-gray-200 hover:border-gray-300'}`}>
                <p className="text-sm font-semibold text-gray-800">단순 변심</p>
                <p className="text-[11px] text-gray-500 mt-0.5">반품 배송비 본인 부담</p>
              </button>
              <button type="button" onClick={() => setRefundType('PRODUCT_DEFECT')}
                className={`p-3 rounded-xl border-2 text-left transition-all ${refundType === 'PRODUCT_DEFECT' ? 'border-red-500 bg-red-50' : 'border-gray-200 hover:border-gray-300'}`}>
                <p className="text-sm font-semibold text-gray-800">상품 문제</p>
                <p className="text-[11px] text-gray-500 mt-0.5">파손/불량/오배송 등</p>
              </button>
            </div>
            {refundType === 'BUYER_REMORSE' && (
              <div className="mt-2 p-2.5 bg-amber-50 rounded-lg border border-amber-200">
                <p className="text-xs text-amber-700">단순 변심의 경우 반품 배송비가 환불 금액에서 차감됩니다.</p>
              </div>
            )}
          </div>
        )}

        <form onSubmit={async (e) => { e.preventDefault(); if (!reason.trim()) return; if (isRefund && !refundType) { return; } setLoading(true); await onSubmit(reason, isRefund ? refundType : undefined); setLoading(false); }} className="space-y-3">
          <textarea value={reason} onChange={(e) => setReason(e.target.value)}
            placeholder={isRefund ? '상세 사유를 입력해주세요 (상품 불량 시 증상을 구체적으로 작성해주세요)' : '취소 사유를 입력해주세요'}
            rows={3}
            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-tea-500 resize-none" />
          <div className="flex gap-2">
            <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-600 text-sm">닫기</button>
            <button type="submit" disabled={loading || !reason.trim() || (isRefund && !refundType)}
              className="flex-1 py-2.5 rounded-xl bg-red-500 text-white text-sm font-medium disabled:opacity-50">
              {loading ? '처리중...' : `${isRefund ? '반품/환불' : '취소'} 신청`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function OrdersPage() {
  const { consumer, accessToken } = useAuthStore();
  const queryClient = useQueryClient();
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

  const handleAction = async (type: string, order: any) => {
    if (type === 'cancel') { setCancelTarget(order); return; }
    if (type === 'confirm') {
      if (!confirm('구매를 확정하시겠습니까?\n\n구매확정 후에는 환불이 불가능합니다.')) return;
      try {
        const res = await consumerAuthApi.confirmOrder(order.id, accessToken!);
        toast.success(res.data.message || '구매확정 완료');
        refetch();
        queryClient.invalidateQueries({ queryKey: ['my-points'] });
      } catch (err: any) { toast.error(err?.response?.data?.error || '구매확정 실패'); }
      return;
    }
    if (type === 'review') {
      const productId = order.items?.[0]?.productId;
      if (productId) {
        window.location.href = `/review?productId=${productId}&orderId=${order.id}`;
      }
    }
  };

  const handleCancelSubmit = async (reason: string, refundType?: string) => {
    try {
      const order = cancelTarget;
      const res = await paymentApi.cancelRequest({ orderId: order.id, reason, refundType }, accessToken || undefined);
      toast.success(res.data.message);
      setCancelTarget(null);
      if (consumer) refetch();
      else setLookedUpOrder((prev: any) => ({ ...prev, status: res.data.data?.status, cancelReason: reason }));
    } catch (err: any) { toast.error(err?.response?.data?.error || '처리 실패'); }
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-16">
      <NavBar title="주문/배송내역" back={true} />

      <div className="max-w-2xl mx-auto px-4 py-4">
        {consumer && (
          <div className="flex rounded-xl bg-gray-100 p-1 mb-4">
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
          ordersLoading ? (
            <div className="space-y-3">{[1, 2].map((i) => <div key={i} className="h-40 bg-white rounded-xl animate-pulse" />)}</div>
          ) : !myOrders?.length ? (
            <div className="flex flex-col items-center justify-center h-48 bg-white rounded-xl border border-gray-100 gap-3">
              <Package size={32} className="text-gray-300" />
              <p className="text-gray-400 text-sm">주문 내역이 없습니다</p>
              <Link href="/" className="text-sm text-tea-700 hover:underline">쇼핑하러 가기</Link>
            </div>
          ) : myOrders.map((order: any) => (
            <OrderCard key={order.id} order={order} onAction={handleAction} />
          ))
        )}

        {tab === 'lookup' && (
          <div>
            <div className="bg-white rounded-xl border border-gray-100 p-4 mb-4">
              <h2 className="font-semibold text-gray-800 text-sm mb-3 flex items-center gap-1.5"><Package size={15} className="text-tea-600" /> 주문번호로 조회</h2>
              <form onSubmit={async (e) => { e.preventDefault(); setError(''); setLookedUpOrder(null); setLoading(true); try { const res = await paymentApi.lookupOrder({ orderNumber: orderNumber.trim(), phone: phone.trim() }); setLookedUpOrder(res.data.data); } catch (err: any) { setError(err?.response?.data?.error || '주문을 찾을 수 없습니다'); } finally { setLoading(false); } }} className="space-y-2">
                <input value={orderNumber} onChange={(e) => setOrderNumber(e.target.value)} placeholder="주문번호" className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-tea-500" required />
                <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="연락처" className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-tea-500" required />
                {error && <p className="text-sm text-red-500">{error}</p>}
                <button type="submit" disabled={loading} className="w-full py-2.5 rounded-lg bg-tea-700 text-white text-sm font-medium hover:bg-tea-800 disabled:opacity-50 flex items-center justify-center gap-1.5">
                  <Search size={14} /> {loading ? '조회중...' : '조회'}
                </button>
              </form>
            </div>
            {lookedUpOrder && <OrderCard order={lookedUpOrder} onAction={handleAction} />}
          </div>
        )}
      </div>

      {cancelTarget && <CancelModal order={cancelTarget} onClose={() => setCancelTarget(null)} onSubmit={handleCancelSubmit} />}
    </div>
  );
}
