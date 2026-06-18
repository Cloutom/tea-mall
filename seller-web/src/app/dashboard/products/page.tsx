'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { productApi } from '@/lib/api';
import {
  Plus, Search, Filter, Package, Edit2, Trash2, Eye, EyeOff,
  ChevronLeft, ChevronRight, MoreVertical, ArrowUpDown
} from 'lucide-react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { clsx } from 'clsx';
import { Product } from '@/types';

const TEA_TYPES = ['녹차', '홍차', '백차', '우롱차', '보이차', '허브차', '블렌딩', '말차', '기타'];
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? '';
const imgUrl = (p?: string | null) => p ? (p.startsWith('/') ? `${API_URL}${p}` : p) : null;

export default function ProductsPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [teaType, setTeaType] = useState('');
  const [sort, setSort] = useState('createdAt');
  const [order, setOrder] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const { data, isLoading } = useQuery({
    queryKey: ['products', { search, status, teaType, sort, order, page }],
    queryFn: () => productApi.getProducts({ search, status, sort, order, page, limit: 15 }).then((r) => r.data),
  });

  const toggleMutation = useMutation({
    mutationFn: (id: string) => productApi.toggleStatus(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      toast.success('상태가 변경되었습니다.');
    },
    onError: () => toast.error('상태 변경에 실패했습니다.'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => productApi.deleteProduct(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      toast.success('상품이 비활성화되었습니다.');
    },
    onError: () => toast.error('삭제에 실패했습니다.'),
  });

  const products: Product[] = data?.data || [];
  const pagination = data?.pagination;

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const toggleAll = () => {
    if (selectedIds.length === products.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(products.map((p) => p.id));
    }
  };

  const formatPrice = (price: number, original?: number, rate?: number) => {
    if (rate && original) {
      return (
        <div>
          <span className="font-bold text-gray-900">{price.toLocaleString()}원</span>
          <span className="text-xs text-red-500 ml-1">{rate}%↓</span>
          <div className="text-xs text-gray-400 line-through">{original.toLocaleString()}원</div>
        </div>
      );
    }
    return <span className="font-bold text-gray-900">{price.toLocaleString()}원</span>;
  };

  return (
    <div className="space-y-5 animate-fade-in">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">상품 관리</h1>
          <p className="text-gray-500 text-sm mt-0.5">
            전체 {pagination?.total || 0}개 상품
          </p>
        </div>
        <Link href="/dashboard/products/new" className="btn-primary">
          <Plus size={18} />
          상품 등록
        </Link>
      </div>

      {/* 필터 영역 */}
      <div className="card py-4">
        <div className="flex flex-wrap gap-3">
          {/* 검색 */}
          <div className="relative flex-1 min-w-[200px]">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              placeholder="상품명 검색"
              className="input-base pl-9"
            />
          </div>

          {/* 상태 필터 */}
          <select
            value={status}
            onChange={(e) => { setStatus(e.target.value); setPage(1); }}
            className="input-base w-32"
          >
            <option value="">전체 상태</option>
            <option value="active">판매중</option>
            <option value="inactive">비활성</option>
          </select>

          {/* 차 종류 필터 */}
          <select
            value={teaType}
            onChange={(e) => { setTeaType(e.target.value); setPage(1); }}
            className="input-base w-36"
          >
            <option value="">전체 종류</option>
            {TEA_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>

          {/* 정렬 */}
          <select
            value={`${sort}-${order}`}
            onChange={(e) => {
              const [s, o] = e.target.value.split('-');
              setSort(s);
              setOrder(o as 'asc' | 'desc');
            }}
            className="input-base w-36"
          >
            <option value="createdAt-desc">최신 등록순</option>
            <option value="price-asc">가격 낮은순</option>
            <option value="price-desc">가격 높은순</option>
            <option value="totalSales-desc">판매 많은순</option>
            <option value="stock-asc">재고 적은순</option>
          </select>
        </div>
      </div>

      {/* 상품 테이블 */}
      <div className="card p-0 overflow-hidden">
        {/* 선택된 항목 일괄 액션 */}
        {selectedIds.length > 0 && (
          <div className="bg-tea-50 px-5 py-3 flex items-center gap-3 border-b border-tea-100">
            <span className="text-sm text-tea-700 font-medium">{selectedIds.length}개 선택됨</span>
            <button
              onClick={() => {
                if (confirm(`선택한 ${selectedIds.length}개 상품을 비활성화하시겠습니까?`)) {
                  selectedIds.forEach((id) => deleteMutation.mutate(id));
                  setSelectedIds([]);
                }
              }}
              className="text-sm text-red-600 hover:underline"
            >
              선택 비활성화
            </button>
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="px-4 py-3 text-left w-8">
                  <input
                    type="checkbox"
                    checked={selectedIds.length === products.length && products.length > 0}
                    onChange={toggleAll}
                    className="rounded border-gray-300 text-tea-600 focus:ring-tea-500"
                  />
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">상품</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase w-24">종류</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase w-32">가격</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase w-20">재고</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase w-24">판매수</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase w-20">상태</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase w-28">관리</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    {Array.from({ length: 8 }).map((_, j) => (
                      <td key={j} className="px-4 py-4">
                        <div className="h-4 bg-gray-100 rounded" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : products.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-16">
                    <Package size={40} className="mx-auto text-gray-200 mb-3" />
                    <p className="text-gray-400 text-sm">상품이 없습니다</p>
                    <Link href="/dashboard/products/new" className="btn-primary mt-4 inline-flex">
                      <Plus size={16} />첫 상품 등록하기
                    </Link>
                  </td>
                </tr>
              ) : (
                products.map((product) => (
                  <tr key={product.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(product.id)}
                        onChange={() => toggleSelect(product.id)}
                        className="rounded border-gray-300 text-tea-600 focus:ring-tea-500"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 bg-gray-100 rounded-lg overflow-hidden shrink-0">
                          {imgUrl(product.thumbnail) ? (
                            <img src={imgUrl(product.thumbnail)!} alt={product.name} className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full bg-gray-200" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <Link
                            href={`/dashboard/products/${product.id}`}
                            className="text-sm font-semibold text-gray-900 hover:text-tea-600 truncate block max-w-[200px]"
                          >
                            {product.name}
                          </Link>
                          {product.tags?.length > 0 && (
                            <div className="flex gap-1 mt-1 flex-wrap">
                              {product.tags.slice(0, 2).map((tag) => (
                                <span key={tag} className="text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">
                                  #{tag}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {product.teaType && (
                        <span className="text-xs bg-tea-50 text-tea-700 px-2 py-1 rounded-full">
                          {product.teaType}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {formatPrice(product.price, product.originalPrice, product.discountRate ?? undefined)}
                    </td>
                    <td className="px-4 py-3">
                      <span className={clsx(
                        'text-sm font-medium',
                        product.stock === 0 ? 'text-red-600' :
                        product.stock < 10 ? 'text-amber-600' : 'text-gray-700'
                      )}>
                        {product.stock === 0 ? '품절' : `${product.stock}${product.unit}`}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm font-medium text-gray-700">
                      {product.totalSales.toLocaleString()}건
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => toggleMutation.mutate(product.id)}
                        className={clsx(
                          'badge-status cursor-pointer transition-colors',
                          product.isActive
                            ? 'bg-green-100 text-green-700 hover:bg-green-200'
                            : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                        )}
                      >
                        {product.isActive ? '판매중' : '비활성'}
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <Link
                          href={`/dashboard/products/${product.id}/edit`}
                          className="p-1.5 text-gray-400 hover:text-tea-600 hover:bg-tea-50 rounded-lg transition-colors"
                          title="수정"
                        >
                          <Edit2 size={15} />
                        </Link>
                        <button
                          onClick={() => {
                            if (confirm('이 상품을 비활성화하시겠습니까?')) {
                              deleteMutation.mutate(product.id);
                            }
                          }}
                          className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="비활성화"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* 페이지네이션 */}
        {pagination && pagination.totalPages > 1 && (
          <div className="flex items-center justify-between px-5 py-4 border-t border-gray-100">
            <span className="text-sm text-gray-500">
              {(page - 1) * 15 + 1} - {Math.min(page * 15, pagination.total)} / {pagination.total}개
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="p-2 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <ChevronLeft size={16} />
              </button>
              {Array.from({ length: Math.min(5, pagination.totalPages) }, (_, i) => {
                const pageNum = Math.max(1, Math.min(page - 2 + i, pagination.totalPages - 4 + i));
                return (
                  <button
                    key={pageNum}
                    onClick={() => setPage(pageNum)}
                    className={clsx(
                      'w-8 h-8 rounded-lg text-sm font-medium transition-colors',
                      pageNum === page
                        ? 'bg-tea-600 text-white'
                        : 'border border-gray-200 text-gray-600 hover:bg-gray-50'
                    )}
                  >
                    {pageNum}
                  </button>
                );
              })}
              <button
                onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
                disabled={page === pagination.totalPages}
                className="p-2 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
