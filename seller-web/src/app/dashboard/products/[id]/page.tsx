'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { productApi } from '@/lib/api';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import toast from 'react-hot-toast';
import {
  ChevronLeft, Edit2, Eye, EyeOff, Package, Loader2,
  Tag, Thermometer, Clock, MapPin, Zap, Box, Star, Leaf, Wind,
  AlertCircle,
} from 'lucide-react';
import { clsx } from 'clsx';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? '';
const imgUrl = (p: string) => p?.startsWith('/') ? `${API_URL}${p}` : p;

const CAFFEINE_LABEL: Record<string, string> = { high: '높음', medium: '중간', low: '낮음', none: '없음' };
const BODY_LABEL: Record<string, string> = { light: '가벼움', medium: '중간', full: '진함' };

const FLAVOR_LABELS = [
  { key: 'flavorBitter',     label: '쓴맛',    color: 'bg-gray-600' },
  { key: 'flavorSweet',      label: '단맛',    color: 'bg-amber-400' },
  { key: 'flavorAstringent', label: '떫은맛',  color: 'bg-green-600' },
  { key: 'flavorSavory',     label: '구수한맛', color: 'bg-yellow-600' },
  { key: 'flavorFloral',     label: '꽃향미',  color: 'bg-pink-400' },
];

function InfoItem({ label, value, icon }: { label: string; value?: string | null; icon?: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs text-gray-400 mb-0.5">{label}</p>
      {value ? (
        <p className="text-sm font-medium text-gray-800 flex items-center gap-1">
          {icon && <span className="text-tea-400">{icon}</span>}{value}
        </p>
      ) : (
        <p className="text-sm text-gray-300 italic">미입력</p>
      )}
    </div>
  );
}

