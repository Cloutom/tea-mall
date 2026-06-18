'use client';

import { useQuery } from '@tanstack/react-query';
import { analyticsApi, orderApi } from '@/lib/api';
import {
  TrendingUp, TrendingDown, ShoppingBag, Package, Eye, Store,
  AlertCircle, ArrowRight, Clock
} from 'lucide-react';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? '';
const imgUrl = (p?: string | null) => p ? (p.startsWith('/') ? `${API_URL}${p}` : p) : null;
import Link from 'next/link';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { OrderStatus } from '@/types';
import { clsx } from 'clsx';
import { useAuthStore } from '@/store/authStore';

const formatKRW = (n: number) =>
  n >= 10000 ? `${(n / 10000).toFixed(1)}만원` : `${n.toLocaleString()}원`;

const STATUS_BADGE: Record<OrderStatus, { label: string; color: string }> = {
  PENDING:   { label: '주문 대기', color: 'bg-amber-100 text-amber-700' },
  CONFIRMED: { label: '주문 확인', color: 'bg-blue-100 text-blue-700' },
  PREPARING: { label: '준비중',   color: 'bg-purple-100 text-purple-700' },
  SHIPPING:  { label: '배송중',   color: 'bg-indigo-100 text-indigo-700' },
  DELIVERED: { label: '배송 완료', color: 'bg-green-100 text-green-700' },
  CANCELLED: { label: '취소',    color: 'bg-red-100 text-red-700' },
  REFUND_REQ:{ label: '환불 요청', color: 'bg-orange-100 text-orange-700' },
  REFUNDED:  { label: '환불 완료', color: 'bg-gray-100 text-gray-600' },
};

