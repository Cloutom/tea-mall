'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { consumerAuthApi } from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import NavBar from '@/components/NavBar';
import Link from 'next/link';
import { Heart, ShoppingBag, Store, Package } from 'lucide-react';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? '';
const imgUrl = (p?: string | null) => p ? (p.startsWith('/') ? `${API_URL}${p}` : p) : null;

export default function WishlistsPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { consumer, accessToken } = useAuthStore();
  const [tab, setTab] = useState<'store' | 'product'>('store');

  useEffect(() => {
    if (!consumer) router.replace('/auth/login?redirect=%2Fprofile%2Fwishlists');
  }, [consumer, router]);

  if (!consumer) return null;

  const { data: storeWishlists, isLoading: storeLoading } = useQuery({
    queryKey: ['my-wishlists'],
    queryFn: () => consumerAuthApi.getWishlists(accessToken!).then((r) => r.data.data),
    enabled: !!accessToken,
  });

  const { data: productWishlists, isLoading: productLoading } = useQuery({
    queryKey: ['product-wishlists'],
    queryFn: () => consumerAuthApi.getProductWishlists(accessToken!).then((r) => r.data.data),
    enabled: !!accessToken,
  });

  const removeStoreMutation = useMutation({
    mutationFn: (slug: string) => consumerAuthApi.toggleWishlist(slug, accessToken!),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['my-wishlists'] }),
  });

  const removeProductMutation = useMutation({
    mutationFn: (productId: string) => consumerAuthApi.toggleProductWishlist(productId, accessToken!),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['product-wishlists'] }),
  });

  const stores: any[] = storeWishlists || [];
  const products: any[] = productWishlists || [];
  const isLoading = tab === 'store' ? storeLoading : productLoading;

  return (
    <div className="min-h-screen bg-tea-50 pb-16">
      <NavBar title="찜 목록" back={true} />

      <div className="max-w-lg mx-auto px-4 py-4">
        {/* 탭 */}
        <div className="flex gap-1 bg-gray-100 rounded-xl p-1 mb-5">
          <button onClick={() => setTab('store')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-sm font-medium transition-colors ${tab === 'store' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'}`}>
            <Store size={15} /> 스토어 {stores.length > 0 && <span className="text-xs text-tea-600">({stores.length})</span>}
          </button>
          <button onClick={() => setTab('product')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-sm font-medium transition-colors ${tab === 'product' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'}`}>
            <Package size={15} /> 상품 {products.length > 0 && <span className="text-xs text-tea-600">({products.length})</span>}
          </button>
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-white rounded-2xl border border-gray-100 p-4 animate-pulse">
                <div className="flex gap-3">
                  <div className="w-14 h-14 rounded-xl bg-gray-200" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-gray-200 rounded w-1/2" />
                    <div className="h-3 bg-gray-200 rounded w-3/4" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : tab === 'store' ? (
          /* ── 스토어 찜 ── */
          stores.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center">
                <Store size={28} className="text-gray-300" />
              </div>
              <p className="text-gray-500 font-medium">찜한 스토어가 없습니다</p>
              <p className="text-gray-400 text-sm text-center">스토어를 찜하면 신상품, 할인 소식을<br/>알림으로 받을 수 있어요</p>
            </div>
          ) : (
            <div className="space-y-3">
              {stores.map((w: any) => {
                const s = w.store;
                if (!s) return null;
                return (
                  <div key={w.id} className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
                    <Link href={`/store/${s.slug}`} className="flex gap-3 p-4 hover:bg-gray-50 transition-colors">
                      <div className="w-14 h-14 rounded-xl overflow-hidden bg-gray-100 shrink-0 flex items-center justify-center">
                        {s.logoUrl ? (
                          <img src={imgUrl(s.logoUrl)!} alt={s.name} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center" style={{ backgroundColor: s.themeColor || '#2D6A4F' }}>
                            <span className="text-white font-bold">{s.name?.[0]}</span>
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-gray-900 text-sm">{s.name}</p>
                        {s.description && <p className="text-xs text-gray-400 truncate mt-0.5">{s.description}</p>}
                        <div className="flex items-center gap-3 mt-1.5 text-xs text-gray-400">
                          <span className="flex items-center gap-1"><ShoppingBag size={11} /> 상품 {s._count?.products || 0}개</span>
                          <span className="flex items-center gap-1 text-red-400"><Heart size={11} className="fill-red-400" /> {s._count?.wishlists || 0}</span>
                        </div>
                      </div>
                    </Link>
                    <div className="border-t border-gray-50 px-4 py-2.5 flex justify-end">
                      <button onClick={() => removeStoreMutation.mutate(s.slug)}
                        className="text-xs text-gray-400 hover:text-red-500 transition-colors flex items-center gap-1">
                        <Heart size={12} /> 찜 해제
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )
        ) : (
          /* ── 제품 찜 ── */
          products.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center">
                <Heart size={28} className="text-gray-300" />
              </div>
              <p className="text-gray-500 font-medium">찜한 상품이 없습니다</p>
              <p className="text-gray-400 text-sm text-center">상품을 찜하면 할인, 품절 임박 소식을<br/>알림으로 받을 수 있어요</p>
            </div>
          ) : (
            <div className="space-y-3">
              {products.map((w: any) => {
                const p = w.product;
                if (!p) return null;
                const isSoldOut = !p.isActive || p.stock <= 0;
                return (
                  <div key={w.id} className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
                    <Link href={`/store/${p.store?.slug}/products/${p.id}`} className="flex gap-3 p-4 hover:bg-gray-50 transition-colors">
                      <div className="w-16 h-16 rounded-xl overflow-hidden bg-gray-100 shrink-0">
                        {p.thumbnail ? (
                          <img src={imgUrl(p.thumbnail)!} alt={p.name} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-gray-300">
                            <Package size={24} />
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-gray-400">{p.store?.name}</p>
                        <p className="font-bold text-gray-900 text-sm mt-0.5 truncate">{p.name}</p>
                        <div className="flex items-center gap-2 mt-1">
                          {p.discountRate > 0 && <span className="text-xs font-bold text-red-500">{p.discountRate}%</span>}
                          <span className="text-sm font-bold text-gray-900">{p.price?.toLocaleString()}원</span>
                          {p.originalPrice && p.originalPrice !== p.price && (
                            <span className="text-xs text-gray-400 line-through">{p.originalPrice.toLocaleString()}원</span>
                          )}
                        </div>
                        {isSoldOut && <span className="text-xs text-red-500 font-medium mt-0.5">품절</span>}
                        {!isSoldOut && p.stock <= 5 && <span className="text-xs text-amber-600 font-medium mt-0.5">잔여 {p.stock}개</span>}
                      </div>
                    </Link>
                    <div className="border-t border-gray-50 px-4 py-2.5 flex justify-end">
                      <button onClick={() => removeProductMutation.mutate(p.id)}
                        className="text-xs text-gray-400 hover:text-red-500 transition-colors flex items-center gap-1">
                        <Heart size={12} /> 찜 해제
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )
        )}
      </div>
    </div>
  );
}
