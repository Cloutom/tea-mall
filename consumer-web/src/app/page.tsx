'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { publicApi, consumerAuthApi } from '@/lib/api';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Search, Store, ShoppingBag, Sparkles, ChevronRight, Medal, ChevronLeft, X } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import NavBar from '@/components/NavBar';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? '';
const imgUrl = (p?: string | null) => p ? (p.startsWith('/') ? `${API_URL}${p}` : p) : null;

const TEA_CATEGORIES = [
  { name: '녹차', query: '녹차' },
  { name: '홍차', query: '홍차' },
  { name: '백차', query: '백차' },
  { name: '우롱차', query: '우롱차' },
  { name: '보이차', query: '보이차' },
  { name: '허브차', query: '허브차' },
  { name: '말차', query: '말차' },
  { name: '블렌딩', query: '블렌딩' },
];

function ProductCard({ product }: { product: any }) {
  const isNew = product.newBadgeDays > 0 &&
    (new Date().getTime() - new Date(product.createdAt).getTime()) / (1000 * 60 * 60 * 24) <= product.newBadgeDays;
  const thumb = imgUrl(product.thumbnail);
  const logoUrl = imgUrl(product.store?.logoUrl);

  return (
    <Link
      href={`/store/${product.store.slug}/products/${product.id}`}
      className="bg-white rounded-2xl border border-gray-100 overflow-hidden hover:shadow-md transition-shadow shrink-0 group"
      style={{ width: '148px' }}
    >
      <div className="relative overflow-hidden" style={{ height: '140px' }}>
        {thumb ? (
          <img src={thumb} alt={product.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
        ) : (
          <div className="w-full h-full bg-tea-50 flex items-center justify-center">
            <ShoppingBag size={28} className="text-tea-200" />
          </div>
        )}
        {isNew && (
          <span className="absolute top-2 left-2 text-[10px] font-bold bg-tea-600 text-white px-1.5 py-0.5 rounded-md">NEW</span>
        )}
        {product.discountRate > 0 && (
          <span className="absolute top-2 right-2 text-[10px] font-bold bg-red-500 text-white px-1.5 py-0.5 rounded-md">{product.discountRate}%</span>
        )}
        {product.stock === 0 && (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
            <span className="text-white text-xs font-bold">품절</span>
          </div>
        )}
      </div>
      <div className="p-2.5">
        <div className="flex items-center gap-1 mb-1">
          {logoUrl ? (
            <img src={logoUrl} alt={product.store.name} className="w-4 h-4 rounded object-cover bg-white border border-gray-100" />
          ) : (
            <div className="w-4 h-4 rounded flex items-center justify-center shrink-0"
              style={{ backgroundColor: product.store.themeColor || '#2D6A4F' }}>
              <span className="text-white text-[8px] font-bold">{product.store.name?.[0]}</span>
            </div>
          )}
          <span className="text-[10px] text-gray-400 truncate">{product.store.name}</span>
        </div>
        <p className="text-xs font-semibold text-gray-800 truncate leading-snug">{product.name}</p>
        <div className="flex items-baseline gap-1 mt-1">
          {product.discountRate > 0 && (
            <span className="text-[10px] text-gray-300 line-through">{product.originalPrice?.toLocaleString()}</span>
          )}
          <span className="text-sm font-bold text-gray-900">{product.price.toLocaleString()}원</span>
        </div>
      </div>
    </Link>
  );
}

function ProductSkeleton() {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden shrink-0 animate-pulse" style={{ width: '148px' }}>
      <div className="bg-gray-200" style={{ height: '140px' }} />
      <div className="p-2.5 space-y-1.5">
        <div className="h-3 bg-gray-200 rounded w-2/3" />
        <div className="h-3 bg-gray-200 rounded w-full" />
        <div className="h-4 bg-gray-200 rounded w-1/2" />
      </div>
    </div>
  );
}

