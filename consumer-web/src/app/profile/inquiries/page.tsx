'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { consumerAuthApi } from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import NavBar from '@/components/NavBar';
import { HelpCircle, Send, ChevronDown, ChevronUp, Clock, CheckCircle } from 'lucide-react';
import toast from 'react-hot-toast';

const CATEGORIES = ['일반', '주문/결제', '배송', '환불/교환', '계정', '기타'];

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return '방금';
  if (m < 60) return `${m}분 전`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}시간 전`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}일 전`;
  return new Date(dateStr).toLocaleDateString('ko-KR');
}

export default function InquiriesPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { consumer, accessToken } = useAuthStore();
  const [showForm, setShowForm] = useState(false);
  const [category, setCategory] = useState('일반');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);

  useEffect(() => {
    if (!consumer) router.replace('/auth/login?redirect=%2Fprofile%2Finquiries');
  }, [consumer, router]);

  if (!consumer) return null;

  const { data: inquiries, isLoading } = useQuery({
    queryKey: ['my-inquiries'],
    queryFn: () => consumerAuthApi.getInquiries(accessToken!).then(r => r.data.data),
    enabled: !!accessToken,
  });

  const createMutation = useMutation({
    mutationFn: () => consumerAuthApi.createInquiry({ category, title: title.trim(), content: content.trim() }, accessToken!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-inquiries'] });
      toast.success('문의가 등록되었습니다.');
      setShowForm(false);
      setTitle('');
      setContent('');
      setCategory('일반');
    },
    onError: (err: any) => toast.error(err?.response?.data?.error || '문의 등록에 실패했습니다.'),
  });

  const handleSubmit = () => {
    if (!title.trim()) { toast.error('제목을 입력해주세요.'); return; }
    if (content.trim().length < 5) { toast.error('내용을 5자 이상 입력해주세요.'); return; }
    createMutation.mutate();
  };

  const items: any[] = inquiries || [];

  return (
    <div className="min-h-screen bg-tea-50 pb-16">
      <NavBar title="1:1 문의" back={true} />

      <div className="max-w-lg mx-auto px-4 py-4 space-y-4">
        {/* 문의 작성 버튼 / 폼 */}
        {!showForm ? (
          <button onClick={() => setShowForm(true)}
            className="w-full py-3.5 bg-tea-600 text-white rounded-2xl font-semibold text-sm hover:bg-tea-700 transition-colors flex items-center justify-center gap-2">
            <Send size={16} /> 새 문의 작성
          </button>
        ) : (
          <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-gray-900 text-sm">문의 작성</h2>
              <button onClick={() => setShowForm(false)} className="text-xs text-gray-400 hover:text-gray-600">취소</button>
            </div>

            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">카테고리</label>
              <div className="flex flex-wrap gap-1.5">
                {CATEGORIES.map(c => (
                  <button key={c} onClick={() => setCategory(c)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                      category === c ? 'bg-tea-600 text-white border-tea-600' : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300'
                    }`}>
                    {c}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">제목</label>
              <input value={title} onChange={e => setTitle(e.target.value)} placeholder="문의 제목을 입력해주세요"
                className="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-tea-500/30 focus:border-tea-500" />
            </div>

            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">내용</label>
              <textarea value={content} onChange={e => setContent(e.target.value)} rows={5}
                placeholder="문의 내용을 상세히 적어주세요"
                className="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-tea-500/30 focus:border-tea-500" />
            </div>

            <button onClick={handleSubmit} disabled={createMutation.isPending}
              className="w-full py-3 bg-tea-600 text-white rounded-xl font-semibold text-sm hover:bg-tea-700 disabled:opacity-50 flex items-center justify-center gap-2">
              {createMutation.isPending ? '등록 중...' : '문의 등록'}
            </button>
          </div>
        )}

        {/* 문의 목록 */}
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="bg-white rounded-2xl p-4 animate-pulse">
                <div className="h-4 bg-gray-200 rounded w-3/4 mb-2" />
                <div className="h-3 bg-gray-200 rounded w-1/2" />
              </div>
            ))}
          </div>
        ) : items.length === 0 && !showForm ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center">
              <HelpCircle size={28} className="text-gray-300" />
            </div>
            <p className="text-gray-500 font-medium">문의 내역이 없습니다</p>
            <p className="text-gray-400 text-sm">궁금한 점이 있으면 문의해주세요</p>
          </div>
        ) : (
          <div className="space-y-2">
            {items.map((inq: any) => {
              const isOpen = openId === inq.id;
              const answered = inq.status === 'ANSWERED';
              return (
                <div key={inq.id} className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
                  <button onClick={() => setOpenId(isOpen ? null : inq.id)}
                    className="w-full text-left p-4 flex items-start gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${answered ? 'bg-green-50' : 'bg-amber-50'}`}>
                      {answered ? <CheckCircle size={16} className="text-green-500" /> : <Clock size={16} className="text-amber-500" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 font-medium">{inq.category}</span>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${answered ? 'bg-green-100 text-green-600' : 'bg-amber-100 text-amber-600'}`}>
                          {answered ? '답변완료' : '대기중'}
                        </span>
                      </div>
                      <p className="text-sm font-medium text-gray-900 mt-1 truncate">{inq.title}</p>
                      <p className="text-xs text-gray-400 mt-0.5">{timeAgo(inq.createdAt)}</p>
                    </div>
                    <div className="shrink-0 mt-2 text-gray-400">
                      {isOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </div>
                  </button>

                  {isOpen && (
                    <div className="border-t border-gray-50 px-4 pb-4 space-y-3">
                      <div className="pt-3">
                        <p className="text-xs font-medium text-gray-500 mb-1">문의 내용</p>
                        <p className="text-sm text-gray-700 whitespace-pre-line bg-gray-50 rounded-xl p-3">{inq.content}</p>
                      </div>
                      {answered && inq.answer && (
                        <div>
                          <p className="text-xs font-medium text-tea-600 mb-1">관리자 답변</p>
                          <p className="text-sm text-gray-700 whitespace-pre-line bg-tea-50 border border-tea-100 rounded-xl p-3">{inq.answer}</p>
                          {inq.answeredAt && (
                            <p className="text-xs text-gray-400 mt-1">{new Date(inq.answeredAt).toLocaleDateString('ko-KR')} 답변</p>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
