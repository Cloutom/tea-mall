'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { sellerChatbotApi } from '@/lib/api';
import { Bot, Plus, Edit2, Trash2, Save, X, ChevronDown, ChevronUp } from 'lucide-react';
import toast from 'react-hot-toast';
import { clsx } from 'clsx';

export default function ChatbotPage() {
  const queryClient = useQueryClient();
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newQuestion, setNewQuestion] = useState('');
  const [newAnswer, setNewAnswer] = useState('');
  const [editQuestion, setEditQuestion] = useState('');
  const [editAnswer, setEditAnswer] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [defaultReply, setDefaultReply] = useState('');
  const [defaultReplyLoaded, setDefaultReplyLoaded] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['seller-chatbot'],
    queryFn: () => sellerChatbotApi.getFaqs().then((r) => {
      if (!defaultReplyLoaded) {
        setDefaultReply(r.data.defaultReply || '');
        setDefaultReplyLoaded(true);
      }
      return r.data.data;
    }),
  });

  const defaultReplyMutation = useMutation({
    mutationFn: (reply: string) => sellerChatbotApi.updateDefaultReply(reply),
    onSuccess: () => toast.success('기본 답변이 저장되었습니다.'),
    onError: () => toast.error('기본 답변 저장에 실패했습니다.'),
  });

  const createMutation = useMutation({
    mutationFn: (d: { question: string; answer: string }) => sellerChatbotApi.createFaq(d),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['seller-chatbot'] });
      setShowAddForm(false);
      setNewQuestion('');
      setNewAnswer('');
      toast.success('FAQ가 추가되었습니다.');
    },
    onError: () => toast.error('FAQ 추가에 실패했습니다.'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: object }) => sellerChatbotApi.updateFaq(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['seller-chatbot'] });
      setEditingId(null);
      toast.success('FAQ가 수정되었습니다.');
    },
    onError: () => toast.error('FAQ 수정에 실패했습니다.'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => sellerChatbotApi.deleteFaq(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['seller-chatbot'] });
      toast.success('FAQ가 삭제되었습니다.');
    },
    onError: () => toast.error('FAQ 삭제에 실패했습니다.'),
  });

  const faqs: any[] = data || [];

  const startEdit = (faq: any) => {
    setEditingId(faq.id);
    setEditQuestion(faq.question);
    setEditAnswer(faq.answer);
    setExpandedId(faq.id);
  };

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">챗봇 설정</h1>
          <p className="text-gray-500 text-sm mt-0.5">자주 묻는 질문을 등록하면 챗봇이 자동으로 답변합니다</p>
        </div>
        {!showAddForm && (
          <button onClick={() => { setShowAddForm(true); setEditingId(null); }} className="btn-primary">
            <Plus size={16} /> FAQ 추가
          </button>
        )}
      </div>

      {/* 안내 */}
      <div className="card bg-tea-50 border border-tea-100">
        <div className="flex items-start gap-3">
          <Bot size={20} className="text-tea-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-tea-800">챗봇 FAQ 안내</p>
            <p className="text-xs text-tea-600 mt-1">
              고객이 챗봇에 질문했을 때 등록된 FAQ와 유사한 질문을 매칭하여 자동으로 답변합니다.
              자주 묻는 배송, 교환·반품, 상품 관련 질문을 미리 등록해두세요.
            </p>
          </div>
        </div>
      </div>

      {/* 기본 답변 설정 */}
      <div className="card space-y-3">
        <div className="flex items-center gap-2">
          <Bot size={16} className="text-gray-500" />
          <p className="text-sm font-semibold text-gray-800">기본 답변 설정</p>
        </div>
        <p className="text-xs text-gray-500">등록된 FAQ에 매칭되지 않는 질문을 받았을 때 자동으로 표시되는 답변입니다.</p>
        <textarea
          value={defaultReply}
          onChange={(e) => setDefaultReply(e.target.value)}
          placeholder="예: 해당 질문에 대한 답변을 준비하지 못했습니다. 카카오톡 채널 @스토어명 으로 문의해주시면 빠르게 답변 드리겠습니다."
          className="input-base h-20 resize-none"
        />
        <div className="flex justify-end">
          <button
            onClick={() => defaultReplyMutation.mutate(defaultReply)}
            disabled={defaultReplyMutation.isPending}
            className="btn-primary py-1.5 text-sm"
          >
            <Save size={14} /> {defaultReplyMutation.isPending ? '저장 중...' : '기본 답변 저장'}
          </button>
        </div>
      </div>

      {/* 추가 폼 */}
      {showAddForm && (
        <div className="card space-y-4 border-2 border-tea-200 bg-tea-50/30">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-tea-800">새 FAQ 추가</p>
            <button onClick={() => { setShowAddForm(false); setNewQuestion(''); setNewAnswer(''); }}
              className="p-1 text-gray-400 hover:text-gray-600"><X size={16} /></button>
          </div>
          <div>
            <label className="label-base">질문</label>
            <input value={newQuestion} onChange={(e) => setNewQuestion(e.target.value)}
              placeholder="예: 배송은 얼마나 걸리나요?" className="input-base" />
          </div>
          <div>
            <label className="label-base">답변</label>
            <textarea value={newAnswer} onChange={(e) => setNewAnswer(e.target.value)}
              placeholder="예: 평균 2~3 영업일 이내에 배송됩니다. 제주·도서산간 지역은 추가 1~2일이 소요될 수 있습니다."
              className="input-base h-24 resize-none" />
          </div>
          <div className="flex gap-2">
            <button onClick={() => { setShowAddForm(false); setNewQuestion(''); setNewAnswer(''); }}
              className="btn-secondary flex-1 py-2">취소</button>
            <button
              onClick={() => {
                if (!newQuestion.trim()) { toast.error('질문을 입력하세요.'); return; }
                if (!newAnswer.trim()) { toast.error('답변을 입력하세요.'); return; }
                createMutation.mutate({ question: newQuestion.trim(), answer: newAnswer.trim() });
              }}
              disabled={createMutation.isPending}
              className="btn-primary flex-1 py-2">
              {createMutation.isPending ? '저장 중...' : <><Save size={15} /> 저장</>}
            </button>
          </div>
        </div>
      )}

      {/* FAQ 목록 */}
      <div className="space-y-2">
        {isLoading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="card animate-pulse">
              <div className="h-4 bg-gray-100 rounded w-2/3 mb-2" />
              <div className="h-3 bg-gray-100 rounded w-1/2" />
            </div>
          ))
        ) : faqs.length === 0 ? (
          <div className="card text-center py-16">
            <Bot size={40} className="mx-auto text-gray-200 mb-3" />
            <p className="text-gray-400 text-sm mb-4">등록된 FAQ가 없습니다</p>
            <button onClick={() => setShowAddForm(true)} className="btn-primary text-sm">
              <Plus size={15} /> 첫 FAQ 추가하기
            </button>
          </div>
        ) : (
          faqs.map((faq, idx) => (
            <div key={faq.id} className="card">
              {editingId === faq.id ? (
                <div className="space-y-3">
                  <div>
                    <label className="label-base">질문</label>
                    <input value={editQuestion} onChange={(e) => setEditQuestion(e.target.value)} className="input-base" />
                  </div>
                  <div>
                    <label className="label-base">답변</label>
                    <textarea value={editAnswer} onChange={(e) => setEditAnswer(e.target.value)}
                      className="input-base h-24 resize-none" />
                  </div>
                  <div className="flex items-center gap-3">
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <input type="checkbox" defaultChecked={faq.isActive}
                        onChange={(e) => updateMutation.mutate({ id: faq.id, data: { isActive: e.target.checked } })}
                        className="w-4 h-4 accent-tea-600" />
                      <span className="text-sm text-gray-700">활성화</span>
                    </label>
                    <div className="flex gap-2 ml-auto">
                      <button onClick={() => setEditingId(null)} className="btn-secondary py-1.5 text-sm">취소</button>
                      <button
                        onClick={() => {
                          if (!editQuestion.trim() || !editAnswer.trim()) { toast.error('질문과 답변을 모두 입력하세요.'); return; }
                          updateMutation.mutate({ id: faq.id, data: { question: editQuestion.trim(), answer: editAnswer.trim() } });
                        }}
                        disabled={updateMutation.isPending}
                        className="btn-primary py-1.5 text-sm">
                        <Save size={14} /> {updateMutation.isPending ? '저장 중...' : '저장'}
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div>
                  <button onClick={() => setExpandedId(expandedId === faq.id ? null : faq.id)}
                    className="w-full flex items-center gap-3 text-left">
                    <span className="w-6 h-6 rounded-full bg-tea-100 text-tea-700 flex items-center justify-center text-xs font-bold shrink-0">
                      {idx + 1}
                    </span>
                    <p className={clsx('flex-1 text-sm font-medium', faq.isActive ? 'text-gray-800' : 'text-gray-400')}>
                      {faq.question}
                    </p>
                    {!faq.isActive && <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">비활성</span>}
                    <div className="flex items-center gap-1 shrink-0">
                      <button onClick={(e) => { e.stopPropagation(); startEdit(faq); }}
                        className="p-1.5 text-gray-400 hover:text-tea-600 hover:bg-tea-50 rounded-lg transition-colors">
                        <Edit2 size={13} />
                      </button>
                      <button onClick={(e) => { e.stopPropagation(); if (confirm('FAQ를 삭제하시겠습니까?')) deleteMutation.mutate(faq.id); }}
                        className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                        <Trash2 size={13} />
                      </button>
                      {expandedId === faq.id ? <ChevronUp size={14} className="text-gray-400" /> : <ChevronDown size={14} className="text-gray-400" />}
                    </div>
                  </button>
                  {expandedId === faq.id && (
                    <div className="mt-3 pl-9">
                      <div className="bg-gray-50 rounded-xl p-3">
                        <p className="text-xs font-semibold text-gray-500 mb-1">답변</p>
                        <p className="text-sm text-gray-700 leading-relaxed">{faq.answer}</p>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
