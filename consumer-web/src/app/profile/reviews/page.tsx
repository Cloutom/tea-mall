'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { consumerAuthApi } from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import NavBar from '@/components/NavBar';
import Link from 'next/link';
import { Star, Package, Edit2, Trash2, X, Check } from 'lucide-react';
import toast from 'react-hot-toast';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? '';
const imgUrl = (p?: string | null) => p ? (p.startsWith('/') ? `${API_URL}${p}` : p) : null;

export default function MyReviewsPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { consumer, accessToken } = useAuthStore();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editRating, setEditRating] = useState(5);
  const [editContent, setEditContent] = useState('');

  useEffect(() => { if (!consumer) router.replace('/auth/login'); }, [consumer, router]);
  if (!consumer) return null;

  const { data: reviews, isLoading } = useQuery({
    queryKey: ['my-reviews'],
    queryFn: () => consumerAuthApi.getMyReviews(accessToken!).then(r => r.data.data),
    enabled: !!accessToken,
  });

  const startEdit = (r: any) => {
    setEditingId(r.id);
    setEditRating(r.rating);
    setEditContent(r.content || '');
  };

  const handleUpdate = async (id: string) => {
    if (editContent.trim().length < 10) { toast.error('10자 이상 작성해주세요'); return; }
    try {
      await consumerAuthApi.updateReview(id, { rating: editRating, content: editContent.trim() }, accessToken!);
      toast.success('리뷰가 수정되었습니다');
      setEditingId(null);
      queryClient.invalidateQueries({ queryKey: ['my-reviews'] });
    } catch (err: any) { toast.error(err?.response?.data?.error || '수정 실패'); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('리뷰를 삭제하시겠습니까? 삭제 후 복구할 수 없습니다.')) return;
    try {
      await consumerAuthApi.deleteReview(id, accessToken!);
      toast.success('리뷰가 삭제되었습니다');
      queryClient.invalidateQueries({ queryKey: ['my-reviews'] });
    } catch (err: any) { toast.error(err?.response?.data?.error || '삭제 실패'); }
  };

  const items: any[] = reviews || [];

  return (
    <div className="min-h-screen bg-gray-50 pb-16">
      <NavBar title="내가 쓴 리뷰" back={true} />

      <div className="max-w-lg mx-auto px-4 py-5">
        {isLoading ? (
          <div className="space-y-3">{[1, 2, 3].map(i => <div key={i} className="h-28 bg-white rounded-xl animate-pulse" />)}</div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <Star size={32} className="text-gray-200" />
            <p className="text-gray-400 text-sm">작성한 리뷰가 없습니다</p>
            <Link href="/orders" className="text-sm text-tea-600 hover:underline">주문 내역에서 리뷰 작성하기</Link>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-gray-500 mb-1">총 {items.length}개의 리뷰</p>
            {items.map((r: any) => (
              <div key={r.id} className="bg-white rounded-xl border border-gray-100 overflow-hidden">
                {/* 상품 정보 */}
                <div className="flex gap-3 p-4 pb-2">
                  <div className="w-14 h-14 rounded-lg overflow-hidden bg-gray-100 shrink-0">
                    {imgUrl(r.product?.thumbnail) ? <img src={imgUrl(r.product.thumbnail)!} alt="" className="w-full h-full object-cover" /> :
                      <div className="w-full h-full flex items-center justify-center"><Package size={16} className="text-gray-300" /></div>}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-gray-400">{r.product?.store?.name}</p>
                    <Link href={`/store/${r.product?.store?.slug}/products/${r.product?.id}`}
                      className="text-sm font-medium text-gray-900 truncate block hover:text-tea-700">{r.product?.name}</Link>
                    <span className="text-xs text-gray-400">{new Date(r.createdAt).toLocaleDateString('ko-KR')}</span>
                  </div>
                  {/* 수정/삭제 버튼 */}
                  {editingId !== r.id && (
                    <div className="flex gap-1 shrink-0">
                      <button onClick={() => startEdit(r)} className="p-1.5 text-gray-400 hover:text-tea-600 rounded-lg hover:bg-gray-50">
                        <Edit2 size={14} />
                      </button>
                      <button onClick={() => handleDelete(r.id)} className="p-1.5 text-gray-400 hover:text-red-500 rounded-lg hover:bg-gray-50">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  )}
                </div>

                {editingId === r.id ? (
                  /* 수정 모드 */
                  <div className="px-4 pb-4 space-y-2">
                    <div className="flex items-center gap-1">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <button key={i} onClick={() => setEditRating(i + 1)}>
                          <Star size={20} className={i < editRating ? 'fill-amber-400 text-amber-400' : 'text-gray-200'} />
                        </button>
                      ))}
                    </div>
                    <textarea value={editContent} onChange={e => setEditContent(e.target.value)}
                      rows={3} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-tea-500 resize-none" />
                    <div className="flex gap-2">
                      <button onClick={() => setEditingId(null)}
                        className="flex-1 py-2 rounded-lg border border-gray-200 text-gray-500 text-xs font-medium flex items-center justify-center gap-1">
                        <X size={12} /> 취소
                      </button>
                      <button onClick={() => handleUpdate(r.id)}
                        className="flex-1 py-2 rounded-lg bg-tea-600 text-white text-xs font-medium flex items-center justify-center gap-1">
                        <Check size={12} /> 수정 완료
                      </button>
                    </div>
                  </div>
                ) : (
                  /* 보기 모드 */
                  <>
                    <div className="flex items-center gap-1 px-4 pb-1">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Star key={i} size={12} className={i < r.rating ? 'fill-amber-400 text-amber-400' : 'text-gray-200'} />
                      ))}
                    </div>
                    {r.content && <p className="text-sm text-gray-600 px-4 pb-2">{r.content}</p>}
                    {r.images && r.images.length > 0 && (
                      <div className="flex gap-1 px-4 pb-3 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
                        {r.images.map((img: string, i: number) => (
                          <div key={i} className="w-16 h-16 rounded-lg overflow-hidden bg-gray-100 shrink-0">
                            <img src={imgUrl(img)!} alt="" className="w-full h-full object-cover" />
                          </div>
                        ))}
                      </div>
                    )}
                    {r.sellerReply && (
                      <div className="mx-4 mb-3 bg-gray-50 rounded-lg p-2.5">
                        <p className="text-xs text-gray-400 mb-0.5">판매자 답변</p>
                        <p className="text-xs text-gray-600">{r.sellerReply}</p>
                      </div>
                    )}
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