function TeaCategorySection() {
  const [selectedCategory, setSelectedCategory] = useState<string>(TEA_CATEGORIES[0].query);
  const scrollRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);
  const startX = useRef(0);
  const scrollLeft = useRef(0);

  const { data: products, isLoading } = useQuery({
    queryKey: ['tea-type-products', selectedCategory],
    queryFn: () => publicApi.getProductsByTeaType(selectedCategory!).then((r) => r.data.data),
    enabled: selectedCategory.length > 0,
    staleTime: 60 * 1000,
  });

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (!scrollRef.current) return;
    isDragging.current = true;
    startX.current = e.pageX - scrollRef.current.offsetLeft;
    scrollLeft.current = scrollRef.current.scrollLeft;
    scrollRef.current.style.cursor = 'grabbing';
  }, []);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging.current || !scrollRef.current) return;
    e.preventDefault();
    const x = e.pageX - scrollRef.current.offsetLeft;
    const walk = (x - startX.current) * 1.2;
    scrollRef.current.scrollLeft = scrollLeft.current - walk;
  }, []);

  const stopDrag = useCallback(() => {
    isDragging.current = false;
    if (scrollRef.current) scrollRef.current.style.cursor = 'grab';
  }, []);

  return (
    <section className="py-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-bold text-gray-900 text-base flex items-center gap-2">
          <span className="w-1 h-5 bg-tea-600 rounded-full" />
          차 종류별 탐색
        </h2>
        {selectedCategory && (
          <Link
            href={`/search?q=${encodeURIComponent(selectedCategory)}`}
            className="flex items-center text-xs text-tea-700 hover:underline gap-0.5"
          >
            전체보기 <ChevronRight size={13} />
          </Link>
        )}
      </div>

      {/* 카테고리 탭 */}
      <div className="flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
        {TEA_CATEGORIES.map((cat) => (
          <button
            key={cat.name}
            onClick={() => setSelectedCategory(cat.query)}
            className={[
              'shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-all border',
              selectedCategory === cat.query
                ? 'bg-tea-700 text-white border-tea-700 shadow-sm'
                : 'bg-white text-gray-600 border-gray-200 hover:border-tea-400 hover:text-tea-700',
            ].join(' ')}
          >
            {cat.name}
          </button>
        ))}
      </div>

      {/* 선택된 카테고리 상품 슬라이더 */}
      {selectedCategory && (
        <div className="mt-4">
          {isLoading ? (
            <div className="flex gap-3 overflow-x-hidden pb-2">
              {Array.from({ length: 5 }).map((_, i) => <ProductSkeleton key={i} />)}
            </div>
          ) : !products || products.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-36 gap-2 bg-white rounded-2xl border border-gray-100">
              <ShoppingBag size={28} className="text-gray-200" />
              <p className="text-gray-400 text-sm">{selectedCategory} 상품이 없습니다</p>
            </div>
          ) : (
            <div
              ref={scrollRef}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={stopDrag}
              onMouseLeave={stopDrag}
              className="flex gap-3 overflow-x-auto pb-3 select-none"
              style={{ scrollbarWidth: 'none', msOverflowStyle: 'none', cursor: 'grab' }}
            >
              {products.map((product: any) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  );
}

function StoreCard({ store, rank }: { store: any; rank: number }) {
  const isTop3 = rank <= 3;
  const rankColors = ['#FFD700', '#C0C0C0', '#CD7F32'];
  const rankLabels = ['1위', '2위', '3위'];

  return (
    <Link
      href={`/store/${store.slug}`}
      className="bg-white rounded-2xl overflow-hidden border border-gray-100 hover:shadow-md transition-shadow group block shrink-0"
      style={{ width: '180px' }}
    >
      <div className="relative" style={{ height: '110px' }}>
        <div className="absolute inset-0 overflow-hidden rounded-t-2xl">
          {store.bannerUrl ? (
            <img src={imgUrl(store.bannerUrl)!} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
          ) : (
            <div className="w-full h-full" style={{ background: `linear-gradient(135deg, ${store.themeColor || '#2D6A4F'}55, ${store.themeColor || '#2D6A4F'}22)` }} />
          )}
        </div>
        {isTop3 && (
          <div className="absolute top-2 left-2 z-10 flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold text-white"
            style={{ background: rankColors[rank - 1] }}>
            <Medal size={11} />
            {rankLabels[rank - 1]}
          </div>
        )}
        {/* 로고 — 배너 위에 z-10으로 항상 표시 */}
        <div className="absolute bottom-0 translate-y-1/2 left-3 z-10">
          {store.logoUrl ? (
            <img src={imgUrl(store.logoUrl)!} alt={store.name}
              className="w-9 h-9 rounded-lg object-cover border-2 border-white shadow-sm bg-white" />
          ) : (
            <div className="w-9 h-9 rounded-lg border-2 border-white shadow-sm flex items-center justify-center"
              style={{ backgroundColor: store.themeColor || '#2D6A4F' }}>
              <span className="text-white text-xs font-bold">{store.name?.[0] || 'T'}</span>
            </div>
          )}
        </div>
      </div>
      <div className="p-3 pt-6">
        <p className="font-bold text-gray-900 text-sm truncate">{store.name}</p>
        {store.description && (
          <p className="text-xs text-gray-400 truncate mt-0.5">{store.description}</p>
        )}
        <div className="flex items-center gap-2 mt-1.5">
          <span className="flex items-center gap-0.5 text-xs text-gray-400"><ShoppingBag size={10} className="text-gray-300" /> 상품 {store._count?.products || 0}개</span>
        </div>
      </div>
    </Link>
  );
}

function HeroBanner() {
  const { data: banners } = useQuery({
    queryKey: ['main-banners'],
    queryFn: () => publicApi.getMainBanners().then((r) => r.data.data),
    staleTime: 60_000,
  });

  const [current, setCurrent] = useState(0);
  const items: any[] = banners || [];

  useEffect(() => {
    if (items.length <= 1) return;
    const timer = setInterval(() => setCurrent((c) => (c + 1) % items.length), 5000);
    return () => clearInterval(timer);
  }, [items.length]);

  if (!items.length) {
    return (
      <div className="bg-gradient-to-br from-tea-800 to-tea-600 text-white py-8 px-4">
        <div className="max-w-5xl mx-auto">
          <p className="text-tea-200 text-xs font-medium mb-1">한국 프리미엄 차 전문 마켓플레이스</p>
          <h1 className="text-2xl sm:text-3xl font-bold">teabri</h1>
          <p className="text-tea-200 text-sm mt-1">전국 차 전문 스토어를 한 곳에서</p>
        </div>
      </div>
    );
  }

  const banner = items[current];
  const inner = (
    <div className="relative w-full overflow-hidden" style={{ height: `${banner.height || 300}px` }}>
      <img src={imgUrl(banner.imageUrl)!} alt={banner.title || ''} className="w-full h-full object-cover" />
      {banner.title && (
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-4">
          <p className="text-white font-semibold text-sm max-w-5xl mx-auto">{banner.title}</p>
        </div>
      )}
      {items.length > 1 && (
        <>
          <button onClick={(e) => { e.preventDefault(); setCurrent((c) => (c - 1 + items.length) % items.length); }}
            className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 bg-black/30 rounded-full flex items-center justify-center text-white hover:bg-black/50">
            <ChevronLeft size={18} />
          </button>
          <button onClick={(e) => { e.preventDefault(); setCurrent((c) => (c + 1) % items.length); }}
            className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 bg-black/30 rounded-full flex items-center justify-center text-white hover:bg-black/50">
            <ChevronRight size={18} />
          </button>
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1.5">
            {items.map((_: any, i: number) => (
              <button key={i} onClick={(e) => { e.preventDefault(); setCurrent(i); }}
                className={`w-2 h-2 rounded-full transition-colors ${i === current ? 'bg-white' : 'bg-white/40'}`} />
            ))}
          </div>
        </>
      )}
    </div>
  );

  return banner.linkUrl ? <a href={banner.linkUrl} target="_blank" rel="noopener noreferrer">{inner}</a> : inner;
}

function MainPopupOverlay() {
  const { data: popups } = useQuery({
    queryKey: ['main-popups'],
    queryFn: () => publicApi.getMainPopups().then((r) => r.data.data),
    staleTime: 60_000,
  });

  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  useEffect(() => {
    try {
      const hidden = JSON.parse(localStorage.getItem('main-popup-hidden') || '{}');
      const now = Date.now();
      const ids = new Set<string>();
      for (const [id, exp] of Object.entries(hidden)) {
        if ((exp as number) > now) ids.add(id);
      }
      setDismissed(ids);
    } catch {}
  }, []);

  const items: any[] = (popups || []).filter((p: any) => !dismissed.has(p.id));
  if (!items.length) return null;

  const dismiss = (id: string, hideWeek: boolean) => {
    setDismissed((prev) => { const next = new Set(Array.from(prev)); next.add(id); return next; });
    if (hideWeek) {
      try {
        const hidden = JSON.parse(localStorage.getItem('main-popup-hidden') || '{}');
        hidden[id] = Date.now() + 7 * 24 * 60 * 60 * 1000;
        localStorage.setItem('main-popup-hidden', JSON.stringify(hidden));
      } catch {}
    }
  };

  const popup = items[0];
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => dismiss(popup.id, false)}>
      <div className="bg-white rounded-2xl overflow-hidden shadow-2xl" style={{ maxWidth: popup.width, width: '100%' }} onClick={(e) => e.stopPropagation()}>
        {popup.imageUrl && (
          popup.linkUrl ? (
            <a href={popup.linkUrl} target="_blank" rel="noopener noreferrer">
              <img src={imgUrl(popup.imageUrl)!} alt="" className="w-full object-cover" style={{ maxHeight: popup.height }} />
            </a>
          ) : (
            <img src={imgUrl(popup.imageUrl)!} alt="" className="w-full object-cover" style={{ maxHeight: popup.height }} />
          )
        )}
        <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
          {popup.closeType === 'hide_week' && (
            <button onClick={() => dismiss(popup.id, true)} className="text-xs text-gray-400 hover:text-gray-600">일주일간 보지 않기</button>
          )}
          <button onClick={() => dismiss(popup.id, false)} className="text-xs text-gray-500 hover:text-gray-700 ml-auto flex items-center gap-1">
            <X size={12} /> 닫기
          </button>
        </div>
      </div>
    </div>
  );
}

function MyTeaRecommendation() {
  const { consumer, accessToken, updateConsumer } = useAuthStore();

  const { data: meData } = useQuery({
    queryKey: ['consumer-me-tea', accessToken],
    queryFn: () => consumerAuthApi.me(accessToken!).then((r) => {
      const data = r.data.data;
      if (data?.teaProfile && consumer && !consumer.teaProfile) {
        updateConsumer({ ...consumer, teaProfile: data.teaProfile, teaScores: data.teaScores });
      }
      return data;
    }),
    enabled: !!accessToken,
    staleTime: 60_000,
  });
  const teaProfile = consumer?.teaProfile || meData?.teaProfile;
  const top3 = teaProfile ? teaProfile.split('-').slice(0, 3) : [];

  const { data: products } = useQuery({
    queryKey: ['my-tea-rec', teaProfile],
    queryFn: () => publicApi.getTeaRecommendations(top3.join(',')).then((r) => r.data.data),
    enabled: top3.length > 0,
  });

  if (!accessToken) return null;
  if (!teaProfile) {
    return (
      <section className="py-4">
        <Link href="/tea-test"
          className="block bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-2xl p-5 hover:shadow-md transition-shadow">
          <h3 className="font-bold text-gray-900 text-sm mb-1">내 취향에 맞는 차를 추천받고 싶다면?</h3>
          <p className="text-xs text-gray-500">차 취향 검사를 완료하면 맞춤 상품을 추천받을 수 있습니다 &rarr;</p>
        </Link>
      </section>
    );
  }
  if (!products || products.length === 0) return null;

  return (
    <section className="py-4">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h2 className="font-bold text-gray-900 text-base flex items-center gap-2">
            <span className="w-1 h-5 bg-amber-500 rounded-full" />
            {consumer?.name}님의 맞춤 Tea
          </h2>
          <div className="flex items-center gap-1.5 mt-1">
            {top3.map((c: string) => (
              <span key={c} className="text-[10px] font-bold bg-tea-50 text-tea-700 px-1.5 py-0.5 rounded">{c}</span>
            ))}
          </div>
        </div>
        <Link href="/tea-test" className="text-xs text-tea-600 hover:underline">재테스트</Link>
      </div>
      <div className="flex gap-3 overflow-x-auto pb-3" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
        {products.map((p: any) => (
          <ProductCard key={p.id} product={p} />
        ))}
      </div>
    </section>
  );
}

function DiscoverSection() {
  const { data: products } = useQuery({
    queryKey: ['discover', Date.now().toString().slice(0, -4)],
    queryFn: () => publicApi.getDiscover().then((r) => r.data.data),
    staleTime: 0,
    refetchOnWindowFocus: true,
  });
  const items: any[] = products || [];
  if (items.length === 0) return null;
  return (
    <section className="py-4 pb-10">
      <h2 className="font-bold text-gray-900 text-base flex items-center gap-2 mb-3">
        <span className="w-1 h-5 bg-purple-500 rounded-full" />
        이런 차는 어때요?
      </h2>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
        {items.slice(0, 8).map((product: any) => (
          <Link key={product.id} href={`/store/${product.store?.slug}/products/${product.id}`}
            className="bg-white rounded-xl border border-gray-100 overflow-hidden hover:shadow-sm transition-shadow group">
            <div className="relative overflow-hidden" style={{ height: '120px' }}>
              {imgUrl(product.thumbnail) ? (
                <img src={imgUrl(product.thumbnail)!} alt={product.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
              ) : (
                <div className="w-full h-full bg-tea-50 flex items-center justify-center">
                  <ShoppingBag size={22} className="text-tea-200" />
                </div>
              )}
              {product.discountRate > 0 && (
                <span className="absolute top-1.5 right-1.5 text-[9px] font-bold bg-red-500 text-white px-1.5 py-0.5 rounded">{product.discountRate}%</span>
              )}
              {product.stock === 0 && (
                <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                  <span className="text-white text-xs font-bold">품절</span>
                </div>
              )}
            </div>
            <div className="p-2">
              <div className="flex items-center gap-1 mb-0.5">
                <span className="text-[9px] text-gray-400 truncate">{product.store?.name}</span>
              </div>
              <p className="text-xs font-semibold text-gray-800 truncate leading-snug">{product.name}</p>
              <p className="text-xs font-bold text-gray-900 mt-0.5">{product.price?.toLocaleString()}원</p>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}

function TeaTestBanner() {
  const { consumer } = useAuthStore();
  if (consumer?.teaProfile) return null;
  return (
    <Link href="/tea-test"
      className="block my-4 bg-gradient-to-r from-tea-700 to-tea-500 rounded-2xl p-5 text-white hover:shadow-lg transition-shadow">
      <div className="flex items-center gap-3">
        <span className="text-lg font-bold text-tea-200 bg-white/20 w-10 h-10 rounded-full flex items-center justify-center">Tea</span>
        <div>
          <p className="font-bold text-sm">나의 차 취향은?</p>
          <p className="text-tea-200 text-xs mt-0.5">간단 20문항 / 상세 40문항 취향 검사</p>
        </div>
      </div>
    </Link>
  );
}

export default function Home() {
  const router = useRouter();
  const [searchInput, setSearchInput] = useState('');

  const { data: storesData, isLoading: storesLoading } = useQuery({
    queryKey: ['all-stores'],
    queryFn: () => publicApi.getAllStores().then((r) => r.data.data),
  });

  const stores: any[] = storesData || [];
  const rankedStores = [...stores].sort((a, b) => (b.score || 0) - (a.score || 0));
  const newStores = stores.filter((s) => s.isNew);

  const handleSearch = () => {
    if (!searchInput.trim()) return;
    router.push(`/search?q=${encodeURIComponent(searchInput.trim())}`);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <NavBar />

      {/* 검색 바 */}
      <div className="bg-white border-b border-gray-100 px-4 py-3 sticky top-14 z-20">
        <div className="max-w-5xl mx-auto">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleSearch(); }}
              placeholder="스토어, 상품명 통합 검색..."
              className="w-full pl-9 pr-20 py-2.5 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:border-tea-400 focus:bg-white transition-colors"
            />
            <button
              onClick={handleSearch}
              className="absolute right-2 top-1/2 -translate-y-1/2 px-3 py-1 bg-tea-700 text-white text-xs font-medium rounded-lg hover:bg-tea-800 transition-colors"
            >
              검색
            </button>
          </div>
        </div>
      </div>

      {/* 히어로 배너 */}
      <HeroBanner />

      {/* 메인 팝업 */}
      <MainPopupOverlay />

      <div className="max-w-5xl mx-auto px-4">

        {/* 내 맞춤 Tea 추천 (로그인 + 프로필 있을 때만) */}
        <MyTeaRecommendation />

        {/* 차 취향 검사 배너 (프로필 없을 때만) */}
        <TeaTestBanner />

        {/* 차 종류별 탐색 */}
        <TeaCategorySection />

        {/* 신생 스토어 추천 */}
        {newStores.length > 0 && (
          <section className="py-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-gray-900 text-base flex items-center gap-2">
                <Sparkles size={16} className="text-amber-500" />
                신규 입점 스토어
                <span className="text-xs font-normal text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">NEW</span>
              </h2>
            </div>
            <div className="flex gap-3 overflow-x-auto pb-2" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
              {newStores.map((store) => (
                <Link
                  key={store.id}
                  href={`/store/${store.slug}`}
                  className="flex items-center gap-3 bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-100 rounded-2xl p-3 shrink-0 hover:shadow-sm transition-shadow"
                  style={{ minWidth: '200px' }}
                >
                  {store.logoUrl ? (
                    <img src={imgUrl(store.logoUrl)!} alt={store.name}
                      className="w-10 h-10 rounded-xl object-cover border border-white shadow-sm bg-white shrink-0" />
                  ) : (
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                      style={{ backgroundColor: store.themeColor || '#2D6A4F' }}>
                      <span className="text-white text-sm font-bold">{store.name?.[0]}</span>
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="font-semibold text-gray-900 text-sm truncate">{store.name}</p>
                    <p className="text-xs text-amber-600">신규 스토어</p>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* 입점 스토어 랭킹 */}
        <section className="py-4 pb-10">
          <div className="flex items-center justify-between mb-2">
            <h2 className="font-bold text-gray-900 text-base flex items-center gap-2">
              <Store size={16} className="text-tea-600" />
              입점 스토어
              {!storesLoading && <span className="text-xs font-normal text-gray-400">({rankedStores.length}개)</span>}
            </h2>
            <Link href="/store" className="flex items-center text-xs text-tea-700 hover:underline gap-0.5">
              전체 보기 <ChevronRight size={13} />
            </Link>
          </div>

          {storesLoading ? (
            <div className="flex gap-4 overflow-x-hidden pb-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="bg-white rounded-2xl overflow-hidden border border-gray-100 shrink-0 animate-pulse" style={{ width: i < 3 ? '220px' : '180px' }}>
                  <div style={{ height: i < 3 ? '120px' : '96px' }} className="bg-gray-200" />
                  <div className="p-3 space-y-2">
                    <div className="h-4 bg-gray-200 rounded w-3/4" />
                    <div className="h-3 bg-gray-200 rounded w-1/2" />
                  </div>
                </div>
              ))}
            </div>
          ) : rankedStores.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 gap-2 bg-white rounded-2xl border border-gray-100">
              <Store size={28} className="text-gray-200" />
              <p className="text-gray-400 text-sm">등록된 스토어가 없습니다</p>
            </div>
          ) : (
            <div className="flex gap-4 overflow-x-auto pb-3" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
              {rankedStores.map((store, i) => (
                <StoreCard key={store.id} store={store} rank={i + 1} />
              ))}
            </div>
          )}
        </section>

        {/* 발견 추천 */}
        <DiscoverSection />

      </div>
    </div>
  );
}
