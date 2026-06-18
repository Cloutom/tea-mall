'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { sellerReviewApi } from '@/lib/api';
import { Star, MessageSquare, ChevronLeft, ChevronRight, Filter } from 'lucide-react';
import toast from 'react-hot-toast';
import { clsx } from 'clsx';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? '';
const imgUrl = (p?: string | null) => p ? (p.startsWith('/') ? `${API_URL}${p}` : p) : null;

function Stars({ rating }: { rating: number }) {
  return (
    <div className="flex gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <Star key={i} size={13} className={i < rating ? 'fill-amber-400 text-amber-400' : 'text-gray-200'} />
      ))}
    </div>
  );
}

export default function ReviewsPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [unansweredOnly, setUnansweredOnly] = useState(false);
  const [replyingId, setReplyingId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['seller-reviews', { page, unansweredOnly }],
    queryFn: () => sellerReviewApi.getReviews({ page, limit: 10, unanswered: unansweredOnly ? 'true' : undefined }).then((r) => r.data),
  });

  const replyMutation = useMutation({
    mutationFn: ({ id, reply }: { id: string; reply: string }) => sellerReviewApi.replyToReview(id, reply),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['seller-reviews'] });
      setReplyingId(null);
      setReplyText('');
      toast.success('답변이 등록되었습니다.');
    },
    onError: () => toast.error('답변 등록에 실패했습니다.'),
  });

  const reviews: any[] = data?.data || [];
  const pagination = data?.pagination;
  const stats = data?.stats;

  const startReply = (review: any) => {
    setReplyingId(review.id);
    setReplyText(review.sellerReply || '');
  };

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">리뷰 관리</h1>
          <p className="text-gray-500 text-sm mt-0.5">고객 리뷰를 확인하고 답변하세요</p>
        </div>
      </div>

      {/* 통계 */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: '전체 리뷰', value: stats.total },
            { label: '평균 별점', value: stats.avgRating?.toFixed(1) || '-' },
            { label: '미답변', value: stats.unanswered, highlight: stats.unanswered > 0 },
            { label: '이번 달', value: stats.thisMonth },
          ].map((s) => (
            <div key={s.label} className="card py-4">
              <p className="text-xs text-gray-400 mb-1">{s.label}</p>
              <p className={clsx('text-2xl font-bold', s.highlight ? 'text-red-600' : 'text-gray-900')}>{s.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* 필터 */}
      <div className="card py-3 flex items-center gap-3">
        <Filter size={15} className="text-gray-400" />
        <label className="flex items-center gap-2 cursor-pointer select-none">
          <input type="checkbox" checked={unansweredOnly} onChange={(e) => { setUnansweredOnly(e.target.checked); setPage(1); }}
            className="w-4 h-4 accent-tea-600 rounded" />
          <span className="text-sm text-gray-700">미답변만 보기</span>
        </label>
        <span className="ml-auto text-sm text-gray-400">총 {pagination?.total || 0}개</span>
      </div>

      {/* 리뷰 목록 */}
      <div className="space-y-3">
        {isLoading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="card animate-pulse">
              <div className="h-4 bg-gray-100 rounded w-1/3 mb-3" />
              <div className="h-3 bg-gray-100 rounded w-2/3" />
            </div>
          ))
        ) : reviews.length === 0 ? (
          <div className="card text-center py-16">
            <MessageSquare size={40} className="mx-auto text-gray-200 mb-3" />
            <p className="text-gray-400 text-sm">리뷰가 없습니다</p>
          </div>
        ) : (
          reviews.map((review) => (
            <div key={review.id} className="card space-y-3">
              {/* 리뷰 헤더 */}
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center shrink-0 text-sm font-bold text-gray-500">
                  {review.consumer?.name?.[0] || '?'}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold text-gray-800">{review.consumer?.name || '탈퇴한 회원'}</span>
                    <Stars rating={review.rating} />
                    <span className="text-xs text-gray-400">{new Date(review.createdAt).toLocaleDateString('ko-KR')}</span>
                    {!review.sellerReply && (
                      <span className="text-xs bg-red-50 text-red-600 px-2 py-0.5 rounded-full font-medium">미답변</span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">{review.product?.name}</p>
                </div>
              </div>

              {/* 리뷰 내용 */}
              <p className="text-sm text-gray-700 leading-relaxed">{review.content}</p>

              {/* 리뷰 이미지 */}
              {review.images?.length > 0 && (
                <div className="flex gap-2">
                  {review.images.map((img: string, i: number) => (
                    <img key={i} src={imgUrl(img)!} alt="" className="w-16 h-16 rounded-lg object-cover" />
                  ))}
                </div>
              )}

              {/* 기존 답변 표시 */}
              {review.sellerReply && replyingId !== review.id && (
                <div className="bg-tea-50 rounded-xl p-3 border-l-4 border-tea-400">
                  <p className="text-xs font-semibold text-tea-700 mb-1">판매자 답변</p>
                  <p className="text-sm text-gray-700">{review.sellerReply}</p>
                  <button onClick={() => startReply(review)} className="text-xs text-tea-600 hover:underline mt-1">수정</button>
                </div>
              )}

              {/* 답변 폼 */}
              {replyingId === review.id ? (
                <div className="space-y-2">
                  <textarea
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    placeholder="고객 리뷰에 답변을 작성하세요..."
                    className="input-base h-24 resize-none"
                    autoFocus
                  />
                  <div className="flex gap-2">
                    <button onClick={() => { setReplyingId(null); setReplyText(''); }}
                      className="btn-secondary flex-1 py-2 text-sm">취소</button>
                    <button
                      onClick={() => { if (!replyText.trim()) { toast.error('답변 내용을 입력하세요.'); return; } replyMutation.mutate({ id: review.id, reply: replyText.trim() }); }}
                      disabled={replyMutation.isPending}
                      className="btn-primary flex-1 py-2 text-sm">
                      {replyMutation.isPending ? '저장 중...' : '답변 저장'}
                    </button>
                  </div>
                </div>
              ) : (
                !review.sellerReply && (
                  <button onClick={() => startReply(review)}
                    className="flex items-center gap-1.5 text-sm text-tea-600 hover:underline">
                    <MessageSquare size={14} /> 답변 작성
                  </button>
                )
              )}
            </div>
          ))
        )}
      </div>

      {/* 페이지네이션 */}
      {pagination && pagination.totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}
            className="p-2 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-40">
            <ChevronLeft size={16} />
          </button>
          <span className="text-sm text-gray-600">{page} / {pagination.totalPages}</span>
          <button onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))} disabled={page === pagination.totalPages}
            className="p-2 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-40">
            <ChevronRight size={16} />
          </button>
        </div>
      )}
    </div>
  );
}
