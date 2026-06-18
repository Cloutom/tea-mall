'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { publicApi } from '@/lib/api';
import Link from 'next/link';
import { Search, Store, ShoppingBag, ArrowLeft, Package } from 'lucide-react';
import NavBar from '@/components/NavBar';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? '';
const imgUrl = (p?: string | null) => p ? (p.startsWith('/') ? `${API_URL}${p}` : p) : null;

function SearchContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialQ = searchParams.get('q') || '';

  const [input, setInput] = useState(initialQ);
  const [q, setQ] = useState(initialQ);

  useEffect(() => { setInput(initialQ); setQ(initialQ); }, [initialQ]);

  const { data, isLoading } = useQuery({
    queryKey: ['search', q],
    queryFn: () => publicApi.search(q).then((r) => r.data.data),
    enabled: q.trim().length > 0,
  });

  const stores: any[] = data?.stores || [];
  const products: any[] = data?.products || [];

  const handleSearch = () => {
    if (!input.trim()) return;
    setQ(input.trim());
    router.push(`/search?q=${encodeURIComponent(input.trim())}`, { scroll: false });
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <NavBar />

      {/* 검색 바 */}
      <div className="bg-white border-b border-gray-100 px-4 py-3 sticky top-14 z-20">
        <div className="max-w-3xl mx-auto flex gap-2">
          <button onClick={() => router.back()} className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg">
            <ArrowLeft size={18} />
          </button>
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleSearch(); }}
              placeholder="스토어, 상품명 통합 검색..."
              className="w-full pl-9 pr-4 py-2.5 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:border-tea-400 focus:bg-white transition-colors"
              autoFocus
            />
          </div>
          <button
            onClick={handleSearch}
            className="px-4 py-2 bg-tea-700 text-white text-sm font-medium rounded-xl hover:bg-tea-800 transition-colors"
          >
            검색
          </button>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-5 space-y-6">
        {!q.trim() ? (
          <div className="flex flex-col items-center justify-center h-56 gap-3 text-gray-400">
            <Search size={36} className="text-gray-200" />
            <p className="text-sm">검색어를 입력해주세요</p>
          </div>
        ) : isLoading ? (
          <div className="space-y-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-16 bg-white rounded-2xl animate-pulse border border-gray-100" />
            ))}
          </div>
        ) : stores.length === 0 && products.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-56 gap-3 text-gray-400">
            <Search size={36} className="text-gray-200" />
            <p className="text-sm font-medium text-gray-600">"{q}" 검색 결과가 없습니다</p>
            <p className="text-xs">다른 검색어를 시도해보세요</p>
          </div>
        ) : (
          <>
            {/* 스토어 결과 */}
            {stores.length > 0 && (
              <section>
                <h2 className="font-bold text-gray-900 text-sm flex items-center gap-2 mb-3">
                  <Store size={15} className="text-tea-600" />
                  스토어 <span className="text-gray-400 font-normal">({stores.length})</span>
                </h2>
                <div className="space-y-2">
                  {stores.map((store) => (
                    <Link key={store.id} href={`/store/${store.slug}`}
                      className="flex items-center gap-3 bg-white rounded-2xl border border-gray-100 p-3 hover:shadow-sm transition-shadow">
                      {store.logoUrl ? (
                        <img src={imgUrl(store.logoUrl)!} alt={store.name}
                          className="w-11 h-11 rounded-xl object-cover border border-gray-100 bg-white shrink-0" />
                      ) : (
                        <div className="w-11 h-11 rounded-xl shrink-0 flex items-center justify-center"
                          style={{ backgroundColor: store.themeColor || '#2D6A4F' }}>
                          <span className="text-white text-sm font-bold">{store.name?.[0]}</span>
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-gray-900 text-sm truncate">{store.name}</p>
                        {store.description && (
                          <p className="text-xs text-gray-400 truncate">{store.description}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-1 text-xs text-gray-400 shrink-0">
                        <ShoppingBag size={11} />
                        <span>{store._count?.products || 0}개</span>
                      </div>
                    </Link>
                  ))}
                </div>
              </section>
            )}

            {/* 상품 결과 */}
            {products.length > 0 && (
              <section>
                <h2 className="font-bold text-gray-900 text-sm flex items-center gap-2 mb-3">
                  <Package size={15} className="text-tea-600" />
                  상품 <span className="text-gray-400 font-normal">({products.length})</span>
                </h2>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {products.map((product) => (
                    <Link key={product.id} href={`/store/${product.store?.slug}/products/${product.id}`}
                      className="bg-white rounded-2xl border border-gray-100 overflow-hidden hover:shadow-sm transition-shadow group">
                      <div className="h-32 bg-gray-100 overflow-hidden">
                        {product.thumbnail ? (
                          <img src={imgUrl(product.thumbnail)!} alt={product.name}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <Package size={24} className="text-gray-300" />
                          </div>
                        )}
                      </div>
                      <div className="p-3">
                        <p className="text-xs text-gray-400 truncate mb-0.5">{product.store?.name}</p>
                        <p className="font-medium text-gray-900 text-sm line-clamp-2 leading-snug">{product.name}</p>
                        <div className="flex items-baseline gap-1 mt-1.5">
                          {product.discountRate ? (
                            <>
                              <span className="text-xs text-red-500 font-medium">{product.discountRate}%</span>
                              <span className="font-bold text-gray-900 text-sm">{product.price.toLocaleString()}원</span>
                            </>
                          ) : (
                            <span className="font-bold text-gray-900 text-sm">{product.price.toLocaleString()}원</span>
                          )}
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default function SearchPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gray-50"><NavBar /></div>}>
      <SearchContent />
    </Suspense>
  );
}
