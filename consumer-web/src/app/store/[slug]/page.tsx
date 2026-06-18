'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { publicApi } from '@/lib/api';
import Link from 'next/link';
import { Search, Star, ChevronDown, HelpCircle, ChevronUp, MessageSquare } from 'lucide-react';
import { clsx } from 'clsx';
import StorePopup from '@/components/StorePopup';
import NavBar from '@/components/NavBar';
import ChatbotWidget from '@/components/ChatbotWidget';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? '';
const imgUrl = (p?: string | null) => p ? (p.startsWith('/') ? `${API_URL}${p}` : p) : null;

const SORT_OPTIONS = [
  { value: 'newest', label: '최신순' },
  { value: 'sales', label: '판매량순' },
  { value: 'price_asc', label: '가격 낮은순' },
  { value: 'price_desc', label: '가격 높은순' },
];

export default function StoreHomePage() {
  const params = useParams();
  const slug = params.slug as string;

  const queryClient = useQueryClient();
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [sort, setSort] = useState('newest');
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  // QnA 상태
  const [qnaPage, setQnaPage] = useState(1);
  const [expandedQnaId, setExpandedQnaId] = useState<string | null>(null);
  const [showQnaForm, setShowQnaForm] = useState(false);
  const [qnaName, setQnaName] = useState('');
  const [qnaQuestion, setQnaQuestion] = useState('');
  const [qnaSubmitting, setQnaSubmitting] = useState(false);

  const { data: store, isLoading: storeLoading, isError: storeError } = useQuery({
    queryKey: ['store', slug],
    queryFn: () => publicApi.getStore(slug).then((r) => r.data.data),
    enabled: !!slug,
  });

  const { data: productsData, isLoading: productsLoading } = useQuery({
    queryKey: ['products', slug, selectedCategory, sort, search],
    queryFn: () => publicApi.getProducts(slug, { category: selectedCategory || undefined, sort, search: search || undefined, limit: 40 }).then((r) => r.data),
    enabled: !!slug,
  });

  const { data: popupsData } = useQuery({
    queryKey: ['popups', slug],
    queryFn: () => publicApi.getStorePopups(slug).then((r) => r.data.data),
    enabled: !!slug,
  });

  const { data: qnaData, refetch: refetchQnAs } = useQuery({
    queryKey: ['store-qna', slug, qnaPage],
    queryFn: () => publicApi.getStoreQnAs(slug, { page: qnaPage, limit: 5 }).then((r) => r.data),
    enabled: !!slug,
  });

  const handleQnaSubmit = async () => {
    if (!qnaQuestion.trim() || qnaQuestion.length < 5) { return; }
    setQnaSubmitting(true);
    try {
      await publicApi.createQnA(slug, { question: qnaQuestion.trim(), buyerName: qnaName.trim() || '익명' });
      setQnaQuestion('');
      setQnaName('');
      setShowQnaForm(false);
      refetchQnAs();
    } catch (err: any) {
      console.error(err);
    } finally {
      setQnaSubmitting(false);
    }
  };

  const products = productsData?.data || [];
  const themeColor = store?.themeColor || '#2D6A4F';
  const categories = store?.storeCategories || [];

  if (storeLoading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <NavBar />
        <div className="h-40 bg-gray-200 animate-pulse" />
        <div className="max-w-5xl mx-auto px-4 py-8 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="bg-white rounded-2xl overflow-hidden border border-gray-100">
              <div className="aspect-square bg-gray-200 animate-pulse" />
              <div className="p-3 space-y-2">
                <div className="h-4 bg-gray-200 rounded animate-pulse" />
                <div className="h-4 bg-gray-200 rounded w-2/3 animate-pulse" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (storeError || !store) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4">
        <p className="text-gray-500 font-medium">스토어를 찾을 수 없습니다</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {popupsData && popupsData.length > 0 && <StorePopup popups={popupsData} />}

      {/* 통합 상단바 */}
      <NavBar title={store.name} themeColor={themeColor} />

      {/* 배너 */}
      <div className="relative">
        {store.bannerUrl ? (
          <div className="w-full h-40 sm:h-56 overflow-hidden">
            <img src={imgUrl(store.bannerUrl)!} alt="배너" className="w-full h-full object-cover" />
          </div>
        ) : (
          <div className="w-full h-28 sm:h-36"
            style={{ background: `linear-gradient(135deg, ${themeColor}33, ${themeColor}11)` }} />
        )}
        {/* 스토어 정보 오버레이 */}
        <div className="max-w-5xl mx-auto px-4">
          <div className="flex items-end gap-3 -mt-6 relative z-10">
            {store.logoUrl ? (
              <img src={imgUrl(store.logoUrl)!} alt={store.name}
                className="w-14 h-14 rounded-xl object-cover border-2 border-white shadow-md bg-white shrink-0" />
            ) : (
              <div className="w-14 h-14 rounded-xl border-2 border-white shadow-md flex items-center justify-center shrink-0"
                style={{ backgroundColor: themeColor }}>
                <span className="text-white text-xl font-bold">{store.name?.[0]}</span>
              </div>
            )}
            <div className="pb-1 min-w-0">
              <h2 className="text-lg font-bold text-gray-900 truncate">{store.name}</h2>
              {store.description && <p className="text-xs text-gray-500 truncate">{store.description}</p>}
            </div>
          </div>
        </div>
      </div>

      {/* 배송비 안내 바 */}
      {(store.shippingFee > 0 || store.freeShippingThreshold) && (
        <div className="bg-tea-50 border-b border-tea-100 px-4 py-2">
          <div className="max-w-5xl mx-auto flex items-center gap-3 text-xs text-tea-700 flex-wrap">
            <span className="font-medium">배송비</span>
            {store.shippingFee === 0
              ? <span>무료배송</span>
              : <span>{store.shippingFee.toLocaleString()}원</span>}
            {store.freeShippingThreshold && (
              <span className="text-tea-600">·&nbsp;{store.freeShippingThreshold.toLocaleString()}원 이상 <span className="font-semibold">무료배송</span></span>
            )}
            {store.shippingPolicies && (store.shippingPolicies as any[]).length > 0 && (
              <span className="text-gray-400">
                {(store.shippingPolicies as any[]).map((p: any) => `${p.region} +${Number(p.fee).toLocaleString()}원`).join(' · ')}
              </span>
            )}
          </div>
        </div>
      )}

      {/* 검색 + 카테고리 탭 */}
      <div className="bg-white border-b border-gray-100 sticky top-14 z-20">
        <div className="max-w-5xl mx-auto px-4 py-2 flex flex-col gap-2">
          {/* 검색 */}
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') setSearch(searchInput); }}
              placeholder="이 스토어 상품 검색..."
              className="w-full pl-9 pr-4 py-1.5 text-sm bg-gray-50 border border-gray-200 rounded-full focus:outline-none focus:ring-2 focus:ring-tea-500"
            />
          </div>
          {/* 카테고리 */}
          {categories.length > 0 && (
            <div className="flex gap-1 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
              <button
                onClick={() => setSelectedCategory('')}
                className={clsx('shrink-0 px-3 py-1 rounded-full text-xs font-medium transition-colors',
                  !selectedCategory ? 'text-white' : 'text-gray-500 bg-gray-100 hover:bg-gray-200')}
                style={!selectedCategory ? { backgroundColor: themeColor } : {}}
              >전체</button>
              {categories.map((cat: any) => (
                <button key={cat.id}
                  onClick={() => setSelectedCategory(cat.name)}
                  className={clsx('shrink-0 px-3 py-1 rounded-full text-xs font-medium transition-colors',
                    selectedCategory === cat.name ? 'text-white' : 'text-gray-500 bg-gray-100 hover:bg-gray-200')}
                  style={selectedCategory === cat.name ? { backgroundColor: themeColor } : {}}
                >{cat.icon} {cat.name}</button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 상품 목록 */}
      <div className="max-w-5xl mx-auto px-4 py-5">
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm text-gray-500">상품 <span className="font-semibold text-gray-900">{productsData?.pagination?.total || products.length}개</span></p>
          <div className="relative">
            <select value={sort} onChange={(e) => setSort(e.target.value)}
              className="appearance-none pl-3 pr-8 py-1.5 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-tea-500">
              {SORT_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            <ChevronDown size={13} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          </div>
        </div>

        {productsLoading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 sm:gap-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="bg-white rounded-2xl overflow-hidden border border-gray-100">
                <div className="aspect-square bg-gray-200 animate-pulse" />
                <div className="p-3 space-y-2">
                  <div className="h-4 bg-gray-200 rounded animate-pulse" />
                  <div className="h-4 bg-gray-200 rounded w-2/3 animate-pulse" />
                </div>
              </div>
            ))}
          </div>
        ) : products.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-56 gap-3 bg-white rounded-2xl border border-gray-100">
            <p className="text-gray-500 font-medium">상품이 없습니다</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 sm:gap-4">
            {products.map((product: any) => (
              <Link key={product.id} href={`/store/${slug}/products/${product.id}`}
                className="bg-white rounded-2xl overflow-hidden border border-gray-100 hover:shadow-md transition-shadow group block">
                <div className="aspect-square overflow-hidden bg-gray-50 relative">
                  {product.thumbnail
                    ? <img src={imgUrl(product.thumbnail)!} alt={product.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                    : <div className="w-full h-full bg-gray-100" />}
                  {product.isNew && (
                    <div className="absolute top-2 left-2 bg-tea-600 text-white text-xs font-bold px-1.5 py-0.5 rounded-md">
                      신상품
                    </div>
                  )}
                  {product.discountRate && !product.isNew && (
                    <div className="absolute top-2 left-2 bg-red-500 text-white text-xs font-bold px-1.5 py-0.5 rounded-md">
                      -{product.discountRate}%
                    </div>
                  )}
                  {product.isSignature && (
                    <div className="absolute top-2 right-2">
                      <Star size={14} className="fill-amber-400 text-amber-400" />
                    </div>
                  )}
                  {product.stock === 0 && (
                    <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                      <span className="text-white text-sm font-bold">품절</span>
                    </div>
                  )}
                </div>
                <div className="p-3">
                  {product.teaType && <p className="text-xs text-gray-400 mb-0.5">{product.teaType}</p>}
                  <h3 className="text-sm font-semibold text-gray-900 line-clamp-2 leading-snug mb-1.5">{product.name}</h3>
                  <div className="flex items-baseline gap-1.5 flex-wrap">
                    <span className="text-base font-bold text-gray-900">{product.price.toLocaleString()}원</span>
                    {product.originalPrice && product.originalPrice !== product.price && (
                      <span className="text-xs text-gray-400 line-through">{product.originalPrice.toLocaleString()}원</span>
                    )}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {(store.shippingPolicy || store.returnPolicy) && (
        <div className="max-w-5xl mx-auto px-4 pb-4">
          <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-4">
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

      {/* QnA 섹션 */}
      <div className="max-w-5xl mx-auto px-4 pb-10">
        <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-gray-800 flex items-center gap-2">
              <HelpCircle size={16} className="text-tea-600" /> 스토어 문의
              {qnaData?.pagination?.total > 0 && (
                <span className="text-sm font-normal text-gray-400">({qnaData.pagination.total})</span>
              )}
            </h3>
            {!showQnaForm && (
              <button onClick={() => setShowQnaForm(true)}
                className="text-sm font-medium text-tea-700 hover:underline flex items-center gap-1">
                <MessageSquare size={14} /> 문의하기
              </button>
            )}
          </div>

          {/* 문의 작성 폼 */}
          {showQnaForm && (
            <div className="border border-gray-200 rounded-xl p-4 space-y-3 bg-gray-50">
              <input value={qnaName} onChange={(e) => setQnaName(e.target.value)}
                placeholder="이름 (선택, 미입력 시 익명)" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-tea-400 bg-white" />
              <textarea value={qnaQuestion} onChange={(e) => setQnaQuestion(e.target.value)}
                placeholder="문의 내용을 5자 이상 입력해주세요"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-tea-400 h-24 resize-none bg-white" />
              <div className="flex gap-2">
                <button onClick={() => { setShowQnaForm(false); setQnaQuestion(''); setQnaName(''); }}
                  className="flex-1 py-2 rounded-lg text-sm font-medium border border-gray-200 text-gray-600 hover:bg-gray-100">취소</button>
                <button
                  onClick={handleQnaSubmit}
                  disabled={qnaSubmitting || qnaQuestion.length < 5}
                  className="flex-1 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-50 transition-colors"
                  style={{ backgroundColor: themeColor }}>
                  {qnaSubmitting ? '제출 중...' : '문의 제출'}
                </button>
              </div>
            </div>
          )}

          {/* QnA 목록 */}
          {(qnaData?.data || []).length === 0 ? (
            <div className="text-center py-6">
              <HelpCircle size={32} className="mx-auto text-gray-200 mb-2" />
              <p className="text-sm text-gray-400">아직 문의가 없습니다</p>
            </div>
          ) : (
            <div className="space-y-2">
              {(qnaData?.data || []).map((qna: any) => (
                <div key={qna.id} className="border border-gray-100 rounded-xl overflow-hidden">
                  <button onClick={() => setExpandedQnaId(expandedQnaId === qna.id ? null : qna.id)}
                    className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-50 transition-colors">
                    <div className={clsx('w-5 h-5 rounded-full text-xs font-bold flex items-center justify-center shrink-0',
                      qna.isAnswered ? 'bg-tea-100 text-tea-700' : 'bg-amber-100 text-amber-700')}>Q</div>
                    <p className="flex-1 text-sm text-gray-800 line-clamp-1">{qna.question}</p>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className={clsx('text-xs px-2 py-0.5 rounded-full', qna.isAnswered ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500')}>
                        {qna.isAnswered ? '답변 완료' : '답변 대기'}
                      </span>
                      {expandedQnaId === qna.id ? <ChevronUp size={14} className="text-gray-400" /> : <ChevronDown size={14} className="text-gray-400" />}
                    </div>
                  </button>
                  {expandedQnaId === qna.id && (
                    <div className="px-4 pb-4 space-y-2">
                      <div className="text-sm text-gray-700 leading-relaxed">{qna.question}</div>
                      {qna.answer && (
                        <div className="bg-tea-50 rounded-xl p-3 border-l-4 border-tea-400">
                          <p className="text-xs font-semibold text-tea-700 mb-1">판매자 답변</p>
                          <p className="text-sm text-gray-700">{qna.answer}</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
              {qnaData?.pagination && qnaData.pagination.totalPages > 1 && (
                <div className="flex justify-center gap-2 mt-2">
                  <button onClick={() => setQnaPage((p) => Math.max(1, p - 1))} disabled={qnaPage === 1}
                    className="px-3 py-1.5 text-xs border border-gray-200 rounded-lg disabled:opacity-40">이전</button>
                  <span className="px-3 py-1.5 text-xs text-gray-500">{qnaPage}/{qnaData.pagination.totalPages}</span>
                  <button onClick={() => setQnaPage((p) => Math.min(qnaData.pagination.totalPages, p + 1))} disabled={qnaPage === qnaData.pagination.totalPages}
                    className="px-3 py-1.5 text-xs border border-gray-200 rounded-lg disabled:opacity-40">다음</button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* 챗봇 위젯 */}
      <ChatbotWidget slug={slug} themeColor={themeColor} storeName={store.name} />
    </div>
  );
}