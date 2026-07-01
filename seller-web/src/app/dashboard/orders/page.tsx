'use client';

import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { orderApi, courierApi } from '@/lib/api';
import { Order, OrderStatus } from '@/types';
import {
  Search, ChevronLeft, ChevronRight, Package, Truck,
  CheckCircle, XCircle, RefreshCw, Clock, Loader2, AlertTriangle,
  CheckSquare, Square, ChevronDown, Zap, Printer,
} from 'lucide-react';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { clsx } from 'clsx';
import toast from 'react-hot-toast';

const STATUS_CONFIG: Record<OrderStatus, { label: string; color: string; icon: any }> = {
  PENDING:    { label: '주문 대기',  color: 'bg-amber-100 text-amber-700 border-amber-200',    icon: Clock },
  CONFIRMED:  { label: '주문 확인',  color: 'bg-blue-100 text-blue-700 border-blue-200',      icon: CheckCircle },
  PREPARING:  { label: '준비중',    color: 'bg-purple-100 text-purple-700 border-purple-200',  icon: Package },
  SHIPPING:   { label: '배송중',    color: 'bg-indigo-100 text-indigo-700 border-indigo-200',  icon: Truck },
  DELIVERED:  { label: '배송 완료',  color: 'bg-green-100 text-green-700 border-green-200',   icon: CheckCircle },
  PURCHASE_CONFIRMED: { label: '구매확정', color: 'bg-tea-100 text-tea-700 border-tea-200', icon: CheckCircle },
  CANCELLED:  { label: '취소',      color: 'bg-red-100 text-red-700 border-red-200',          icon: XCircle },
  REFUND_REQ: { label: '환불 요청',  color: 'bg-orange-100 text-orange-700 border-orange-200', icon: AlertTriangle },
  REFUNDED:   { label: '환불 완료',  color: 'bg-gray-100 text-gray-600 border-gray-200',       icon: RefreshCw },
};

const STATUS_TABS = [
  { value: '', label: '전체' },
  { value: 'PENDING', label: '주문 대기' },
  { value: 'CONFIRMED', label: '주문 확인' },
  { value: 'PREPARING', label: '준비중' },
  { value: 'SHIPPING', label: '배송중' },
  { value: 'DELIVERED', label: '배송 완료' },
  { value: 'REFUND_REQ', label: '취소/환불요청' },
  { value: 'CANCELLED', label: '취소/환불완료' },
];

const NEXT_STATUS: Partial<Record<OrderStatus, { status: string; label: string }>> = {
  PENDING:   { status: 'CONFIRMED', label: '주문 확인' },
  CONFIRMED: { status: 'PREPARING', label: '준비 시작' },
  PREPARING: { status: 'SHIPPING', label: '배송 시작' },
};

// 일괄 처리 가능한 상태별 액션
const BULK_ACTIONS: Record<string, { status: string; label: string; color: string; icon: any }[]> = {
  PENDING:   [
    { status: 'CONFIRMED', label: '주문 확인', color: 'bg-blue-600 hover:bg-blue-700 text-white', icon: CheckCircle },
    { status: 'CANCELLED', label: '주문 취소', color: 'bg-red-500 hover:bg-red-600 text-white', icon: XCircle },
  ],
  CONFIRMED: [
    { status: 'PREPARING', label: '준비 시작', color: 'bg-purple-600 hover:bg-purple-700 text-white', icon: Package },
    { status: 'SHIPPING',  label: '배송 시작', color: 'bg-indigo-600 hover:bg-indigo-700 text-white', icon: Truck },
    { status: 'CANCELLED', label: '주문 취소', color: 'bg-red-500 hover:bg-red-600 text-white', icon: XCircle },
  ],
  PREPARING: [
    { status: 'SHIPPING',  label: '배송 시작', color: 'bg-indigo-600 hover:bg-indigo-700 text-white', icon: Truck },
  ],
  SHIPPING: [
    { status: 'DELIVERED', label: '배송 완료', color: 'bg-green-600 hover:bg-green-700 text-white', icon: CheckCircle },
  ],
  MIXED: [
    { status: 'CONFIRMED', label: '주문 확인', color: 'bg-blue-600 hover:bg-blue-700 text-white', icon: CheckCircle },
    { status: 'CANCELLED', label: '선택 취소', color: 'bg-red-500 hover:bg-red-600 text-white', icon: XCircle },
  ],
};

