'use client';

import { useState, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { publicApi, reviewApi } from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import { useCartStore } from '@/store/cartStore';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { Star, Minus, Plus, ChevronRight, Thermometer, Clock, MapPin, Zap, Wind, Camera, X } from 'lucide-react';
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

const FLAVOR_LABELS = [
  { key: 'flavorBitter',     label: '쓴맛',    color: '#4B5563' },
  { key: 'flavorSweet',      label: '단맛',    color: '#F59E0B' },
  { key: 'flavorAstringent', label: '떫은맛',  color: '#16A34A' },
  { key: 'flavorSavory',     label: '구수한맛', color: '#CA8A04' },
  { key: 'flavorFloral',     label: '꽃향미',  color: '#EC4899' },
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

  // 리뷰 상태
  const queryClient = useQueryClient();
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewContent, setReviewContent] = useState('');
  const [reviewImages, setReviewImages] = useState<File[]>([]);
  const [reviewImagePreviews, setReviewImagePreviews] = useState<string[]>([]);
  const [showReviewForm, setShowReviewForm] = useState(false);
  const reviewImageRef = useRef<HTMLInputElement>(null);
  const [reviewPage, setReviewPage] = useState(1);

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
    queryKey: ['product-reviews', productId, reviewPage],
    queryFn: () => publicApi.getProductReviews(productId, { page: reviewPage, limit: 5 }).then((r) => r.data),
    enabled: !!productId,
  });

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

  const themeColor = store?.themeColor || product?.store?.themeColor || '#2D6A4F';

  const handleAddToCart = () => {
    if (!product) return;
    addItem({
      productId: product.id,
      name: product.name,
      price: product.price,
      originalPrice: product.originalPrice,
      thumbnail: product.thumbnail,
      unit: product.unit || '개',
      stock: product.stock,
      storeSlug: slug,
      storeName: store?.name || product.store?.name || '',
    }, qty);
    toast.success('장바구니에 담았습니다');
  };

  const handleBuyNow = () => {
    if (!product) return;
    addItem({
      productId: product.id,
      name: product.name,
      price: product.price,
      originalPrice: product.originalPrice,
      thumbnail: product.thumbnail,
      unit: product.unit || '개',
      stock: product.stock,
      storeSlug: slug,
      storeName: store?.name || product.store?.name || '',
    }, qty);
    router.push('/checkout');
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="h-14 bg-white border-b" />
        <div className="max-w-4xl mx-auto px-4 py-6 grid md:grid-cols-2 gap-6">
          <div className="aspect-square bg-gray-200 rounded-2xl animate-pulse" />
          <div className="space-y-4">
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
  const aromas = p.aroma ? p.aroma.split(',').map((a: string) => a.trim()).filter(Boolean) : [];
  const recommendedTimes = p.recommendedTime ? p.recommendedTime.split(',').map((t: string) => t.trim()).filter(Boolean) : [];
  const hasFlavorData = FLAVOR_LABELS.some((f) => (p[f.key] ?? 0) > 0);

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      <NavBar title={p.name} back={`/store/${slug}`} themeColor={themeColor} />

      <div className="max-w-4xl mx-auto px-4 py-5">
        {/* 브레드크럼 */}
        <nav className="flex items-center gap-1.5 text-xs text-gray-400 mb-4">
          <Link href={`/store/${slug}`} className="hover:text-gray-600">{store?.name || '스토어'}</Link>
          <ChevronRight size={12} />
          <span className="text-gray-600 truncate">{p.name}</span>
        </nav>

        <div className="grid md:grid-cols-2 gap-6">
          {/* 이미지 갤러리 */}
          <div>
            <div className="aspect-square bg-white rounded-2xl overflow-hidden border border-gray-100 mb-2">
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
          <div className="flex flex-col gap-4">
            <div>
              {p.teaType && (
                <p className="text-sm font-medium mb-1" style={{ color: themeColor }}>
                  {TEA_TYPE_LABELS[p.teaType] || p.teaTypeCustom || p.teaType}
                </p>
              )}
              <div className="flex items-start gap-2">
                <h1 className="text-xl font-bold text-gray-900 flex-1">{p.name}</h1>
                {p.isSignature && <Star size={18} className="fill-amber-400 text-amber-400 shrink-0 mt-0.5" />}
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
              {p.unit && <p className="text-xs text-gray-400 mt-1">{p.unit}</p>}
              {p.stock > 0 && p.stock <= 10 && (
                <p className="text-xs text-amber-600 mt-1 font-medium">잔여 {p.stock}개</p>
              )}
            </div>

            {p.description && (
              <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-line">{p.description}</p>
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
              {isSoldOut ? (
                <button disabled className="flex-1 py-3 rounded-xl text-sm font-semibold bg-gray-200 text-gray-400 cursor-not-allowed">품절</button>
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

        {/* ── 추가 사진 (images 배열에서 첫번째 이후) ── */}
        {p.images && p.images.length > 0 && (
          <div className="mt-6 space-y-3">
            <h2 className="text-sm font-semibold text-gray-700">상세 이미지</h2>
            {p.images.map((img: string, i: number) => (
              <div key={i} className="rounded-2xl overflow-hidden border border-gray-100">
                <img src={imgUrl(img)!} alt={`상세 이미지 ${i + 1}`} className="w-full object-contain" />
              </div>
            ))}
          </div>
        )}

        {/* ── 리뷰 ── */}
        <div className="mt-6">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="text-sm font-semibold text-gray-800">
                상품 리뷰
                {reviewsData?.stats?.count > 0 && (
                  <span className="ml-2 text-tea-600">({reviewsData.stats.count})</span>
                )}
              </h2>
              {reviewsData?.stats?.avg > 0 && (
                <div className="flex items-center gap-1 mt-0.5">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star key={i} size={12} className={i < Math.round(reviewsData.stats.avg) ? 'fill-amber-400 text-amber-400' : 'text-gray-200'} />
                  ))}
                  <span className="text-xs text-gray-500 ml-1">{reviewsData.stats.avg.toFixed(1)}</span>
                </div>
              )}
            </div>
            {accessToken && !showReviewForm && (
              <button onClick={() => setShowReviewForm(true)}
                className="text-sm font-medium text-tea-700 hover:underline">
                리뷰 작성
              </button>
            )}
          </div>

          {/* 리뷰 작성 폼 */}
          {showReviewForm && (
            <div className="bg-white rounded-2xl border border-gray-100 p-4 mb-4 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-gray-800">리뷰 작성</p>
                <button onClick={() => setShowReviewForm(false)} className="p-1 text-gray-400 hover:text-gray-600"><X size={16} /></button>
              </div>
              {/* 별점 */}
              <div className="flex items-center gap-1">
                {Array.from({ length: 5 }).map((_, i) => (
                  <button key={i} onClick={() => setReviewRating(i + 1)}>
                    <Star size={28} className={i < reviewRating ? 'fill-amber-400 text-amber-400' : 'text-gray-200'} />
                  </button>
                ))}
              </div>
              {/* 내용 */}
              <textarea
                value={reviewContent}
                onChange={(e) => setReviewContent(e.target.value)}
                placeholder="구매하신 상품은 어떠셨나요? 10자 이상 작성해주세요."
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-tea-400 resize-none h-24"
              />
              <p className="text-xs text-gray-400 -mt-1">{reviewContent.length}자{reviewContent.length < 10 ? ` (${10 - reviewContent.length}자 더 필요)` : ''}</p>
              {/* 이미지 */}
              <div>
                <div className="flex gap-2 flex-wrap">
                  {reviewImagePreviews.map((preview, i) => (
                    <div key={i} className="relative w-16 h-16">
                      <img src={preview} alt="" className="w-full h-full object-cover rounded-lg" />
                      <button onClick={() => { setReviewImages((prev) => prev.filter((_, idx) => idx !== i)); setReviewImagePreviews((prev) => prev.filter((_, idx) => idx !== i)); }}
                        className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white rounded-full flex items-center justify-center">
                        <X size={9} />
                      </button>
                    </div>
                  ))}
                  {reviewImages.length < 5 && (
                    <button onClick={() => reviewImageRef.current?.click()}
                      className="w-16 h-16 border-2 border-dashed border-gray-200 rounded-lg flex flex-col items-center justify-center text-gray-300 hover:border-tea-300 transition-colors">
                      <Camera size={16} /><span className="text-xs mt-0.5">사진</span>
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
              <div className="flex gap-2">
                <button onClick={() => setShowReviewForm(false)} className="flex-1 py-2.5 rounded-xl text-sm font-medium border border-gray-200 text-gray-600 hover:bg-gray-50">취소</button>
                <button
                  onClick={handleReviewSubmit}
                  disabled={submitReviewMutation.isPending}
                  className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white transition-colors"
                  style={{ backgroundColor: themeColor }}>
                  {submitReviewMutation.isPending ? '등록 중...' : '리뷰 등록'}
                </button>
              </div>
            </div>
          )}

          {/* 리뷰 목록 */}
          {(reviewsData?.data || []).length === 0 && !showReviewForm ? (
            <div className="bg-white rounded-2xl border border-gray-100 p-6 text-center">
              <Star size={32} className="mx-auto text-gray-200 mb-2" />
              <p className="text-sm text-gray-400">아직 리뷰가 없습니다</p>
              {accessToken && (
                <button onClick={() => setShowReviewForm(true)} className="mt-3 text-sm font-medium text-tea-600 hover:underline">
                  첫 리뷰 작성하기
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {(reviewsData?.data || []).map((review: any) => (
                <div key={review.id} className="bg-white rounded-2xl border border-gray-100 p-4 space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="flex gap-0.5">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Star key={i} size={13} className={i < review.rating ? 'fill-amber-400 text-amber-400' : 'text-gray-200'} />
                      ))}
                    </div>
                    <span className="text-xs font-medium text-gray-700">{review.buyerName}</span>
                    <span className="text-xs text-gray-300">{new Date(review.createdAt).toLocaleDateString('ko-KR')}</span>
                  </div>
                  {review.content && <p className="text-sm text-gray-700 leading-relaxed">{review.content}</p>}
                  {review.images?.length > 0 && (
                    <div className="flex gap-2 flex-wrap">
                      {review.images.map((img: string, i: number) => (
                        <img key={i} src={imgUrl(img)!} alt="" className="w-16 h-16 rounded-lg object-cover" />
                      ))}
                    </div>
                  )}
                  {review.sellerReply && (
                    <div className="bg-gray-50 rounded-xl p-3 border-l-3 border-tea-400">
                      <p className="text-xs font-semibold text-tea-700 mb-1">판매자 답변</p>
                      <p className="text-xs text-gray-600">{review.sellerReply}</p>
                    </div>
                  )}
                </div>
              ))}
              {reviewsData?.pagination && reviewsData.pagination.totalPages > 1 && (
                <div className="flex justify-center gap-2 mt-2">
                  <button onClick={() => setReviewPage((p) => Math.max(1, p - 1))} disabled={reviewPage === 1}
                    className="px-3 py-1.5 text-xs border border-gray-200 rounded-lg disabled:opacity-40">이전</button>
                  <span className="px-3 py-1.5 text-xs text-gray-500">{reviewPage}/{reviewsData.pagination.totalPages}</span>
                  <button onClick={() => setReviewPage((p) => Math.min(reviewsData.pagination.totalPages, p + 1))} disabled={reviewPage === reviewsData.pagination.totalPages}
                    className="px-3 py-1.5 text-xs border border-gray-200 rounded-lg disabled:opacity-40">다음</button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* 모바일 하단 고정 버튼 */}
      {!isSoldOut && (
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
      {isSoldOut && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 px-4 py-3 md:hidden z-30">
          <button disabled className="w-full py-3 rounded-xl text-sm font-semibold bg-gray-200 text-gray-400">품절</button>
        </div>
      )}
    </div>
  );
}