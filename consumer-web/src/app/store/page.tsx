'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { publicApi } from '@/lib/api';
import Link from 'next/link';
import { Store, ShoppingBag, Search } from 'lucide-react';
import NavBar from '@/components/NavBar';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? '';
const imgUrl = (p?: string | null) => p ? (p.startsWith('/') ? `${API_URL}${p}` : p) : null;

export default function StoreListPage() {
  const [search, setSearch] = useState('');

  const { data: storesData, isLoading } = useQuery({
    queryKey: ['all-stores'],
    queryFn: () => publicApi.getAllStores().then((r) => r.data.data),
  });

  const stores: any[] = storesData || [];
  const filtered = search.trim()
    ? stores.filter((s) =>
        s.name?.toLowerCase().includes(search.toLowerCase()) ||
        s.description?.toLowerCase().includes(search.toLowerCase()))
    : stores;

  return (
    <div className="min-h-screen bg-gray-50">
      <NavBar title="전체 스토어" />

      <div className="max-w-3xl mx-auto px-4 py-5 space-y-4">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="스토어 검색..."
            className="w-full pl-9 pr-4 py-2.5 text-sm bg-white border border-gray-200 rounded-xl focus:outline-none focus:border-tea-400 transition-colors"
          />
        </div>

        {!isLoading && (
          <p className="text-xs text-gray-400">
            {filtered.length}개 스토어
          </p>
        )}

        {isLoading ? (
          <div className="space-y-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="bg-white rounded-2xl border border-gray-100 overflow-hidden animate-pulse">
                <div className="h-28 bg-gray-200" />
                <div className="p-4 flex gap-3">
                  <div className="w-12 h-12 bg-gray-200 rounded-xl shrink-0 -mt-8" />
                  <div className="flex-1 space-y-2 pt-1">
                    <div className="h-4 bg-gray-200 rounded w-1/3" />
                    <div className="h-3 bg-gray-200 rounded w-2/3" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-56 gap-3">
            <Store size={36} className="text-gray-200" />
            <p className="text-sm text-gray-400">
              {search.trim() ? `"${search}" 검색 결과가 없습니다` : '등록된 스토어가 없습니다'}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {filtered.map((store) => (
              <Link
                key={store.id}
                href={`/store/${store.slug}`}
                className="block bg-white rounded-2xl border border-gray-100 overflow-hidden hover:shadow-md transition-shadow group"
              >
                <div className="relative h-28 overflow-hidden">
                  {store.bannerUrl ? (
                    <img
                      src={imgUrl(store.bannerUrl)!}
                      alt=""
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  ) : (
                    <div
                      className="w-full h-full"
                      style={{ background: `linear-gradient(135deg, ${store.themeColor || '#2D6A4F'}44, ${store.themeColor || '#2D6A4F'}11)` }}
                    />
                  )}
                </div>
                <div className="px-4 pb-4 pt-0 flex gap-3">
                  <div className="shrink-0 -mt-6 z-10">
                    {store.logoUrl ? (
                      <img
                        src={imgUrl(store.logoUrl)!}
                        alt={store.name}
                        className="w-12 h-12 rounded-xl object-cover border-2 border-white shadow-sm bg-white"
                      />
                    ) : (
                      <div
                        className="w-12 h-12 rounded-xl border-2 border-white shadow-sm flex items-center justify-center"
                        style={{ backgroundColor: store.themeColor || '#2D6A4F' }}
                      >
                        <span className="text-white text-base font-bold">{store.name?.[0]}</span>
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0 pt-1.5">
                    <p className="font-semibold text-gray-900 text-sm truncate group-hover:text-tea-700 transition-colors">
                      {store.name}
                    </p>
                    {store.description && (
                      <p className="text-xs text-gray-400 truncate mt-0.5">{store.description}</p>
                    )}
                    <div className="flex items-center gap-3 mt-1.5">
                      <span className="flex items-center gap-1 text-xs text-gray-400">
                        <ShoppingBag size={11} />
                        상품 {store._count?.products || 0}개
                      </span>
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