export default function ProductDetailPage() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();

  const { data: product, isLoading } = useQuery({
    queryKey: ['product', id],
    queryFn: () => productApi.getProduct(id).then((r) => r.data.data),
  });

  const toggleMutation = useMutation({
    mutationFn: () => productApi.toggleStatus(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['product', id] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      toast.success('상태가 변경되었습니다.');
    },
  });

  if (isLoading) {
    return <div className="flex items-center justify-center h-64"><Loader2 size={28} className="animate-spin text-tea-600" /></div>;
  }
  if (!product) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <Package size={40} className="text-gray-200" />
        <p className="text-gray-400">상품을 찾을 수 없습니다.</p>
        <Link href="/dashboard/products" className="btn-secondary">목록으로</Link>
      </div>
    );
  }

  const p = product as any;
  const additionalImages = (p.images || []).filter(Boolean) as string[];
  const aromas = p.aroma ? p.aroma.split(',').map((a: string) => a.trim()).filter(Boolean) : [];
  const recommendedTimes = p.recommendedTime ? p.recommendedTime.split(',').map((t: string) => t.trim()).filter(Boolean) : [];
  const hasFlavorData = FLAVOR_LABELS.some((f) => ((p[f.key] ?? 0) > 0));

  const missingRequired =
    !p.teaOrigin || !p.harvestSeason || !p.processingMethod || !p.caffeineLevel ||
    !p.liquidColor || !p.body || !p.brewingTemp || !p.brewingTime || aromas.length === 0;

  return (
    <div className="max-w-2xl mx-auto pb-12 px-4 sm:px-0 animate-fade-in">
      {/* 상단 헤더 */}
      <div className="flex items-center justify-between mb-5 gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <Link href="/dashboard/products" className="p-2 rounded-lg hover:bg-gray-100 transition-colors shrink-0">
            <ChevronLeft size={20} className="text-gray-600" />
          </Link>
          <h1 className="text-base sm:text-lg font-bold text-gray-900 line-clamp-1">{p.name}</h1>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button onClick={() => toggleMutation.mutate()} disabled={toggleMutation.isPending}
            className={clsx('flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium border transition-all',
              p.isActive ? 'border-gray-200 text-gray-600 hover:bg-gray-50' : 'border-tea-200 text-tea-600 hover:bg-tea-50')}>
            {p.isActive ? <EyeOff size={14} /> : <Eye size={14} />}
            {p.isActive ? '비활성화' : '활성화'}
          </button>
          <Link href={`/dashboard/products/${id}/edit`} className="btn-primary py-2 text-sm">
            <Edit2 size={14} /> 수정
          </Link>
        </div>
      </div>

      {/* 필수 정보 미입력 경고 */}
      {missingRequired && (
        <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-2.5">
          <AlertCircle size={16} className="text-amber-500 mt-0.5 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-amber-800">필수 정보가 미입력된 항목이 있어요</p>
            <p className="text-xs text-amber-600 mt-0.5">차 기본 특성, 맛·향, 우리기 가이드를 입력해야 소비자에게 상품이 잘 노출됩니다.</p>
          </div>
          <Link href={`/dashboard/products/${id}/edit`} className="text-xs font-semibold text-amber-700 hover:underline shrink-0">
            입력하기 →
          </Link>
        </div>
      )}

      <div className="space-y-4">

        {/* ── 1. 메인 사진 ── */}
        <div className="card p-0 overflow-hidden">
          {p.thumbnail ? (
            <img src={imgUrl(p.thumbnail)} alt={p.name}
              className="w-full aspect-[4/3] sm:aspect-[16/9] object-cover" />
          ) : (
            <div className="w-full aspect-[16/9] bg-gray-100" />
          )}
        </div>

        {/* ── 2. 기본 정보 ── */}
        <div className="card space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className={clsx('px-2.5 py-1 rounded-full text-xs font-semibold',
              p.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500')}>
              {p.isActive ? '판매중' : '비활성'}
            </span>
            {p.isSignature && (
              <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-700 flex items-center gap-1">
                <Star size={10} className="fill-amber-500 text-amber-500" /> 시그니처
              </span>
            )}
            {p.teaType && (
              <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-tea-50 text-tea-700">
                {p.teaType}{p.teaTypeCustom ? ` (${p.teaTypeCustom})` : ''}
              </span>
            )}
            {p.storeCategory && (
              <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-600">
                {p.storeCategory.icon} {p.storeCategory.name}
              </span>
            )}
          </div>
          <h2 className="text-xl font-bold text-gray-900">{p.name}</h2>

          {/* 가격 */}
          <div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold text-gray-900">{p.price.toLocaleString()}원</span>
              {p.discountRate && <span className="text-red-500 font-semibold text-sm">{p.discountRate}%↓</span>}
            </div>
            {p.originalPrice && <p className="text-sm text-gray-400 line-through">{p.originalPrice.toLocaleString()}원</p>}
            {(p.discountStartAt || p.discountEndAt) && (
              <p className="text-xs text-gray-400 mt-1">
                할인 기간: {p.discountStartAt ? new Date(p.discountStartAt).toLocaleDateString('ko-KR') : '~'} ~
                {p.discountEndAt ? new Date(p.discountEndAt).toLocaleDateString('ko-KR') : ''}
              </p>
            )}
          </div>

          {/* 재고 */}
          <div className="flex items-center gap-2 text-sm">
            <Box size={15} className="text-gray-400" />
            <span className={clsx('font-medium',
              p.stock === 0 ? 'text-red-500' : p.stock < 10 ? 'text-amber-600' : 'text-gray-700')}>
              재고 {p.stock === 0 ? '품절' : `${p.stock}${p.unit}`}
            </span>
            {p.weight && <span className="text-gray-400">· {p.weight}g</span>}
          </div>

          {/* 설명 */}
          {p.description && (
            <p className="text-sm text-gray-600 leading-relaxed border-t border-gray-100 pt-3">{p.description}</p>
          )}
        </div>

        {/* ── 3. 차 기본 특성 (항상 표시) ── */}
        <div className="card space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-gray-800 flex items-center gap-2">
              <Leaf size={16} className="text-tea-600" /> 차 기본 특성
            </h3>
            {missingRequired && (
              <Link href={`/dashboard/products/${id}/edit`} className="text-xs text-tea-600 hover:underline">수정하기 →</Link>
            )}
          </div>
          <div className="grid grid-cols-2 gap-x-6 gap-y-3">
            <InfoItem label="원산지" value={p.teaOrigin} icon={<MapPin size={13} />} />
            <InfoItem label="카페인" value={p.caffeineLevel ? (CAFFEINE_LABEL[p.caffeineLevel] || p.caffeineLevel) : null} icon={<Zap size={13} />} />
            <InfoItem label="수확 시기" value={p.harvestSeason} />
            <InfoItem label="가공 방법" value={p.processingMethod} />
            <InfoItem label="수색" value={p.liquidColor} />
            <InfoItem label="바디감" value={p.body ? (BODY_LABEL[p.body] || p.body) : null} icon={<Wind size={13} />} />
          </div>
        </div>

        {/* ── 4. 우리기 가이드 (항상 표시) ── */}
        <div className="card space-y-3">
          <h3 className="font-semibold text-gray-800 flex items-center gap-2">
            <Thermometer size={16} className="text-tea-600" /> 우리기 가이드
          </h3>
          <div className="grid grid-cols-2 gap-4">
            <InfoItem label="권장 물 온도" value={p.brewingTemp} />
            <div>
              <p className="text-xs text-gray-400 mb-0.5">우리는 시간</p>
              {p.brewingTime ? (
                <p className="text-sm font-medium text-gray-800 flex items-center gap-1">
                  <Clock size={13} className="text-gray-400" />{p.brewingTime}
                </p>
              ) : (
                <p className="text-sm text-gray-300 italic">미입력</p>
              )}
            </div>
          </div>
        </div>

        {/* ── 5. 맛·향 프로필 (항상 표시) ── */}
        <div className="card space-y-4">
          <h3 className="font-semibold text-gray-800">맛 · 향 프로필</h3>
          {hasFlavorData ? (
            <div className="space-y-2.5">
              {FLAVOR_LABELS.map((f) => {
                const val = p[f.key] ?? 0;
                return (
                  <div key={f.key} className="flex items-center gap-3">
                    <span className="text-xs text-gray-500 w-16 shrink-0">{f.label}</span>
                    <div className="flex gap-1 flex-1">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <div key={i} className={clsx('flex-1 h-2.5 rounded-sm', i < val ? f.color : 'bg-gray-100')} />
                      ))}
                    </div>
                    <span className="text-xs text-gray-400 w-8 shrink-0">{val}/5</span>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-gray-300 italic">맛 프로필 미입력</p>
          )}
          <div>
            <p className="text-xs text-gray-400 mb-2">향 특성</p>
            {aromas.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {aromas.map((a: string) => (
                  <span key={a} className="px-3 py-1 bg-tea-50 text-tea-700 rounded-full text-xs font-medium">{a}</span>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-300 italic">향 특성 미입력</p>
            )}
          </div>
        </div>

        {/* ── 6. 추천 음용 상황 ── */}
        {recommendedTimes.length > 0 && (
          <div className="card space-y-2">
            <h3 className="font-semibold text-gray-800 text-sm">추천 음용 상황</h3>
            <div className="flex flex-wrap gap-2">
              {recommendedTimes.map((t: string) => (
                <span key={t} className="px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-xs">{t}</span>
              ))}
            </div>
          </div>
        )}

        {/* ── 7. 태그 ── */}
        {p.tags?.length > 0 && (
          <div className="card space-y-2">
            <h3 className="font-semibold text-gray-800 text-sm flex items-center gap-1"><Tag size={13} /> 태그</h3>
            <div className="flex flex-wrap gap-1.5">
              {p.tags.map((t: string) => (
                <span key={t} className="text-xs bg-gray-100 text-gray-600 px-2.5 py-1 rounded-full">#{t}</span>
              ))}
            </div>
          </div>
        )}

        {/* ── 8. 판매 통계 ── */}
        <div className="card">
          <h3 className="font-semibold text-gray-800 mb-3 text-sm">판매 통계</h3>
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: '조회수', value: p.totalViews?.toLocaleString() || '0' },
              { label: '판매수', value: `${p.totalSales || 0}개` },
              { label: '매출', value: `${(p.totalRevenue || 0).toLocaleString()}원` },
            ].map((stat) => (
              <div key={stat.label} className="text-center p-3 bg-gray-50 rounded-xl">
                <p className="text-base font-bold text-gray-900">{stat.value}</p>
                <p className="text-xs text-gray-400 mt-0.5">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* ── 9. 추가 사진 (가장 아래) ── */}
        {additionalImages.length > 0 && (
          <div className="space-y-3">
            <h3 className="font-semibold text-gray-800 px-1">추가 사진</h3>
            {additionalImages.map((img, i) => (
              <div key={i} className="card p-0 overflow-hidden">
                <img src={imgUrl(img)} alt={`추가 사진 ${i + 1}`} className="w-full object-contain max-h-[600px]" />
              </div>
            ))}
          </div>
        )}

      </div>
    </div>
  );
}
