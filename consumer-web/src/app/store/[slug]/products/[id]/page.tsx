'use client';

import { useState, useRef, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { publicApi, reviewApi, consumerAuthApi } from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import { useCartStore } from '@/store/cartStore';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { Star, Minus, Plus, ChevronRight, Thermometer, Clock, MapPin, Zap, Wind, Camera, X, Heart, Flag } from 'lucide-react';
import NavBar from '@/components/NavBar';
import { clsx } from 'clsx';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? '';
const imgUrl = (p?: string | null) => p ? (p.startsWith('/') ? `${API_URL}${p}` : p) : null;

const TEA_TYPE_LABELS: Record<string, string> = {
  green: '녹차', black: '홍차', oolong: '우롱차', white: '백차',
  puerh: '보이차', herbal: '허브차', blend: '블렌드', other: '기타',
};
const CAFFEINE_LABEL: Record<string, string> = { high: '높음', medium: '중간', low: '낮음', none: '없음' };
const BODY_LABEL: Record<string, string> = { light: '가벼움', medium: '중간', full: '진함' };

const FLAVOR_COLOR = '#2D6A4F';
const FLAVOR_LABELS = [
  { key: 'flavorBitter',     label: '쓴맛',      color: FLAVOR_COLOR },
  { key: 'flavorSweet',      label: '단맛',      color: FLAVOR_COLOR },
  { key: 'flavorAstringent', label: '떫은맛',    color: FLAVOR_COLOR },
  { key: 'flavorSavory',     label: '구수한맛',   color: FLAVOR_COLOR },
  { key: 'flavorFloral',     label: '꽃향',      color: FLAVOR_COLOR },
  { key: 'flavorFruity',     label: '과일향',    color: FLAVOR_COLOR },
  { key: 'flavorNutty',      label: '고소함',    color: FLAVOR_COLOR },
  { key: 'flavorSmoky',      label: '훈연향',    color: FLAVOR_COLOR },
  { key: 'flavorEarthy',     label: '흙/대지향', color: FLAVOR_COLOR },
  { key: 'flavorFresh',      label: '청량감',    color: FLAVOR_COLOR },
  { key: 'flavorCreamy',     label: '크리미',    color: FLAVOR_COLOR },
];

export default function ProductDetailPage() {
  const params = useParams();
  const router = useRouter();
  const slug = params.slug as string;
  const productId = params.id as string;

  const { addItem } = useCartStore();
  const { accessToken, consumer } = useAuthStore();
  const [qty, setQty] = useState(1);
  const [activeImg, setActiveImg] = useState(0);

  // 최근 본 상품 기록
  useState(() => { if (accessToken && productId) consumerAuthApi.recordView(productId, accessToken).catch(() => {}); });

  // 리뷰 상태
  const queryClient = useQueryClient();
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewContent, setReviewContent] = useState('');
  const [reviewImages, setReviewImages] = useState<File[]>([]);
  const [reviewImagePreviews, setReviewImagePreviews] = useState<string[]>([]);
  const [showReviewForm, setShowReviewForm] = useState(false);
  const reviewImageRef = useRef<HTMLInputElement>(null);
  const reviewSectionRef = useRef<HTMLDivElement>(null);
  const [reviewPage, setReviewPage] = useState(1);
  const [reviewSort, setReviewSort] = useState('latest');
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportReason, setReportReason] = useState('');
  const [reportDetail, setReportDetail] = useState('');
  const [reportSubmitting, setReportSubmitting] = useState(false);
  const [selectedOptions, setSelectedOptions] = useState<Record<number, number>>({});

  // 구매확정된 주문이 있는지 확인 (리뷰 작성 자격)
  const { data: myOrders } = useQuery({
    queryKey: ['my-orders-for-review', accessToken, productId],
    queryFn: () => consumerAuthApi.getMyOrders(accessToken!).then(r => r.data.data),
    enabled: !!accessToken,
  });
  const hasPurchaseConfirmed = (myOrders || []).some((o: any) =>
    o.status === 'PURCHASE_CONFIRMED' && o.items?.some((item: any) => item.productId === productId)
  );

  // URL에서 writeReview=true면 자동으로 리뷰 폼 열기
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    if (params.get('writeReview') === 'true' && accessToken && hasPurchaseConfirmed) {
      setShowReviewForm(true);
      setTimeout(() => reviewSectionRef.current?.scrollIntoView({ behavior: 'smooth' }), 500);
    }
  }, [accessToken, hasPurchaseConfirmed]);

  const { data: product, isLoading } = useQuery({
    queryKey: ['product', productId],
    queryFn: () => publicApi.getProduct(productId).then((r) => r.data.data),
    enabled: !!productId,
  });

  const { data: store } = useQuery({
    queryKey: ['store', slug],
    queryFn: () => publicApi.getStore(slug).then((r) => r.data.data),
    enabled: !!slug,
  });

  const { data: reviewsData, refetch: refetchReviews } = useQuery({
    queryKey: ['product-reviews', productId, reviewPage, reviewSort],
    queryFn: () => publicApi.getProductReviews(productId, { page: reviewPage, limit: 5, sort: reviewSort }).then((r) => r.data),
    enabled: !!productId,
  });

  const { data: storeProducts } = useQuery({
    queryKey: ['store-products', slug],
    queryFn: () => publicApi.getProducts(slug, { limit: 12 }).then((r) => r.data.data),
    enabled: !!slug,
  });

  const { data: similarProducts } = useQuery({
    queryKey: ['similar-products', product?.teaType],
    queryFn: () => publicApi.getProductsByTeaType(product.teaType).then((r) => r.data.data),
    enabled: !!product?.teaType,
  });

  const [contentTab, setContentTab] = useState<'info' | 'review'>('info');

  const alreadyReviewed = (reviewsData?.data || []).some((r: any) => {
    const myName = useAuthStore.getState().consumer?.name;
    return myName && r.buyerName === myName;
  });
  const canWriteReview = hasPurchaseConfirmed && !alreadyReviewed;

  const submitReviewMutation = useMutation({
    mutationFn: (formData: FormData) => reviewApi.create(formData, accessToken!),
    onSuccess: () => {
      toast.success('리뷰가 등록되었습니다.');
      setShowReviewForm(false);
      setReviewContent('');
      setReviewRating(5);
      setReviewImages([]);
      setReviewImagePreviews([]);
      queryClient.invalidateQueries({ queryKey: ['product-reviews', productId] });
    },
    onError: (err: any) => toast.error(err?.response?.data?.error || '리뷰 등록에 실패했습니다.'),
  });

  const handleReviewSubmit = () => {
    if (!accessToken) { toast.error('로그인이 필요합니다.'); return; }
    if (reviewContent.trim().length < 10) { toast.error('리뷰 내용은 10자 이상 작성해주세요.'); return; }
    const fd = new FormData();
    fd.append('productId', productId);
    fd.append('rating', String(reviewRating));
    fd.append('content', reviewContent.trim());
    reviewImages.forEach((img) => fd.append('reviewImages', img));
    submitReviewMutation.mutate(fd);
  };

  const { data: productWishlists } = useQuery({
    queryKey: ['product-wishlists', accessToken],
    queryFn: () => consumerAuthApi.getProductWishlists(accessToken!).then(r => r.data.data),
    enabled: !!accessToken,
  });
  const isProductWishlisted = (productWishlists || []).some((w: any) => w.productId === productId);

  const toggleProductWishlist = useMutation({
    mutationFn: () => consumerAuthApi.toggleProductWishlist(productId, accessToken!),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['product-wishlists'] });
      toast.success(res.data.wishlisted ? '찜 목록에 추가했습니다' : '찜이 해제되었습니다');
    },
  });

  const themeColor = store?.themeColor || product?.store?.themeColor || '#2D6A4F';

  const handleAddToCart = () => {
    if (!product) return;
    if (productOptions.length > 0 && !allOptionsSelected) { toast.error('옵션을 선택해주세요.'); return; }
    if (anyOptionSoldOut) { toast.error('선택한 옵션이 품절입니다.'); return; }
    addItem({
      productId: product.id,
      name: product.name,
      price: product.price + optionPriceAdd,
      originalPrice: product.originalPrice,
      thumbnail: product.thumbnail,
      unit: product.unit || '개',
      stock: product.stock,
      storeSlug: slug,
      storeName: store?.name || product.store?.name || '',
      selectedOption: selectedOptionLabel || undefined,
    }, qty);
    toast.success('장바구니에 담았습니다');
  };

  const handleBuyNow = () => {
    if (!product) return;
    if (productOptions.length > 0 && !allOptionsSelected) { toast.error('옵션을 선택해주세요.'); return; }
    if (anyOptionSoldOut) { toast.error('선택한 옵션이 품절입니다.'); return; }
    addItem({
      productId: product.id,
      name: product.name,
      price: product.price + optionPriceAdd,
      originalPrice: product.originalPrice,
      thumbnail: product.thumbnail,
      unit: product.unit || '개',
      stock: product.stock,
      storeSlug: slug,
      storeName: store?.name || product.store?.name || '',
      selectedOption: selectedOptionLabel || undefined,
    }, qty);
    router.push('/checkout');
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="h-14 bg-white border-b" />
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex flex-col md:flex-row gap-6 lg:gap-10">
          <div className="w-full md:w-[55%] aspect-square bg-gray-200 rounded-2xl animate-pulse" />
          <div className="w-full md:w-[45%] space-y-4">
            <div className="h-8 bg-gray-200 rounded animate-pulse" />
            <div className="h-6 bg-gray-200 rounded w-1/2 animate-pulse" />
            <div className="h-24 bg-gray-200 rounded animate-pulse" />
          </div>
        </div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4">
        <p className="text-gray-500">상품을 찾을 수 없습니다</p>
        <Link href={`/store/${slug}`} className="text-sm text-tea-700 hover:underline">스토어로 돌아가기</Link>
      </div>
    );
  }

  const p = product as any;
  // images: 메인썸네일 + 추가사진 배열
  const allImages = [p.thumbnail, ...(p.images || [])].filter(Boolean) as string[];
  const isSoldOut = p.stock === 0;
  const isVacation = store && !store.isOpen;
  const productOptions: any[] = Array.isArray(p.options) ? p.options : [];
  const selectedOptionLabel = productOptions.map((g, gi) => {
    const vi = selectedOptions[gi];
    return vi !== undefined ? `${g.name}: ${g.values[vi]?.label}` : null;
  }).filter(Boolean).join(', ');
  const optionPriceAdd = productOptions.reduce((sum, g, gi) => {
    const vi = selectedOptions[gi];
    return sum + (vi !== undefined ? (g.values[vi]?.priceAdd || 0) : 0);
  }, 0);
  const allOptionsSelected = productOptions.length === 0 || productOptions.every((_, gi) => selectedOptions[gi] !== undefined);
  const anyOptionSoldOut = productOptions.some((g, gi) => {
    const vi = selectedOptions[gi];
    return vi !== undefined && g.values[vi]?.soldOut;
  });
  const cannotBuy = isSoldOut || isVacation || !allOptionsSelected || anyOptionSoldOut;
  const aromas = p.aroma ? p.aroma.split(',').map((a: string) => a.trim()).filter(Boolean) : [];
  const recommendedTimes = p.recommendedTime ? p.recommendedTime.split(',').map((t: string) => t.trim()).filter(Boolean) : [];
  const hasFlavorData = FLAVOR_LABELS.some((f) => (p[f.key] ?? 0) > 0);

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      <NavBar title={p.name} back={`/store/${slug}`} themeColor={themeColor} />

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-5">
        {/* 브레드크럼 */}
        <nav className="flex items-center gap-1.5 text-xs text-gray-400 mb-5">
          <Link href={`/store/${slug}`} className="hover:text-gray-600">{store?.name || '스토어'}</Link>
          <ChevronRight size={12} />
          <span className="text-gray-600 truncate">{p.name}</span>
        </nav>

        <div className="flex flex-col md:flex-row gap-6 lg:gap-10">
          {/* 이미지 갤러리 */}
          <div className="w-full md:w-[55%] md:shrink-0">
            <div className="aspect-square bg-white rounded-2xl overflow-hidden border border-gray-100 mb-2 md:max-h-[560px]">
              {allImages[activeImg]
                ? <img src={imgUrl(allImages[activeImg])!} alt={p.name} className="w-full h-full object-cover" />
                : <div className="w-full h-full bg-gray-100" />}
            </div>
            {allImages.length > 1 && (
              <div className="flex gap-2 overflow-x-auto pb-1">
                {allImages.map((img: string, i: number) => (
                  <button key={i} onClick={() => setActiveImg(i)}
                    className={clsx('shrink-0 w-16 h-16 rounded-xl overflow-hidden border-2 transition-colors',
                      activeImg === i ? 'border-tea-600' : 'border-gray-100')}>
                    <img src={imgUrl(img)!} alt="" className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* 상품 기본 정보 */}
          <div className="w-full md:w-[45%] md:sticky md:top-4 md:self-start flex flex-col gap-4">
            <div>
              {p.teaType && (
                <p className="text-sm font-medium mb-1" style={{ color: themeColor }}>
                  {TEA_TYPE_LABELS[p.teaType] || p.teaTypeCustom || p.teaType}
                </p>
              )}
              <div className="flex items-start gap-2">
                <h1 className="text-xl font-bold text-gray-900 flex-1">{p.name}</h1>
                {p.isSignature && <Star size={18} className="fill-amber-400 text-amber-400 shrink-0 mt-0.5" />}
                {accessToken && (
                  <button onClick={() => setShowReportModal(true)}
                    className="shrink-0 flex items-center gap-1 px-2 py-1 rounded-lg text-xs text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors">
                    <Flag size={14} /> 신고
                  </button>
                )}
                <button onClick={() => { if (!accessToken) { toast.error('로그인이 필요합니다'); return; } toggleProductWishlist.mutate(); }}
                  className="shrink-0 p-1.5 rounded-full hover:bg-gray-100 transition-colors">
                  <Heart size={20} className={isProductWishlisted ? 'fill-red-500 text-red-500' : 'text-gray-300'} />
                </button>
              </div>
              {p.storeCategory && (
                <span className="inline-block mt-1 text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">
                  {p.storeCategory.icon} {p.storeCategory.name}
                </span>
              )}
            </div>

            {/* 가격 */}
            <div className="bg-gray-50 rounded-xl p-4">
              <div className="flex items-baseline gap-2">
                {p.discountRate && <span className="text-lg font-bold text-red-500">{p.discountRate}%</span>}
                <span className="text-2xl font-bold text-gray-900">{p.price.toLocaleString()}원</span>
              </div>
              {p.originalPrice && p.originalPrice !== p.price && (
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-sm text-gray-400 line-through">{p.originalPrice.toLocaleString()}원</span>
                  <span className="text-sm text-red-500 font-medium">{(p.originalPrice - p.price).toLocaleString()}원 절약</span>
                </div>
              )}
              {p.unit && !['개', '개입'].includes(p.unit) && <p className="text-xs text-gray-400 mt-1">{p.unit}</p>}
              {p.stock > 0 && p.stock <= 10 && (
                <p className="text-xs text-amber-600 mt-1 font-medium">잔여 {p.stock}개</p>
              )}
            </div>

            {p.description && (
              <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-line">{p.description}</p>
            )}

            {/* 판매 옵션 선택 */}
            {productOptions.length > 0 && (
              <div className="space-y-3">
                {productOptions.map((group: any, gi: number) => (
                  <div key={gi}>
                    <p className="text-sm font-medium text-gray-700 mb-1.5">{group.name} <span className="text-red-500">*</span></p>
                    <div className="flex flex-wrap gap-2">
                      {group.values.map((val: any, vi: number) => {
                        const isSelected = selectedOptions[gi] === vi;
                        return (
                          <button key={vi} type="button"
                            disabled={val.soldOut}
                            onClick={() => setSelectedOptions(prev => ({ ...prev, [gi]: vi }))}
                            className={clsx(
                              'px-3 py-2 rounded-xl text-sm border-2 transition-all',
                              val.soldOut ? 'border-gray-100 bg-gray-50 text-gray-300 cursor-not-allowed' :
                              isSelected ? 'border-tea-600 bg-tea-50 text-tea-700 font-semibold' :
                              'border-gray-200 text-gray-700 hover:border-tea-300'
                            )}>
                            {val.label}
                            {val.priceAdd > 0 && <span className="text-xs ml-1 text-gray-400">(+{val.priceAdd.toLocaleString()}원)</span>}
                            {val.soldOut && <span className="ml-1 text-xs">(품절)</span>}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
                {optionPriceAdd > 0 && (
                  <p className="text-xs text-tea-600 font-medium">옵션 추가금액: +{optionPriceAdd.toLocaleString()}원</p>
                )}
              </div>
            )}

            {/* 수량 */}
            {!isSoldOut && (
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium text-gray-700">수량</span>
                <div className="flex items-center border border-gray-200 rounded-xl overflow-hidden">
                  <button onClick={() => setQty((q) => Math.max(1, q - 1))}
                    className="w-9 h-9 flex items-center justify-center text-gray-500 hover:bg-gray-50">
                    <Minus size={14} />
                  </button>
                  <span className="w-8 text-center text-sm font-semibold">{qty}</span>
                  <button onClick={() => setQty((q) => Math.min(p.stock, q + 1))}
                    className="w-9 h-9 flex items-center justify-center text-gray-500 hover:bg-gray-50">
                    <Plus size={14} />
                  </button>
                </div>
                <span className="text-sm font-bold text-gray-900 ml-auto">{(p.price * qty).toLocaleString()}원</span>
              </div>
            )}

            {/* 데스크탑 구매 버튼 */}
            <div className="hidden md:flex gap-2 mt-auto">
              {cannotBuy ? (
                <button disabled className="flex-1 py-3 rounded-xl text-sm font-semibold bg-gray-200 text-gray-400 cursor-not-allowed">
                  {isSoldOut ? '품절' : '휴업중'}
                </button>
              ) : (
                <>
                  <button onClick={handleAddToCart}
                    className="flex-1 py-3 rounded-xl text-sm font-semibold border-2 text-tea-700 border-tea-700 hover:bg-tea-50 transition-colors">
                    장바구니
                  </button>
                  <button onClick={handleBuyNow}
                    className="flex-1 py-3 rounded-xl text-sm font-semibold text-white transition-colors"
                    style={{ backgroundColor: themeColor }}>
                    바로구매
                  </button>
                </>
              )}
            </div>
          </div>
        </div>

        {/* ── 차 기본 특성 ── */}
        {(p.teaOrigin || p.caffeineLevel || p.harvestSeason || p.processingMethod || p.liquidColor || p.body) && (
          <div className="mt-6 bg-white rounded-2xl border border-gray-100 p-5">
            <h2 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-1.5">
              차 기본 특성
            </h2>
            <div className="grid grid-cols-2 gap-x-6 gap-y-3">
              {p.teaOrigin && (
                <div>
                  <p className="text-xs text-gray-400 flex items-center gap-1"><MapPin size={11} /> 원산지</p>
                  <p className="text-sm font-medium text-gray-800 mt-0.5">{p.teaOrigin}</p>
                </div>
              )}
              {p.caffeineLevel && (
                <div>
                  <p className="text-xs text-gray-400 flex items-center gap-1"><Zap size={11} /> 카페인</p>
                  <p className="text-sm font-medium text-gray-800 mt-0.5">{CAFFEINE_LABEL[p.caffeineLevel] || p.caffeineLevel}</p>
                </div>
              )}
              {p.harvestSeason && (
                <div>
                  <p className="text-xs text-gray-400">수확 시기</p>
                  <p className="text-sm font-medium text-gray-800 mt-0.5">{p.harvestSeason}</p>
                </div>
              )}
              {p.processingMethod && (
                <div>
                  <p className="text-xs text-gray-400">가공 방법</p>
                  <p className="text-sm font-medium text-gray-800 mt-0.5">{p.processingMethod}</p>
                </div>
              )}
              {p.liquidColor && (
                <div>
                  <p className="text-xs text-gray-400">수색</p>
                  <p className="text-sm font-medium text-gray-800 mt-0.5">{p.liquidColor}</p>
                </div>
              )}
              {p.body && (
                <div>
                  <p className="text-xs text-gray-400 flex items-center gap-1"><Wind size={11} /> 바디감</p>
                  <p className="text-sm font-medium text-gray-800 mt-0.5">{BODY_LABEL[p.body] || p.body}</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── 우리기 가이드 ── */}
        {(p.brewingTemp || p.brewingTime) && (
          <div className="mt-3 bg-white rounded-2xl border border-gray-100 p-5">
            <h2 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-1.5">
              <Thermometer size={15} className="text-tea-600" /> 우리기 가이드
            </h2>
            <div className="grid grid-cols-2 gap-4">
              {p.brewingTemp && (
                <div>
                  <p className="text-xs text-gray-400">권장 물 온도</p>
                  <p className="text-sm font-medium text-gray-800 mt-0.5">{p.brewingTemp}</p>
                </div>
              )}
              {p.brewingTime && (
                <div>
                  <p className="text-xs text-gray-400 flex items-center gap-1"><Clock size={11} /> 우리는 시간</p>
                  <p className="text-sm font-medium text-gray-800 mt-0.5">{p.brewingTime}</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── 맛·향 프로필 ── */}
        {(hasFlavorData || aromas.length > 0) && (
          <div className="mt-3 bg-white rounded-2xl border border-gray-100 p-5">
            <h2 className="text-sm font-semibold text-gray-700 mb-4">맛 · 향 프로필</h2>
            {hasFlavorData && (
              <div className="space-y-2.5 mb-4">
                {FLAVOR_LABELS.map(({ key, label, color }) => {
                  const val = p[key] ?? 0;
                  if (val === 0) return null;
                  return (
                    <div key={key} className="flex items-center gap-3">
                      <span className="text-xs text-gray-500 w-16 shrink-0">{label}</span>
                      <div className="flex gap-1 flex-1">
                        {Array.from({ length: 5 }).map((_, i) => (
                          <div key={i} className="flex-1 h-2.5 rounded-sm"
                            style={{ backgroundColor: i < val ? color : '#F3F4F6' }} />
                        ))}
                      </div>
                      <span className="text-xs text-gray-400 w-8 shrink-0">{val}/5</span>
                    </div>
                  );
                })}
              </div>
            )}
            {aromas.length > 0 && (
              <div>
                <p className="text-xs text-gray-400 mb-2">향 특성</p>
                <div className="flex flex-wrap gap-2">
                  {aromas.map((a: string) => (
                    <span key={a} className="px-3 py-1 bg-tea-50 text-tea-700 rounded-full text-xs font-medium">{a}</span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── 추천 음용 상황 ── */}
        {recommendedTimes.length > 0 && (
          <div className="mt-3 bg-white rounded-2xl border border-gray-100 p-5">
            <h2 className="text-sm font-semibold text-gray-700 mb-3">추천 음용 상황</h2>
            <div className="flex flex-wrap gap-2">
              {recommendedTimes.map((t: string) => (
                <span key={t} className="px-3 py-1.5 bg-gray-100 text-gray-700 rounded-full text-xs font-medium">{t}</span>
              ))}
            </div>
          </div>
        )}

        {/* ── 태그 ── */}
        {p.tags && p.tags.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {p.tags.map((tag: string) => (
              <span key={tag} className="text-xs px-3 py-1 rounded-full bg-white border border-gray-200 text-gray-600">#{tag}</span>
            ))}
          </div>
        )}

        {/* 신고 모달 */}
        {showReportModal && (
          <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center px-4" onClick={() => setShowReportModal(false)}>
            <div className="bg-white rounded-2xl w-full max-w-sm p-5 space-y-4" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between">
                <h3 className="text-base font-bold text-gray-900">상품 신고</h3>
                <button onClick={() => setShowReportModal(false)} className="p-1 text-gray-400 hover:text-gray-600"><X size={18} /></button>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">신고 사유</label>
                <select value={reportReason} onChange={(e) => setReportReason(e.target.value)}
                  className="w-full mt-1 border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-300">
                  <option value="">선택해주세요</option>
                  <option value="허위/과장 광고">허위/과장 광고</option>
                  <option value="가품 의심">가품 의심</option>
                  <option value="부적절한 상품">부적절한 상품</option>
                  <option value="가격 부당">가격 부당</option>
                  <option value="기타">기타</option>
                </select>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">상세 내용 (선택)</label>
                <textarea value={reportDetail} onChange={(e) => setReportDetail(e.target.value)}
                  placeholder="구체적인 신고 사유를 입력해주세요"
                  className="w-full mt-1 border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-300 resize-none h-20" />
              </div>
              <div className="flex gap-2">
                <button onClick={() => setShowReportModal(false)}
                  className="flex-1 py-2.5 rounded-xl text-sm font-medium border border-gray-200 text-gray-600 hover:bg-gray-50">취소</button>
                <button
                  onClick={async () => {
                    if (!reportReason) { toast.error('신고 사유를 선택해주세요.'); return; }
                    setReportSubmitting(true);
                    try {
                      await consumerAuthApi.createReport({ type: 'PRODUCT', targetId: productId, reason: reportReason, detail: reportDetail }, accessToken!);
                      toast.success('신고가 접수되었습니다.');
                      setShowReportModal(false);
                      setReportReason('');
                      setReportDetail('');
                    } catch (err: any) {
                      toast.error(err?.response?.data?.error || '신고 접수에 실패했습니다.');
                    } finally { setReportSubmitting(false); }
                  }}
                  disabled={reportSubmitting}
                  className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white bg-red-500 hover:bg-red-600 transition-colors disabled:opacity-50">
                  {reportSubmitting ? '접수 중...' : '신고 접수'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── 탭 바 (상품정보 / 리뷰) ── */}
        <div className="mt-6 flex border-b border-gray-200 sticky top-0 bg-gray-50 z-10">
          <button onClick={() => setContentTab('info')}
            className={clsx('flex-1 py-3 text-sm font-semibold text-center border-b-2 transition-colors',
              contentTab === 'info' ? 'border-tea-600 text-tea-700' : 'border-transparent text-gray-400')}>
            상품 정보
          </button>
          <button onClick={() => { setContentTab('review'); setTimeout(() => reviewSectionRef.current?.scrollIntoView({ behavior: 'smooth' }), 100); }}
            className={clsx('flex-1 py-3 text-sm font-semibold text-center border-b-2 transition-colors',
              contentTab === 'review' ? 'border-tea-600 text-tea-700' : 'border-transparent text-gray-400')}>
            리뷰 {reviewsData?.stats?.count > 0 && `(${reviewsData.stats.count})`}
          </button>
        </div>

        {/* ── 상세 이미지 (상품정보 탭) ── */}
        {contentTab === 'info' && p.images && p.images.length > 0 && (
          <div className="mt-4 space-y-3">
            <h2 className="text-sm font-semibold text-gray-700">상세 이미지</h2>
            {p.images.map((img: string, i: number) => (
              <div key={i} className="rounded-2xl overflow-hidden border border-gray-100">
                <img src={imgUrl(img)!} alt={`상세 이미지 ${i + 1}`} className="w-full object-contain" />
              </div>
            ))}
          </div>
        )}

        {/* ── 리뷰 ── */}
        <div className={clsx('mt-4', contentTab !== 'review' && 'hidden')} ref={reviewSectionRef} id="review">

          {/* 리뷰 요약 카드 */}
          <div className="bg-white rounded-2xl border border-gray-100 p-5 mb-4">
            <div className="flex items-center gap-6">
              <div className="text-center shrink-0">
                <p className="text-3xl font-bold text-gray-900">{reviewsData?.stats?.avg?.toFixed(1) || '0.0'}</p>
                <div className="flex gap-0.5 justify-center mt-1">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star key={i} size={14} className={i < Math.round(reviewsData?.stats?.avg || 0) ? 'fill-amber-400 text-amber-400' : 'text-gray-200'} />
                  ))}
                </div>
                <p className="text-xs text-gray-400 mt-1">{reviewsData?.stats?.count || 0}개의 리뷰</p>
              </div>
              <div className="flex-1 space-y-1">
                {[5, 4, 3, 2, 1].map(n => {
                  const count = (reviewsData?.data || []).filter((r: any) => r.rating === n).length;
                  const total = reviewsData?.stats?.count || 1;
                  return (
                    <div key={n} className="flex items-center gap-2">
                      <span className="text-xs text-gray-500 w-4 text-right">{n}</span>
                      <Star size={10} className="fill-amber-400 text-amber-400 shrink-0" />
                      <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full bg-amber-400 rounded-full transition-all" style={{ width: `${(count / total) * 100}%` }} />
                      </div>
                      <span className="text-[10px] text-gray-400 w-4">{count}</span>
                    </div>
                  );
                })}
              </div>
            </div>
            {canWriteReview && !showReviewForm && (
              <button onClick={() => setShowReviewForm(true)}
                className="w-full mt-4 py-2.5 rounded-xl text-sm font-semibold border-2 border-tea-600 text-tea-700 hover:bg-tea-50 transition-colors">
                리뷰 작성하기
              </button>
            )}
          </div>

          {/* 정렬 */}
          {(reviewsData?.stats?.count || 0) > 0 && (
            <div className="flex gap-2 mb-4">
              {[
                { key: 'latest', label: '최신순' },
                { key: 'rating_high', label: '별점 높은순' },
                { key: 'rating_low', label: '별점 낮은순' },
              ].map(s => (
                <button key={s.key} onClick={() => { setReviewSort(s.key); setReviewPage(1); }}
                  className={clsx('px-3 py-1.5 rounded-full text-xs font-medium transition-colors',
                    reviewSort === s.key ? 'bg-tea-600 text-white' : 'bg-white border border-gray-200 text-gray-500 hover:bg-gray-50')}>
                  {s.label}
                </button>
              ))}
            </div>
          )}

          {/* 리뷰 작성 폼 */}
          {showReviewForm && canWriteReview && (
            <div className="bg-white rounded-2xl border border-gray-100 p-5 mb-4 space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-base font-bold text-gray-900">리뷰 작성</p>
                <button onClick={() => setShowReviewForm(false)} className="p-1.5 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100"><X size={18} /></button>
              </div>

              {/* 별점 */}
              <div className="text-center py-2">
                <p className="text-xs text-gray-500 mb-2">이 상품에 만족하셨나요?</p>
                <div className="flex items-center justify-center gap-2">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <button key={i} onClick={() => setReviewRating(i + 1)} className="transition-transform hover:scale-110">
                      <Star size={36} className={i < reviewRating ? 'fill-amber-400 text-amber-400' : 'text-gray-200'} />
                    </button>
                  ))}
                </div>
                <p className="text-sm font-medium text-amber-600 mt-1">
                  {['', '별로예요', '그저 그래요', '보통이에요', '만족해요', '최고예요!'][reviewRating]}
                </p>
              </div>

              {/* 내용 */}
              <div>
                <textarea
                  value={reviewContent}
                  onChange={(e) => setReviewContent(e.target.value)}
                  placeholder="구매하신 상품은 어떠셨나요? 맛, 향, 포장 등 자유롭게 작성해주세요. (10자 이상)"
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-tea-400 resize-none h-28 bg-gray-50"
                />
                <div className="flex items-center justify-between mt-1">
                  <p className={clsx('text-xs', reviewContent.length >= 10 ? 'text-green-500' : 'text-gray-400')}>
                    {reviewContent.length}/10자 이상
                  </p>
                </div>
              </div>

              {/* 사진 첨부 */}
              <div>
                <p className="text-xs font-medium text-gray-600 mb-2">사진 첨부 (최대 5장)</p>
                <div className="flex gap-2.5 flex-wrap">
                  {reviewImagePreviews.map((preview, i) => (
                    <div key={i} className="relative w-20 h-20 rounded-xl overflow-hidden border border-gray-200">
                      <img src={preview} alt="" className="w-full h-full object-cover" />
                      <button onClick={() => { setReviewImages((prev) => prev.filter((_, idx) => idx !== i)); setReviewImagePreviews((prev) => prev.filter((_, idx) => idx !== i)); }}
                        className="absolute top-1 right-1 w-5 h-5 bg-black/60 text-white rounded-full flex items-center justify-center">
                        <X size={10} />
                      </button>
                    </div>
                  ))}
                  {reviewImages.length < 5 && (
                    <button onClick={() => reviewImageRef.current?.click()}
                      className="w-20 h-20 border-2 border-dashed border-gray-200 rounded-xl flex flex-col items-center justify-center text-gray-300 hover:border-tea-400 hover:text-tea-400 transition-colors">
                      <Camera size={20} />
                      <span className="text-[10px] mt-1">{reviewImages.length}/5</span>
                    </button>
                  )}
                </div>
                <input ref={reviewImageRef} type="file" accept="image/*" multiple className="hidden"
                  onChange={(e) => {
                    const files = Array.from(e.target.files || []);
                    if (reviewImages.length + files.length > 5) { toast.error('최대 5장까지 첨부 가능합니다.'); return; }
                    setReviewImages((prev) => [...prev, ...files]);
                    setReviewImagePreviews((prev) => [...prev, ...files.map((f) => URL.createObjectURL(f))]);
                    e.target.value = '';
                  }} />
              </div>

              {/* 버튼 */}
              <div className="flex gap-2 pt-1">
                <button onClick={() => setShowReviewForm(false)} className="flex-1 py-3 rounded-xl text-sm font-medium border border-gray-200 text-gray-500 hover:bg-gray-50">취소</button>
                <button
                  onClick={handleReviewSubmit}
                  disabled={submitReviewMutation.isPending || reviewContent.length < 10}
                  className="flex-1 py-3 rounded-xl text-sm font-bold text-white transition-colors disabled:opacity-40"
                  style={{ backgroundColor: themeColor }}>
                  {submitReviewMutation.isPending ? '등록 중...' : '리뷰 등록'}
                </button>
              </div>
            </div>
          )}

          {/* 리뷰 목록 */}
          {(reviewsData?.data || []).length === 0 && !showReviewForm ? (
            <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center">
              <Star size={40} className="mx-auto text-gray-200 mb-3" />
              <p className="text-sm text-gray-400 mb-1">아직 리뷰가 없습니다</p>
              <p className="text-xs text-gray-300">이 상품의 첫 번째 리뷰를 남겨보세요</p>
              {canWriteReview && (
                <button onClick={() => setShowReviewForm(true)}
                  className="mt-4 px-6 py-2.5 rounded-xl text-sm font-semibold text-white transition-colors"
                  style={{ backgroundColor: themeColor }}>
                  첫 리뷰 작성하기
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {(reviewsData?.data || []).map((review: any) => (
                <div key={review.id} className="bg-white rounded-2xl border border-gray-100 p-4">
                  {/* 작성자 정보 */}
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-tea-100 flex items-center justify-center">
                        <span className="text-xs font-bold text-tea-700">{review.buyerName?.[0]}</span>
                      </div>
                      <div>
                        <span className="text-sm font-medium text-gray-800">{review.buyerName}</span>
                        <div className="flex items-center gap-1 mt-0.5">
                          {Array.from({ length: 5 }).map((_, i) => (
                            <Star key={i} size={11} className={i < review.rating ? 'fill-amber-400 text-amber-400' : 'text-gray-200'} />
                          ))}
                        </div>
                      </div>
                    </div>
                    <span className="text-xs text-gray-400">{new Date(review.createdAt).toLocaleDateString('ko-KR')}</span>
                  </div>

                  {/* 리뷰 내용 */}
                  {review.content && <p className="text-sm text-gray-700 leading-relaxed mb-2">{review.content}</p>}

                  {/* 리뷰 이미지 */}
                  {review.images?.length > 0 && (
                    <div className="flex gap-2 flex-wrap mb-2">
                      {review.images.map((img: string, i: number) => (
                        <img key={i} src={imgUrl(img)!} alt="" className="w-20 h-20 rounded-xl object-cover border border-gray-100" />
                      ))}
                    </div>
                  )}

                  {/* 판매자 답변 */}
                  {review.sellerReply && (
                    <div className="bg-tea-50 rounded-xl p-3 mt-2 border-l-3 border-tea-500">
                      <div className="flex items-center gap-1.5 mb-1">
                        <div className="w-4 h-4 rounded-full bg-tea-600 flex items-center justify-center">
                          <span className="text-[8px] font-bold text-white">S</span>
                        </div>
                        <p className="text-xs font-semibold text-tea-700">판매자 답변</p>
                      </div>
                      <p className="text-xs text-gray-600 leading-relaxed">{review.sellerReply}</p>
                    </div>
                  )}
                </div>
              ))}

              {/* 페이지네이션 */}
              {reviewsData?.pagination && reviewsData.pagination.totalPages > 1 && (
                <div className="flex justify-center gap-2 pt-2">
                  <button onClick={() => setReviewPage((p) => Math.max(1, p - 1))} disabled={reviewPage === 1}
                    className="px-4 py-2 text-xs font-medium border border-gray-200 rounded-xl disabled:opacity-30 hover:bg-gray-50">이전</button>
                  <span className="px-3 py-2 text-xs text-gray-500">{reviewPage} / {reviewsData.pagination.totalPages}</span>
                  <button onClick={() => setReviewPage((p) => Math.min(reviewsData.pagination.totalPages, p + 1))} disabled={reviewPage === reviewsData.pagination.totalPages}
                    className="px-4 py-2 text-xs font-medium border border-gray-200 rounded-xl disabled:opacity-30 hover:bg-gray-50">다음</button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── 이 스토어의 다른 상품 ── */}
        {(() => {
          const others = (storeProducts || []).filter((sp: any) => sp.id !== productId);
          if (others.length === 0) return null;
          return (
            <div className="mt-8">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-semibold text-gray-800">
                  {p.store?.name || '이 스토어'}의 다른 상품
                </h2>
                <Link href={`/store/${slug}`} className="text-xs text-tea-600 hover:underline flex items-center gap-0.5">
                  전체보기 <ChevronRight size={12} />
                </Link>
              </div>
              <div className="flex gap-3 overflow-x-auto pb-2" style={{ scrollbarWidth: 'none' }}>
                {others.slice(0, 10).map((sp: any) => (
                  <Link key={sp.id} href={`/store/${slug}/products/${sp.id}`}
                    className="shrink-0 w-32 group">
                    <div className="w-32 h-32 rounded-xl overflow-hidden bg-gray-100 mb-1.5 relative">
                      {imgUrl(sp.thumbnail) ? (
                        <img src={imgUrl(sp.thumbnail)!} alt={sp.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-gray-300 text-xs">No Image</div>
                      )}
                      {sp.stock === 0 && (
                        <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                          <span className="text-white text-xs font-bold">품절</span>
                        </div>
                      )}
                    </div>
                    <p className="text-xs text-gray-700 truncate font-medium">{sp.name}</p>
                    <div className="flex items-center gap-1">
                      {sp.discountRate && <span className="text-xs font-bold text-red-500">{sp.discountRate}%</span>}
                      <span className="text-xs font-bold text-gray-900">{sp.price?.toLocaleString()}원</span>
                    </div>
                    {sp.originalPrice && sp.originalPrice !== sp.price && (
                      <span className="text-[10px] text-gray-400 line-through">{sp.originalPrice?.toLocaleString()}원</span>
                    )}
                  </Link>
                ))}
              </div>
            </div>
          );
        })()}

        {/* ── 비슷한 상품 추천 ── */}
        {(() => {
          const similar = (similarProducts || []).filter((sp: any) => sp.id !== productId).slice(0, 10);
          if (similar.length === 0) return null;
          return (
            <div className="mt-6">
              <h2 className="text-sm font-semibold text-gray-800 mb-3">비슷한 상품</h2>
              <div className="flex gap-3 overflow-x-auto pb-2" style={{ scrollbarWidth: 'none' }}>
                {similar.map((sp: any) => (
                  <Link key={sp.id} href={`/store/${sp.store?.slug}/products/${sp.id}`}
                    className="shrink-0 w-32 group">
                    <div className="w-32 h-32 rounded-xl overflow-hidden bg-gray-100 mb-1.5 relative">
                      {imgUrl(sp.thumbnail) ? (
                        <img src={imgUrl(sp.thumbnail)!} alt={sp.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-gray-300 text-xs">No Image</div>
                      )}
                      {sp.stock === 0 && (
                        <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                          <span className="text-white text-xs font-bold">품절</span>
                        </div>
                      )}
                    </div>
                    <p className="text-[10px] text-gray-400 truncate">{sp.store?.name}</p>
                    <p className="text-xs text-gray-700 truncate font-medium">{sp.name}</p>
                    <div className="flex items-center gap-1">
                      {sp.discountRate && <span className="text-xs font-bold text-red-500">{sp.discountRate}%</span>}
                      <span className="text-xs font-bold text-gray-900">{sp.price?.toLocaleString()}원</span>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          );
        })()}
      </div>

      {/* 모바일 하단 고정 버튼 */}
      {!cannotBuy && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 px-4 py-3 flex gap-2 md:hidden z-30">
          <button onClick={handleAddToCart}
            className="flex-1 py-3 rounded-xl text-sm font-semibold border-2 text-tea-700 border-tea-700 hover:bg-tea-50 transition-colors">
            장바구니
          </button>
          <button onClick={handleBuyNow}
            className="flex-1 py-3 rounded-xl text-sm font-semibold text-white transition-colors"
            style={{ backgroundColor: themeColor }}>
            바로구매
          </button>
        </div>
      )}
      {cannotBuy && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 px-4 py-3 md:hidden z-30">
          {isVacation && !isSoldOut ? (
            <div>
              <button disabled className="w-full py-3 rounded-xl text-sm font-semibold bg-amber-100 text-amber-700">휴업중 — 주문 불가</button>
              {store?.closedMessage && <p className="text-xs text-amber-600 text-center mt-1.5">{store.closedMessage}</p>}
            </div>
          ) : (
            <button disabled className="w-full py-3 rounded-xl text-sm font-semibold bg-gray-200 text-gray-400">품절</button>
          )}
        </div>
      )}
    </div>
  );
}