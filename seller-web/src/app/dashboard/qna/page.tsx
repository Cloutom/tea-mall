'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { sellerQnaApi } from '@/lib/api';
import { HelpCircle, ChevronLeft, ChevronRight, Filter, MessageSquare } from 'lucide-react';
import toast from 'react-hot-toast';
import { clsx } from 'clsx';

export default function QnAPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [unansweredOnly, setUnansweredOnly] = useState(false);
  const [answeringId, setAnsweringId] = useState<string | null>(null);
  const [answerText, setAnswerText] = useState('');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const { data, isLoading } = useQuery({
    queryKey: ['seller-qna', { page, unansweredOnly }],
    queryFn: () => sellerQnaApi.getQnAs({ page, limit: 15, unanswered: unansweredOnly ? 'true' : undefined }).then((r) => r.data),
  });

  const answerMutation = useMutation({
    mutationFn: ({ id, answer }: { id: string; answer: string }) => sellerQnaApi.answerQnA(id, answer),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['seller-qna'] });
      setAnsweringId(null);
      setAnswerText('');
      toast.success('답변이 등록되었습니다.');
    },
    onError: () => toast.error('답변 등록에 실패했습니다.'),
  });

  const qnas: any[] = data?.data || [];
  const pagination = data?.pagination;

  const toggleExpand = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const startAnswer = (qna: any) => {
    setAnsweringId(qna.id);
    setAnswerText(qna.answer || '');
    setExpanded((prev) => new Set([...Array.from(prev), qna.id]));
  };

  return (
    <div className="space-y-5 animate-fade-in">
      <div>
        <h1 className="text-xl font-bold text-gray-900">QnA 관리</h1>
        <p className="text-gray-500 text-sm mt-0.5">고객 문의를 확인하고 답변하세요</p>
      </div>

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

      {/* QnA 목록 */}
      <div className="space-y-3">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="card animate-pulse">
              <div className="h-4 bg-gray-100 rounded w-2/3 mb-2" />
              <div className="h-3 bg-gray-100 rounded w-1/3" />
            </div>
          ))
        ) : qnas.length === 0 ? (
          <div className="card text-center py-16">
            <HelpCircle size={40} className="mx-auto text-gray-200 mb-3" />
            <p className="text-gray-400 text-sm">문의가 없습니다</p>
          </div>
        ) : (
          qnas.map((qna) => (
            <div key={qna.id} className="card space-y-2">
              {/* 질문 헤더 */}
              <button onClick={() => toggleExpand(qna.id)} className="w-full flex items-start gap-3 text-left">
                <div className={clsx('w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-0.5 text-xs font-bold',
                  qna.isAnswered ? 'bg-tea-100 text-tea-700' : 'bg-red-100 text-red-600')}>
                  Q
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={clsx('text-xs px-2 py-0.5 rounded-full font-medium',
                      qna.isAnswered ? 'bg-green-100 text-green-700' : 'bg-red-50 text-red-600')}>
                      {qna.isAnswered ? '답변 완료' : '미답변'}
                    </span>
                    <span className="text-xs text-gray-400">{qna.buyerName || '익명'}</span>
                    <span className="text-xs text-gray-300">{new Date(qna.createdAt).toLocaleDateString('ko-KR')}</span>
                  </div>
                  <p className="text-sm text-gray-800 mt-1 font-medium leading-relaxed line-clamp-2">{qna.question}</p>
                </div>
              </button>

              {/* 내용 펼침 */}
              {expanded.has(qna.id) && (
                <div className="pl-9 space-y-3">
                  {/* 기존 답변 */}
                  {qna.answer && answeringId !== qna.id && (
                    <div className="bg-tea-50 rounded-xl p-3 border-l-4 border-tea-400">
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-xs font-semibold text-tea-700">판매자 답변</p>
                        <button onClick={() => startAnswer(qna)} className="text-xs text-tea-600 hover:underline">수정</button>
                      </div>
                      <p className="text-sm text-gray-700">{qna.answer}</p>
                    </div>
                  )}

                  {/* 답변 폼 */}
                  {answeringId === qna.id ? (
                    <div className="space-y-2">
                      <textarea
                        value={answerText}
                        onChange={(e) => setAnswerText(e.target.value)}
                        placeholder="고객 문의에 답변을 작성하세요..."
                        className="input-base h-24 resize-none"
                        autoFocus
                      />
                      <div className="flex gap-2">
                        <button onClick={() => { setAnsweringId(null); setAnswerText(''); }}
                          className="btn-secondary flex-1 py-2 text-sm">취소</button>
                        <button
                          onClick={() => { if (!answerText.trim()) { toast.error('답변을 입력하세요.'); return; } answerMutation.mutate({ id: qna.id, answer: answerText.trim() }); }}
                          disabled={answerMutation.isPending}
                          className="btn-primary flex-1 py-2 text-sm">
                          {answerMutation.isPending ? '저장 중...' : '답변 등록'}
                        </button>
                      </div>
                    </div>
                  ) : (
                    !qna.isAnswered && (
                      <button onClick={() => startAnswer(qna)}
                        className="flex items-center gap-1.5 text-sm text-tea-600 hover:underline">
                        <MessageSquare size={14} /> 답변 작성
                      </button>
                    )
                  )}
                </div>
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