const COURIERS = ['CJ대한통운', '한진택배', '롯데택배', '우체국택배', '로젠택배', '쿠팡로켓', '직접배송'];

export default function OrdersPage() {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // 단건 상태 변경 모달
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [trackingInput, setTrackingInput] = useState({ trackingNumber: '', courier: 'CJ대한통운' });
  const [showTrackingModal, setShowTrackingModal] = useState(false);
  const [refundTarget, setRefundTarget] = useState<Order | null>(null);
  const [refundReason, setRefundReason] = useState('');
  const [returnShippingCost, setReturnShippingCost] = useState('');

  // 일괄 배송 모달
  const [showBulkShipModal, setShowBulkShipModal] = useState(false);
  const [bulkTracking, setBulkTracking] = useState({ trackingNumber: '', courier: 'CJ대한통운' });

  const { data, isLoading } = useQuery({
    queryKey: ['orders', { statusFilter, search, page }],
    queryFn: () => orderApi.getOrders({ status: statusFilter, search, page, limit: 20 }).then((r) => r.data),
  });

  const { data: refundCountData } = useQuery({
    queryKey: ['orders-refund-count'],
    queryFn: () => orderApi.getOrders({ status: 'REFUND_REQ', limit: 1 }).then((r) => r.data.pagination?.total || 0),
    refetchInterval: 30000,
  });
  const refundCount = typeof refundCountData === 'number' ? refundCountData : 0;

  const orders: Order[] = data?.data || [];
  const pagination = data?.pagination;

  // 선택된 주문들의 상태 분석
  const selectedOrders = orders.filter((o) => selectedIds.has(o.id));
  const selectedStatuses = Array.from(new Set(selectedOrders.map((o) => o.status)));
  const commonStatus = selectedStatuses.length === 1 ? selectedStatuses[0] : 'MIXED';
  const bulkActions = BULK_ACTIONS[commonStatus] || [];

  // 각 목표 상태로 전환 가능한 주문 수 계산
  const VALID_FROM: Record<string, string[]> = {
    CONFIRMED:  ['PENDING'],
    PREPARING:  ['CONFIRMED'],
    SHIPPING:   ['CONFIRMED', 'PREPARING'],
    DELIVERED:  ['SHIPPING'],
    CANCELLED:  ['PENDING', 'CONFIRMED', 'PREPARING'],
  };
  const eligibleCount = (targetStatus: string) =>
    selectedOrders.filter((o) => (VALID_FROM[targetStatus] || []).includes(o.status)).length;

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['orders'] });
    queryClient.invalidateQueries({ queryKey: ['order-summary'] });
    queryClient.invalidateQueries({ queryKey: ['orders-refund-count'] });
  };

  const updateStatusMutation = useMutation({
    mutationFn: ({ id, ...data }: { id: string; status: string; trackingNumber?: string; courier?: string }) =>
      orderApi.updateStatus(id, data),
    onSuccess: () => { invalidate(); toast.success('상태가 변경되었습니다.'); setShowTrackingModal(false); },
    onError: () => toast.error('상태 변경에 실패했습니다.'),
  });

  const bulkStatusMutation = useMutation({
    mutationFn: (data: object) => orderApi.bulkStatusUpdate(data),
    onSuccess: (res: any) => {
      invalidate();
      setSelectedIds(new Set());
      setShowBulkShipModal(false);
      setBulkTracking({ trackingNumber: '', courier: 'CJ대한통운' });
      toast.success(res.data?.message || '일괄 처리 완료');
    },
    onError: (err: any) => toast.error(err?.response?.data?.error || '일괄 처리 실패'),
  });

  const autoTrackingMutation = useMutation({
    mutationFn: (data: { orderIds: string[]; courierAccountId?: string }) => orderApi.autoTracking(data),
    onSuccess: (res: any) => {
      invalidate();
      setSelectedIds(new Set());
      toast.success(res.data?.message || '운송장 자동 발급 완료');
    },
    onError: (err: any) => toast.error(err?.response?.data?.error || '운송장 발급 실패'),
  });

  const { data: courierAccounts } = useQuery({
    queryKey: ['courier-accounts'],
    queryFn: () => courierApi.getAccounts().then((r: any) => r.data.data),
  });

  const handleAutoTracking = () => {
    const eligible = selectedOrders.filter(o => ['CONFIRMED', 'PREPARING'].includes(o.status));
    if (eligible.length === 0) { toast.error('발급 가능한 주문이 없습니다. (주문확인/준비중 상태만 가능)'); return; }
    if (!courierAccounts?.length) { toast.error('등록된 택배사가 없습니다. 배송 관리에서 택배사를 먼저 등록해주세요.'); return; }
    if (confirm(`${eligible.length}건에 운송장을 자동 발급하고 배송 시작 처리하시겠습니까?`)) {
      autoTrackingMutation.mutate({ orderIds: eligible.map(o => o.id) });
    }
  };

  const handlePrintLabels = async () => {
    const ids = selectedIds.size > 0 ? Array.from(selectedIds) : orders.filter(o => o.trackingNumber).map(o => o.id);
    if (ids.length === 0) { toast.error('출력할 주문을 선택해주세요.'); return; }
    try {
      const res = await orderApi.getShippingLabels(ids);
      const labels = res.data.data;
      if (!labels?.length) { toast.error('출력할 송장 데이터가 없습니다.'); return; }
      const w = window.open('', '_blank', 'width=800,height=600');
      if (!w) { toast.error('팝업이 차단되었습니다. 팝업을 허용해주세요.'); return; }
      w.document.write(buildLabelHtml(labels));
      w.document.close();
      w.onload = () => w.print();
    } catch { toast.error('송장 데이터 조회 실패'); }
  };

  const processRefundMutation = useMutation({
    mutationFn: ({ id, cancelReason, returnShippingCost }: { id: string; cancelReason: string; returnShippingCost?: number }) =>
      orderApi.processRefund(id, { cancelReason, returnShippingCost }),
    onSuccess: () => {
      invalidate();
      toast.success('환불/취소 처리가 완료되었습니다.');
      setRefundTarget(null);
      setRefundReason('');
      setReturnShippingCost('');
    },
    onError: (err: any) => toast.error(err?.response?.data?.error || '처리에 실패했습니다.'),
  });

  // 체크박스 토글
  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === orders.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(orders.map((o) => o.id)));
    }
  };

  const clearSelection = () => setSelectedIds(new Set());

  const handleStatusChange = (order: Order, newStatus: string) => {
    if (newStatus === 'SHIPPING') {
      setSelectedOrder(order);
      setShowTrackingModal(true);
      return;
    }
    if (confirm(`"${STATUS_CONFIG[newStatus as OrderStatus]?.label}"으로 변경하시겠습니까?`)) {
      updateStatusMutation.mutate({ id: order.id, status: newStatus });
    }
  };

  const handleBulkAction = (status: string) => {
    if (selectedIds.size === 0) return;
    const count = eligibleCount(status);
    if (count === 0) { toast.error('처리 가능한 주문이 없습니다.'); return; }
    if (status === 'SHIPPING') { setShowBulkShipModal(true); return; }
    const label = STATUS_CONFIG[status as OrderStatus]?.label || status;
    const skipped = selectedIds.size - count;
    const msg = skipped > 0
      ? `${count}건을 "${label}"으로 처리합니다.\n(이미 처리된 ${skipped}건은 건너뜁니다)\n\n계속하시겠습니까?`
      : `선택한 ${count}건을 "${label}"으로 일괄 처리하시겠습니까?`;
    if (confirm(msg)) {
      bulkStatusMutation.mutate({ orderIds: Array.from(selectedIds), status });
    }
  };

  const handleBulkShipSubmit = () => {
    if (!bulkTracking.trackingNumber.trim()) { toast.error('송장번호를 입력해주세요.'); return; }
    bulkStatusMutation.mutate({
      orderIds: Array.from(selectedIds),
      status: 'SHIPPING',
      trackingNumber: bulkTracking.trackingNumber,
      courier: bulkTracking.courier,
    });
  };

  return (
    <div className="space-y-5 animate-fade-in pb-28">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">주문 관리</h1>
          <p className="text-gray-500 text-sm mt-0.5">전체 {pagination?.total || 0}건</p>
        </div>
        {refundCount > 0 && (
          <button onClick={() => { setStatusFilter('REFUND_REQ'); setPage(1); }}
            className="flex items-center gap-2 px-3 py-1.5 bg-orange-50 border border-orange-200 text-orange-700 rounded-lg text-sm font-medium hover:bg-orange-100 transition-colors">
            <AlertTriangle size={15} />
            취소/환불 요청 {refundCount}건
          </button>
        )}
      </div>

      {/* 상태 탭 */}
      <div className="card py-0 overflow-hidden">
        <div className="flex overflow-x-auto">
          {STATUS_TABS.map((tab) => (
            <button key={tab.value}
              onClick={() => { setStatusFilter(tab.value); setPage(1); setSelectedIds(new Set()); }}
              className={clsx(
                'px-4 py-3.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors relative',
                statusFilter === tab.value
                  ? 'border-tea-600 text-tea-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              )}>
              {tab.label}
              {tab.value === 'REFUND_REQ' && refundCount > 0 && (
                <span className="absolute -top-0.5 right-0.5 w-4 h-4 bg-orange-500 text-white text-[9px] rounded-full flex items-center justify-center font-bold">
                  {refundCount > 9 ? '9+' : refundCount}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* 검색 + 전체 선택 행 */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder="주문번호, 구매자명, 연락처 검색"
            className="input-base pl-9" />
        </div>
        {orders.length > 0 && (
          <button onClick={toggleSelectAll}
            className="flex items-center gap-1.5 px-3 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
            {selectedIds.size === orders.length && orders.length > 0
              ? <CheckSquare size={15} className="text-tea-600" />
              : <Square size={15} />}
            전체 선택
          </button>
        )}
        {selectedIds.size > 0 && (
          <span className="text-sm text-tea-700 font-medium">{selectedIds.size}건 선택됨</span>
        )}
      </div>

      <div className="space-y-3">
        {isLoading ? (
          Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="card animate-pulse"><div className="h-4 bg-gray-100 rounded w-1/4 mb-3" /><div className="h-3 bg-gray-100 rounded w-1/2" /></div>
          ))
        ) : orders.length === 0 ? (
          <div className="card text-center py-16"><Package size={40} className="mx-auto text-gray-200 mb-3" /><p className="text-gray-400 text-sm">주문이 없습니다</p></div>
        ) : (
          orders.map((order) => {
            const statusConf = STATUS_CONFIG[order.status];
            const nextStatus = NEXT_STATUS[order.status];
            const isRefundReq = order.status === 'REFUND_REQ';
            const isSelected = selectedIds.has(order.id);

            return (
              <div key={order.id}
                className={clsx(
                  'card hover:shadow-md transition-all cursor-pointer select-none',
                  isSelected && 'ring-2 ring-tea-500 bg-tea-50/30',
                  isRefundReq && !isSelected && 'border-orange-200 bg-orange-50/30',
                )}>
                {/* 헤더 행 */}
                <div className="flex items-start gap-3 mb-4">
                  {/* 체크박스 */}
                  <button onClick={(e) => { e.stopPropagation(); toggleSelect(order.id); }}
                    className="mt-0.5 shrink-0 text-gray-400 hover:text-tea-600 transition-colors">
                    {isSelected
                      ? <CheckSquare size={18} className="text-tea-600" />
                      : <Square size={18} />}
                  </button>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="font-bold text-gray-900 text-sm">{order.orderNumber}</span>
                      <span className={clsx('badge-status border', statusConf.color)}>
                        <statusConf.icon size={11} className="mr-1" />
                        {statusConf.label}
                      </span>
                    </div>
                    <p className="text-xs text-gray-400">
                      {format(new Date(order.createdAt), 'yyyy.MM.dd HH:mm', { locale: ko })}
                    </p>
                  </div>

                  <div className="text-right shrink-0">
                    <p className="font-bold text-gray-900">{order.finalAmount.toLocaleString()}원</p>
                    {order.shippingFee > 0 && (
                      <p className="text-xs text-gray-400">배송비 {order.shippingFee.toLocaleString()}원 포함</p>
                    )}
                    <p className="text-xs text-gray-400">{order.paymentMethod || '-'}</p>
                  </div>
                </div>

                {/* 상품 목록 */}
                <div className="space-y-2 mb-4 ml-7">
                  {order.items.map((item) => (
                    <div key={item.id} className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-gray-100 rounded-lg overflow-hidden shrink-0">
                        {item.productImage
                          ? <img src={item.productImage} alt={item.productName} className="w-full h-full object-cover" />
                          : <div className="w-full h-full bg-gray-200" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{item.productName}</p>
                        <p className="text-xs text-gray-500">{item.quantity}개 × {item.unitPrice.toLocaleString()}원</p>
                      </div>
                      <p className="text-sm font-bold text-gray-900 shrink-0">{item.totalPrice.toLocaleString()}원</p>
                    </div>
                  ))}
                </div>

                {/* 배송지 정보 */}
                <div className="bg-gray-50 rounded-lg p-3 mb-4 ml-7 grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-gray-600">
                  <div><span className="text-gray-400">구매자</span> {order.buyerName} ({order.buyerPhone})</div>
                  <div><span className="text-gray-400">수령인</span> {order.recipientName} ({order.recipientPhone})</div>
                  <div className="col-span-2"><span className="text-gray-400">주소</span> {order.address} {order.addressDetail}</div>
                  {(order as any).deliveryMemo && (
                    <div className="col-span-2 text-tea-700"><span className="text-gray-400">메모</span> {(order as any).deliveryMemo}</div>
                  )}
                  {order.trackingNumber && (
                    <div className="col-span-2 text-indigo-600"><span className="text-gray-400">송장</span> {order.courier} {order.trackingNumber}</div>
                  )}
                  {(order as any).refundType && (
                    <div className="col-span-2">
                      <span className="text-gray-400">반품유형</span>{' '}
                      <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${(order as any).refundType === 'BUYER_REMORSE' ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}`}>
                        {(order as any).refundType === 'BUYER_REMORSE' ? '단순변심 (구매자 반품비 부담)' : '상품문제 (판매자 부담)'}
                      </span>
                    </div>
                  )}
                  {(order as any).cancelReason && (
                    <div className="col-span-2 text-orange-600"><span className="text-gray-400">취소사유</span> {(order as any).cancelReason}</div>
                  )}
                </div>

                {/* 단건 액션 버튼 */}
                <div className="flex items-center gap-2 flex-wrap ml-7">
                  {nextStatus && !isRefundReq && (
                    <button onClick={(e) => { e.stopPropagation(); handleStatusChange(order, nextStatus.status); }}
                      disabled={updateStatusMutation.isPending}
                      className="btn-primary py-1.5 px-3 text-sm">
                      {updateStatusMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <Truck size={14} />}
                      {nextStatus.label}
                    </button>
                  )}
                  {order.status === 'PENDING' && (
                    <button onClick={(e) => { e.stopPropagation(); if (confirm('주문을 취소하시겠습니까?')) updateStatusMutation.mutate({ id: order.id, status: 'CANCELLED' }); }}
                      className="btn-danger py-1.5 px-3 text-sm">
                      <XCircle size={14} /> 주문 취소
                    </button>
                  )}
                  {isRefundReq && (
                    <button onClick={(e) => { e.stopPropagation(); setRefundTarget(order); setRefundReason((order as any).cancelReason || ''); }}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors">
                      <RefreshCw size={14} /> 환불/취소 승인
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {pagination && pagination.totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}
            className="p-2 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-40">
            <ChevronLeft size={16} />
          </button>
          <span className="text-sm text-gray-600">{page} / {pagination.totalPages}</span>
          <button onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))} disabled={page === pagination.totalPages}
            className="p-2 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-40">
            <ChevronRight size={16} />
          </button>
        </div>
      )}

      {/* ─── 일괄 처리 플로팅 바 ─────────────────────────────────────────── */}
      {selectedIds.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 w-[calc(100%-2rem)] max-w-3xl">
          <div className="bg-gray-900 text-white rounded-2xl shadow-2xl px-5 py-4 flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2 shrink-0">
              <CheckSquare size={18} className="text-tea-400" />
              <span className="font-semibold text-sm">{selectedIds.size}건 선택</span>
            </div>
            <div className="flex-1 flex items-center gap-2 flex-wrap">
              {bulkActions.map((action) => {
                const count = eligibleCount(action.status);
                const disabled = bulkStatusMutation.isPending || count === 0;
                return (
                  <button key={action.status}
                    onClick={() => handleBulkAction(action.status)}
                    disabled={disabled}
                    title={count === 0 ? '처리 가능한 주문이 없습니다' : undefined}
                    className={clsx('flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed', action.color)}>
                    {bulkStatusMutation.isPending ? <Loader2 size={13} className="animate-spin" /> : <action.icon size={13} />}
                    일괄 {action.label}
                    {count < selectedIds.size && count > 0 && (
                      <span className="ml-0.5 text-xs opacity-80">({count}건)</span>
                    )}
                  </button>
                );
              })}
              <button onClick={handleAutoTracking}
                disabled={autoTrackingMutation.isPending}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium bg-emerald-600 hover:bg-emerald-700 text-white transition-colors disabled:opacity-40">
                {autoTrackingMutation.isPending ? <Loader2 size={13} className="animate-spin" /> : <Zap size={13} />}
                운송장 자동발급
              </button>
              <button onClick={handlePrintLabels}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium bg-gray-700 hover:bg-gray-600 text-white transition-colors">
                <Printer size={13} /> 송장 출력
              </button>
            </div>
            <button onClick={clearSelection}
              className="text-gray-400 hover:text-white text-sm shrink-0 transition-colors">
              선택 해제
            </button>
          </div>
        </div>
      )}

      {/* 단건 배송 정보 모달 */}
      {showTrackingModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <h3 className="font-bold text-gray-900 text-lg mb-4 flex items-center gap-2">
              <Truck size={20} className="text-tea-600" /> 배송 정보 입력
            </h3>
            <div className="space-y-4">
              <div>
                <label className="label-base">택배사</label>
                <select value={trackingInput.courier}
                  onChange={(e) => setTrackingInput((p) => ({ ...p, courier: e.target.value }))}
                  className="input-base">
                  {COURIERS.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="label-base">송장번호 *</label>
                <input value={trackingInput.trackingNumber}
                  onChange={(e) => setTrackingInput((p) => ({ ...p, trackingNumber: e.target.value }))}
                  placeholder="송장번호 입력" className="input-base" />
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={() => setShowTrackingModal(false)} className="btn-secondary flex-1">취소</button>
              <button onClick={() => {
                if (!trackingInput.trackingNumber.trim()) { toast.error('송장번호를 입력해주세요.'); return; }
                updateStatusMutation.mutate({ id: selectedOrder!.id, status: 'SHIPPING', ...trackingInput });
              }} disabled={updateStatusMutation.isPending} className="btn-primary flex-1">
                {updateStatusMutation.isPending ? <Loader2 size={16} className="animate-spin" /> : <Truck size={16} />}
                배송 시작
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 일괄 배송 모달 */}
      {showBulkShipModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <h3 className="font-bold text-gray-900 text-lg mb-1 flex items-center gap-2">
              <Truck size={20} className="text-indigo-600" /> 일괄 배송 시작
            </h3>
            {(() => {
              const count = eligibleCount('SHIPPING');
              const skipped = selectedIds.size - count;
              return (
                <p className="text-sm text-gray-500 mb-4">
                  {count}건에 배송 정보를 적용합니다
                  {skipped > 0 && <span className="text-amber-600"> · 배송 불가 {skipped}건 제외</span>}
                </p>
              );
            })()}
            <div className="space-y-4">
              <div>
                <label className="label-base">택배사</label>
                <select value={bulkTracking.courier}
                  onChange={(e) => setBulkTracking((p) => ({ ...p, courier: e.target.value }))}
                  className="input-base">
                  {COURIERS.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="label-base">송장번호 *</label>
                <input value={bulkTracking.trackingNumber}
                  onChange={(e) => setBulkTracking((p) => ({ ...p, trackingNumber: e.target.value }))}
                  placeholder="송장번호 입력" className="input-base" />
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={() => setShowBulkShipModal(false)} className="btn-secondary flex-1">취소</button>
              <button onClick={handleBulkShipSubmit} disabled={bulkStatusMutation.isPending} className="btn-primary flex-1">
                {bulkStatusMutation.isPending ? <Loader2 size={16} className="animate-spin" /> : <Truck size={16} />}
                {eligibleCount('SHIPPING')}건 배송 시작
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 환불/취소 승인 모달 */}
      {refundTarget && (() => {
        const rt = refundTarget as any;
        const isBuyerRemorse = rt.refundType === 'BUYER_REMORSE';
        const isProductDefect = rt.refundType === 'PRODUCT_DEFECT';
        const shipCost = Number(returnShippingCost) || 0;
        const estimatedRefund = isBuyerRemorse
          ? Math.max(0, refundTarget.finalAmount - shipCost)
          : refundTarget.finalAmount;

        return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <h3 className="font-bold text-gray-900 text-lg mb-1 flex items-center gap-2">
              <RefreshCw size={20} className="text-orange-500" /> 환불/취소 승인
            </h3>
            <p className="text-sm text-gray-500 mb-4">승인 시 Toss 결제가 자동으로 취소되고 카드사에 환불됩니다.</p>

            <div className="bg-orange-50 rounded-xl p-3 mb-4 text-sm">
              <p className="font-medium text-gray-900">{refundTarget.orderNumber}</p>
              <p className="text-gray-600 mt-1">결제금액: {refundTarget.finalAmount.toLocaleString()}원</p>
              {rt.refundType && (
                <div className="flex items-center gap-2 mt-2">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${isBuyerRemorse ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}`}>
                    {isBuyerRemorse ? '단순변심' : '상품문제'}
                  </span>
                  <span className="text-xs text-gray-500">
                    반품비: {isBuyerRemorse ? '구매자 부담' : '판매자 부담'}
                  </span>
                </div>
              )}
              {rt.cancelReason && (
                <p className="text-orange-700 mt-2 text-xs">고객 사유: {rt.cancelReason}</p>
              )}
            </div>

            <div className="space-y-3">
              {isBuyerRemorse && (
                <div>
                  <label className="label-base">반품 배송비 (구매자 부담)</label>
                  <input type="number" value={returnShippingCost}
                    onChange={(e) => setReturnShippingCost(e.target.value)}
                    placeholder="예: 3000" className="input-base" />
                  {shipCost > 0 && (
                    <p className="text-xs text-amber-600 mt-1">
                      환불 예상 금액: {estimatedRefund.toLocaleString()}원 (결제 {refundTarget.finalAmount.toLocaleString()} - 반품비 {shipCost.toLocaleString()})
                    </p>
                  )}
                </div>
              )}
              {isProductDefect && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-2.5 text-xs text-red-700">
                  상품 문제로 인한 반품입니다. 반품 배송비는 판매자 부담이며, 전액 환불됩니다.
                </div>
              )}
              <div>
                <label className="label-base">처리 사유 (내부 메모)</label>
                <textarea value={refundReason} onChange={(e) => setRefundReason(e.target.value)}
                  placeholder="환불/취소 처리 사유를 입력해주세요"
                  className="input-base h-20 resize-none" />
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={() => { setRefundTarget(null); setRefundReason(''); setReturnShippingCost(''); }} className="btn-secondary flex-1">취소</button>
              <button onClick={() => {
                if (!refundReason.trim()) { toast.error('처리 사유를 입력해주세요.'); return; }
                processRefundMutation.mutate({
                  id: refundTarget.id,
                  cancelReason: refundReason,
                  returnShippingCost: shipCost || undefined,
                });
              }}
                disabled={processRefundMutation.isPending}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-orange-500 text-white rounded-xl hover:bg-orange-600 transition-colors disabled:opacity-50 text-sm font-medium">
                {processRefundMutation.isPending ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
                {estimatedRefund.toLocaleString()}원 환불
              </button>
            </div>
          </div>
        </div>
        );
      })()}
    </div>
  );
}

function buildLabelHtml(labels: any[]): string {
  const labelCards = labels.map((l: any) => `
    <div class="label">
      <div class="header">
        <div class="courier">${l.courier || '택배'}</div>
        <div class="tracking">${l.trackingNumber || '미발급'}</div>
      </div>
      <div class="section">
        <div class="row">
          <div class="col">
            <div class="title">보내는 분</div>
            <div class="name">${l.sender.name}</div>
            <div class="info">${l.sender.phone}</div>
            <div class="info">${l.sender.zipCode ? '[' + l.sender.zipCode + '] ' : ''}${l.sender.address}</div>
          </div>
        </div>
        <div class="divider"></div>
        <div class="row">
          <div class="col">
            <div class="title">받는 분</div>
            <div class="name recv">${l.receiver.name}</div>
            <div class="info">${l.receiver.phone}</div>
            <div class="info">${l.receiver.zipCode ? '[' + l.receiver.zipCode + '] ' : ''}${l.receiver.address}</div>
            ${l.memo ? '<div class="memo">배송메모: ' + l.memo + '</div>' : ''}
          </div>
        </div>
        <div class="divider"></div>
        <div class="row">
          <div class="col">
            <div class="title">상품정보</div>
            ${l.items.map((item: any) => '<div class="info">' + item.name + ' x ' + item.qty + '</div>').join('')}
          </div>
          <div class="amount">${l.totalAmount.toLocaleString()}원</div>
        </div>
        <div class="order-num">주문번호: ${l.orderNumber}</div>
      </div>
    </div>
  `).join('');

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>송장 출력</title>
<style>
  @page { size: 100mm 150mm; margin: 0; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Malgun Gothic', sans-serif; }
  .label { width: 100mm; height: 150mm; padding: 4mm; page-break-after: always; border: 1px solid #ccc; }
  .header { display: flex; justify-content: space-between; align-items: center; padding: 3mm 2mm; border: 2px solid #000; margin-bottom: 3mm; }
  .courier { font-size: 16pt; font-weight: bold; }
  .tracking { font-size: 12pt; font-weight: bold; letter-spacing: 1px; }
  .section { border: 1px solid #999; }
  .row { padding: 2.5mm 3mm; display: flex; justify-content: space-between; align-items: flex-start; }
  .col { flex: 1; }
  .title { font-size: 7pt; color: #666; margin-bottom: 1mm; text-transform: uppercase; letter-spacing: 0.5px; }
  .name { font-size: 11pt; font-weight: bold; margin-bottom: 1mm; }
  .recv { font-size: 13pt; }
  .info { font-size: 8.5pt; color: #333; line-height: 1.5; }
  .memo { font-size: 8pt; color: #c00; margin-top: 1.5mm; font-weight: 500; }
  .divider { border-top: 1px dashed #aaa; }
  .amount { font-size: 11pt; font-weight: bold; white-space: nowrap; padding-top: 4mm; }
  .order-num { font-size: 7pt; color: #888; text-align: right; padding: 1.5mm 3mm; border-top: 1px solid #ddd; }
  @media print { .label { border: none; } }
</style></head><body>${labelCards}</body></html>`;
}