export default function DashboardPage() {
  const { seller } = useAuthStore();

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: () => analyticsApi.getDashboard().then((r) => r.data.data),
    staleTime: 5 * 60 * 1000,
  });

  const { data: chartData } = useQuery({
    queryKey: ['sales-chart', '30'],
    queryFn: () => analyticsApi.getSalesChart('30').then((r) => r.data.data),
  });

  const { data: orderSummary } = useQuery({
    queryKey: ['order-summary'],
    queryFn: () => orderApi.getSummary().then((r) => r.data.data),
  });

  if (statsLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <p className="text-gray-500 text-sm">데이터를 불러오는 중...</p>
        </div>
      </div>
    );
  }

  const statCards = [
    {
      label: '오늘 매출',
      value: formatKRW(stats?.today?.sales || 0),
      sub: `주문 ${stats?.today?.orders || 0}건`,
      icon: TrendingUp,
      iconColor: 'text-emerald-600',
      bgColor: 'bg-emerald-50',
      href: '/dashboard/analytics',
    },
    {
      label: '이번달 매출',
      value: formatKRW(stats?.month?.sales || 0),
      sub: `${stats?.month?.growth >= 0 ? '+' : ''}${stats?.month?.growth || 0}% 전월 대비`,
      icon: stats?.month?.growth >= 0 ? TrendingUp : TrendingDown,
      iconColor: stats?.month?.growth >= 0 ? 'text-blue-600' : 'text-red-500',
      bgColor: 'bg-blue-50',
      href: '/dashboard/analytics',
    },
    {
      label: '처리 대기 주문',
      value: `${stats?.totals?.pendingOrders || 0}건`,
      sub: `전체 주문 ${stats?.totals?.orders || 0}건`,
      icon: ShoppingBag,
      iconColor: 'text-amber-600',
      bgColor: 'bg-amber-50',
      href: '/dashboard/orders?status=PENDING',
      highlight: (stats?.totals?.pendingOrders || 0) > 0,
    },
    {
      label: '오늘 노출수',
      value: `${(stats?.today?.impressions || 0).toLocaleString()}`,
      sub: `이번달 ${(stats?.month?.impressions || 0).toLocaleString()}회`,
      icon: Eye,
      iconColor: 'text-purple-600',
      bgColor: 'bg-purple-50',
      href: '/dashboard/analytics',
    },
    {
      label: '판매 중 상품',
      value: `${stats?.totals?.products || 0}개`,
      sub: '클릭하여 상품 관리',
      icon: Package,
      iconColor: 'text-tea-600',
      bgColor: 'bg-tea-50',
      href: '/dashboard/products?status=active',
    },
    {
      label: '스토어 방문수',
      value: `${(stats?.totals?.storeViews || 0).toLocaleString()}`,
      sub: '누적 방문',
      icon: Store,
      iconColor: 'text-indigo-600',
      bgColor: 'bg-indigo-50',
      href: '/dashboard/analytics',
    },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      {/* 인사 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">
            안녕하세요, {seller?.name || '판매자'}님 👋
          </h1>
          <p className="text-gray-500 text-sm mt-0.5">
            {format(new Date(), 'yyyy년 M월 d일 EEEE', { locale: ko })} 현황입니다
          </p>
        </div>
        {!seller?.store && (
          <Link href="/dashboard/store" className="btn-primary py-2">
            <Store size={16} />
            스토어 만들기
          </Link>
        )}
      </div>

      {/* 주문 처리 알림 배너 */}
      {(orderSummary?.pending || 0) > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-center gap-3">
          <AlertCircle size={20} className="text-amber-600 shrink-0" />
          <div className="flex-1">
            <span className="font-medium text-amber-800">
              처리 대기 주문 {orderSummary.pending}건
            </span>
            <span className="text-amber-700 text-sm ml-2">
              + 확인 중 {orderSummary.confirmed}건
            </span>
          </div>
          <Link href="/dashboard/orders?status=PENDING" className="text-sm font-medium text-amber-700 hover:underline flex items-center gap-1">
            확인하기 <ArrowRight size={14} />
          </Link>
        </div>
      )}

      {/* 통계 카드 */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
        {statCards.map((card) => (
          <Link key={card.label} href={card.href}
            className={clsx('stat-card group cursor-pointer transition-all hover:shadow-md hover:-translate-y-0.5',
              card.highlight && 'ring-2 ring-amber-400')}>
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-medium text-gray-500">{card.label}</p>
                <p className="text-xl sm:text-2xl font-bold text-gray-900 mt-1">{card.value}</p>
                <p className="text-xs text-gray-400 mt-1 flex items-center gap-1">
                  {card.sub}
                  <ArrowRight size={10} className="opacity-0 group-hover:opacity-100 transition-opacity" />
                </p>
              </div>
              <div className={`p-2.5 rounded-xl ${card.bgColor}`}>
                <card.icon size={18} className={card.iconColor} />
              </div>
            </div>
          </Link>
        ))}
      </div>

      {/* 매출 차트 + 최근 주문 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* 매출 차트 */}
        <div className="card lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-900">최근 30일 매출</h2>
            <Link href="/dashboard/analytics" className="text-sm text-tea-600 hover:underline flex items-center gap-1">
              자세히 <ArrowRight size={14} />
            </Link>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={chartData || []}>
              <defs>
                <linearGradient id="salesGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#2D6A4F" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#2D6A4F" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis
                dataKey="date"
                tickFormatter={(v) => format(new Date(v), 'M/d')}
                tick={{ fontSize: 11, fill: '#9ca3af' }}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                tickFormatter={(v) => v >= 10000 ? `${(v / 10000).toFixed(0)}만` : v.toString()}
                tick={{ fontSize: 11, fill: '#9ca3af' }}
                tickLine={false}
                axisLine={false}
                width={40}
              />
              <Tooltip
                formatter={(v: number) => [`${v.toLocaleString()}원`, '매출']}
                labelFormatter={(l) => format(new Date(l), 'M월 d일')}
                contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e5e7eb' }}
              />
              <Area
                type="monotone"
                dataKey="sales"
                stroke="#2D6A4F"
                strokeWidth={2}
                fill="url(#salesGradient)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* 최근 주문 */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-900">최근 주문</h2>
            <Link href="/dashboard/orders" className="text-sm text-tea-600 hover:underline flex items-center gap-1">
              전체 <ArrowRight size={14} />
            </Link>
          </div>
          <div className="space-y-3">
            {stats?.recentOrders?.length ? (
              stats.recentOrders.map((order: any) => (
                <Link
                  key={order.id}
                  href={`/dashboard/orders/${order.id}`}
                  className="flex items-start gap-3 p-2.5 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <div className="w-8 h-8 bg-tea-100 rounded-lg flex items-center justify-center shrink-0">
                    <ShoppingBag size={14} className="text-tea-600" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold text-gray-900 truncate">
                      {order.items?.[0]?.product?.name || '상품'}
                      {order.items?.length > 1 && ` 외 ${order.items.length - 1}건`}
                    </p>
                    <p className="text-xs text-gray-500">{order.buyerName}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className={clsx('badge-status', STATUS_BADGE[order.status as OrderStatus]?.color)}>
                        {STATUS_BADGE[order.status as OrderStatus]?.label}
                      </span>
                    </div>
                  </div>
                  <p className="text-xs font-bold text-gray-900 shrink-0">
                    {order.finalAmount.toLocaleString()}원
                  </p>
                </Link>
              ))
            ) : (
              <div className="text-center py-8 text-gray-400 text-sm">
                <ShoppingBag size={32} className="mx-auto mb-2 text-gray-200" />
                주문이 없습니다
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 인기 상품 */}
      {stats?.topProducts?.length > 0 && (
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-900">인기 상품 Top 5</h2>
            <Link href="/dashboard/analytics" className="text-sm text-tea-600 hover:underline flex items-center gap-1">
              분석 보기 <ArrowRight size={14} />
            </Link>
          </div>
          <div className="space-y-3">
            {stats.topProducts.map((product: any, index: number) => (
              <div key={product.id} className="flex items-center gap-4">
                <span className={clsx(
                  'w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0',
                  index === 0 ? 'bg-gold-500 text-white' :
                  index === 1 ? 'bg-gray-300 text-gray-700' :
                  index === 2 ? 'bg-amber-700 text-white' :
                  'bg-gray-100 text-gray-500'
                )}>
                  {index + 1}
                </span>
                <div className="w-10 h-10 bg-gray-100 rounded-lg overflow-hidden shrink-0">
                  {product.thumbnail ? (
                    <img src={imgUrl(product.thumbnail)!} alt={product.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full bg-gray-100" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{product.name}</p>
                  <p className="text-xs text-gray-400">{product.totalViews.toLocaleString()} 조회</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-bold text-gray-900">{formatKRW(product.totalRevenue)}</p>
                  <p className="text-xs text-gray-400">{product.totalSales}판매</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
