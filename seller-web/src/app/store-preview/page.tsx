'use client';

import { useQuery } from '@tanstack/react-query';
import { storeApi, productApi } from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import Link from 'next/link';
import { Loader2, ArrowLeft, Eye, ShoppingBag, Star } from 'lucide-react';
import { clsx } from 'clsx';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? '';
const imgUrl = (p?: string | null) => p ? (p.startsWith('/') ? `${API_URL}${p}` : p) : null;

export default function StorePreviewPage() {
  const router = useRouter();
  const { isAuthenticated, _hasHydrated } = useAuthStore();

  useEffect(() => {
    if (_hasHydrated && !isAuthenticated) router.replace('/auth/login');
  }, [isAuthenticated, _hasHydrated, router]);

  const { data: store, isLoading: storeLoading } = useQuery({
    queryKey: ['store-preview'],
    queryFn: () => storeApi.getMyStore().then((r) => r.data.data),
    enabled: isAuthenticated,
  });

  const { data: productsData, isLoading: productsLoading } = useQuery({
    queryKey: ['store-preview-products'],
    queryFn: () => productApi.getProducts({ limit: 50, status: 'active' }).then((r) => r.data),
    enabled: isAuthenticated,
  });

  if (!_hasHydrated || storeLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <Loader2 size={28} className="animate-spin text-tea-600" />
      </div>
    );
  }

  const products = (productsData?.data || []) as any[];

  const themeColor = store?.themeColor || '#2D6A4F';

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 미리보기 모드 배너 */}
      <div className="sticky top-0 z-50 flex items-center justify-between px-4 py-2.5 bg-gray-900 text-white text-sm">
        <div className="flex items-center gap-2">
          <Eye size={15} className="text-tea-400" />
          <span className="font-medium">소비자 미리보기 모드</span>
          <span className="text-gray-400 text-xs hidden sm:inline">— 실제 구매자에게 보이는 화면입니다</span>
        </div>
        <Link href="/dashboard" className="flex items-center gap-1.5 text-gray-300 hover:text-white transition-colors text-xs">
          <ArrowLeft size={13} /> 관리자로 돌아가기
        </Link>
      </div>

      {/* 스토어 헤더 */}
      <div className="bg-white">
        {/* 배너 */}
        {store?.bannerUrl ? (
          <div className="w-full h-40 sm:h-56 overflow-hidden">
            <img src={imgUrl(store.bannerUrl)!} alt="스토어 배너" className="w-full h-full object-cover" />
          </div>
        ) : (
          <div className="w-full h-32 sm:h-44" style={{ backgroundColor: themeColor + '22' }} />
        )}

        {/* 스토어 정보 */}
        <div className="max-w-4xl mx-auto px-4 pb-5">
          <div className="flex items-end gap-4 -mt-8 mb-4">
            {store?.logoUrl ? (
              <img src={imgUrl(store.logoUrl)!} alt="로고"
                className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl object-cover border-4 border-white shadow-md shrink-0" />
            ) : (
              <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl border-4 border-white shadow-md shrink-0"
                style={{ backgroundColor: themeColor + '22' }} />
            )}
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl sm:text-2xl font-bold text-gray-900">{store?.name || '스토어'}</h1>
              {store?.isOpen ? (
                <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-green-100 text-green-700">영업중</span>
              ) : (
                <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-gray-100 text-gray-500">휴무</span>
              )}
            </div>
            {store?.description && (
              <p className="text-sm text-gray-500 mt-1 leading-relaxed">{store.description}</p>
            )}
          </div>
        </div>
      </div>

      {/* 상품 목록 */}
      <div className="max-w-4xl mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-bold text-gray-900 flex items-center gap-2">
            <ShoppingBag size={18} style={{ color: themeColor }} />
            상품 목록
            <span className="text-sm font-normal text-gray-400">({products.length}개)</span>
          </h2>
        </div>

        {productsLoading ? (
          <div className="flex items-center justify-center h-40">
            <Loader2 size={24} className="animate-spin text-tea-600" />
          </div>
        ) : products.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 gap-3 text-center bg-white rounded-2xl border border-gray-100">
            <p className="text-gray-500 font-medium">등록된 상품이 없습니다</p>
            <Link href="/dashboard/products/new"
              className="text-sm text-tea-600 hover:underline">첫 상품 등록하기 →</Link>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 sm:gap-4">
            {products.map((product: any) => (
              <div key={product.id} className="bg-white rounded-2xl overflow-hidden border border-gray-100 hover:shadow-md transition-shadow group">
                {/* 상품 이미지 */}
                <div className="aspect-square overflow-hidden bg-gray-50 relative">
                  {product.thumbnail ? (
                    <img src={imgUrl(product.thumbnail)!} alt={product.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                  ) : (
                    <div className="w-full h-full bg-gray-100" />
                  )}
                  {product.discountRate && (
                    <div className="absolute top-2 left-2 bg-red-500 text-white text-xs font-bold px-1.5 py-0.5 rounded-md">
                      {product.discountRate}%
                    </div>
                  )}
                  {product.isSignature && (
                    <div className="absolute top-2 right-2">
                      <Star size={14} className="fill-amber-400 text-amber-400" />
                    </div>
                  )}
                </div>

                {/* 상품 정보 */}
                <div className="p-3">
                  {product.teaType && (
                    <p className="text-xs text-gray-400 mb-0.5">{product.teaType}</p>
                  )}
                  <h3 className="text-sm font-semibold text-gray-900 line-clamp-2 leading-snug mb-1.5">
                    {product.name}
                  </h3>
                  <div>
                    <span className="text-base font-bold text-gray-900">
                      {product.price.toLocaleString()}원
                    </span>
                    {product.originalPrice && (
                      <span className="text-xs text-gray-400 line-through ml-1.5">
                        {product.originalPrice.toLocaleString()}원
                      </span>
                    )}
                  </div>
                  {product.stock === 0 && (
                    <p className="text-xs text-red-500 mt-1 font-medium">품절</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 스토어 정책 */}
      {(store?.shippingPolicy || store?.returnPolicy) && (
        <div className="max-w-4xl mx-auto px-4 pb-8">
          <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-3">
            <h3 className="font-semibold text-gray-800 text-sm">스토어 정책</h3>
            {store.shippingPolicy && (
              <div>
                <p className="text-xs text-gray-400 mb-1">배송 정책</p>
                <p className="text-sm text-gray-600 whitespace-pre-line">{store.shippingPolicy}</p>
              </div>
            )}
            {store.returnPolicy && (
              <div>
                <p className="text-xs text-gray-400 mb-1">반품/교환 정책</p>
                <p className="text-sm text-gray-600 whitespace-pre-line">{store.returnPolicy}</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
