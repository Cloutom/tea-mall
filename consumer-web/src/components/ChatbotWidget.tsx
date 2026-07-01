'use client';

import { useState, useRef, useEffect } from 'react';
import { publicApi, consumerAuthApi } from '@/lib/api';
import { Bot, X, Send, ChevronDown, MessageSquarePlus } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import toast from 'react-hot-toast';

interface Message {
  role: 'user' | 'bot';
  text: string;
  showInquiry?: boolean;
}

function renderMarkdown(text: string) {
  const lines = text.split('\n');
  return lines.map((line, i) => {
    const parts = line.split(/(\*\*.*?\*\*)/g);
    return (
      <span key={i}>
        {parts.map((part, j) =>
          part.startsWith('**') && part.endsWith('**')
            ? <strong key={j} className="font-bold">{part.slice(2, -2)}</strong>
            : <span key={j}>{part}</span>
        )}
        {i < lines.length - 1 && <br />}
      </span>
    );
  });
}

interface Props {
  slug: string;
  themeColor?: string;
  storeName?: string;
}

export default function ChatbotWidget({ slug, themeColor = '#2D6A4F', storeName }: Props) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [faqs, setFaqs] = useState<{ question: string; answer: string }[]>([]);
  const [defaultReply, setDefaultReply] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [storeId, setStoreId] = useState<string | null>(null);
  const [showInquiryForm, setShowInquiryForm] = useState(false);
  const [inquiryText, setInquiryText] = useState('');
  const [inquirySubmitting, setInquirySubmitting] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const { accessToken, consumer } = useAuthStore();

  useEffect(() => {
    publicApi.getStoreFaqs(slug)
      .then((r) => {
        setFaqs(r.data.data || []);
        setDefaultReply(r.data.defaultReply || null);
      })
      .catch(() => {});
    publicApi.getStore(slug)
      .then((r) => setStoreId(r.data.data?.id || null))
      .catch(() => {});
  }, [slug]);

  useEffect(() => {
    if (open && messages.length === 0) {
      setMessages([{ role: 'bot', text: `안녕하세요! ${storeName || '스토어'} 챗봇입니다. 무엇을 도와드릴까요?` }]);
    }
  }, [open]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, showInquiryForm]);

  const findAnswer = (q: string): string | null => {
    const lower = q.toLowerCase();
    const match = faqs.find((faq) =>
      faq.question.toLowerCase().split(/\s+/).some((word) => lower.includes(word))
    );
    return match ? match.answer : null;
  };

  const handleSend = () => {
    const text = input.trim();
    if (!text) return;
    setInput('');
    setShowInquiryForm(false);
    const userMsg: Message = { role: 'user', text };
    setMessages((prev) => [...prev, userMsg]);
    setLoading(true);
    setTimeout(() => {
      const answer = findAnswer(text);
      const botMsg: Message = {
        role: 'bot',
        text: answer || defaultReply || '죄송합니다, 해당 질문에 대한 답변을 찾지 못했습니다.',
        showInquiry: !answer,
      };
      setMessages((prev) => [...prev, botMsg]);
      setLoading(false);
    }, 600);
  };

  const handleFaqClick = (faq: { question: string; answer: string }) => {
    setShowInquiryForm(false);
    setMessages((prev) => [
      ...prev,
      { role: 'user', text: faq.question },
      { role: 'bot', text: faq.answer },
    ]);
  };

  const handleInquirySubmit = async () => {
    if (!accessToken || !consumer) {
      toast.error('로그인이 필요합니다.');
      return;
    }
    if (!inquiryText.trim()) {
      toast.error('문의 내용을 입력해주세요.');
      return;
    }
    if (!storeId) return;
    setInquirySubmitting(true);
    try {
      await consumerAuthApi.createStoreQnA({ storeId, question: inquiryText.trim() }, accessToken);
      setShowInquiryForm(false);
      setInquiryText('');
      setMessages((prev) => [
        ...prev,
        { role: 'bot', text: '문의가 접수되었습니다! 스토어에서 확인 후 답변드릴 예정입니다.' },
      ]);
    } catch {
      toast.error('문의 접수에 실패했습니다.');
    } finally {
      setInquirySubmitting(false);
    }
  };

  return (
    <>
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-20 right-4 w-12 h-12 rounded-full shadow-lg flex items-center justify-center z-40 transition-transform hover:scale-105"
          style={{ backgroundColor: themeColor }}
        >
          <Bot size={22} className="text-white" />
        </button>
      )}

      {open && (
        <div className="fixed bottom-4 right-4 w-80 max-h-[520px] flex flex-col bg-white rounded-2xl shadow-2xl z-40 overflow-hidden border border-gray-100">
          <div className="flex items-center gap-2 px-4 py-3 text-white" style={{ backgroundColor: themeColor }}>
            <Bot size={18} />
            <span className="text-sm font-semibold flex-1">{storeName || '스토어'} 챗봇</span>
            <button onClick={() => setOpen(false)} className="p-0.5 hover:opacity-80">
              <ChevronDown size={18} />
            </button>
            <button onClick={() => { setOpen(false); setMessages([]); setShowInquiryForm(false); }} className="p-0.5 hover:opacity-80">
              <X size={16} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2 min-h-0">
            {messages.map((msg, i) => (
              <div key={i}>
                <div className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[75%] rounded-2xl px-3 py-2 text-sm leading-relaxed ${
                    msg.role === 'user' ? 'text-white rounded-br-sm' : 'bg-gray-100 text-gray-800 rounded-bl-sm'
                  }`} style={msg.role === 'user' ? { backgroundColor: themeColor } : {}}>
                    {renderMarkdown(msg.text)}
                  </div>
                </div>
                {msg.role === 'bot' && msg.showInquiry && i === messages.length - 1 && (
                  <div className="mt-1.5 ml-0">
                    <button
                      onClick={() => setShowInquiryForm(true)}
                      className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border text-gray-600 hover:bg-gray-50 transition-colors"
                      style={{ borderColor: themeColor + '60', color: themeColor }}
                    >
                      <MessageSquarePlus size={12} /> 스토어에 직접 문의하기
                    </button>
                  </div>
                )}
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="bg-gray-100 rounded-2xl rounded-bl-sm px-3 py-2">
                  <div className="flex gap-1">
                    {[0, 1, 2].map((i) => <div key={i} className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />)}
                  </div>
                </div>
              </div>
            )}

            {showInquiryForm && (
              <div className="bg-gray-50 rounded-xl p-3 border border-gray-200 space-y-2">
                <p className="text-xs font-semibold text-gray-700">1:1 문의</p>
                {!accessToken ? (
                  <p className="text-xs text-amber-600">로그인 후 문의하실 수 있습니다.</p>
                ) : (
                  <>
                    <textarea
                      value={inquiryText}
                      onChange={(e) => setInquiryText(e.target.value)}
                      placeholder="문의 내용을 입력해주세요"
                      className="w-full text-xs border border-gray-200 rounded-lg px-2.5 py-2 resize-none h-20 focus:outline-none focus:ring-1"
                      style={{ '--tw-ring-color': themeColor } as any}
                    />
                    <div className="flex gap-2">
                      <button onClick={() => setShowInquiryForm(false)}
                        className="flex-1 py-1.5 text-xs border border-gray-200 rounded-lg text-gray-500 hover:bg-gray-100">취소</button>
                      <button onClick={handleInquirySubmit} disabled={inquirySubmitting || !inquiryText.trim()}
                        className="flex-1 py-1.5 text-xs rounded-lg text-white font-medium disabled:opacity-50"
                        style={{ backgroundColor: themeColor }}>
                        {inquirySubmitting ? '접수 중...' : '문의 접수'}
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {faqs.length > 0 && messages.length <= 1 && (
            <div className="px-3 pb-2">
              <p className="text-xs text-gray-400 mb-1.5">자주 묻는 질문</p>
              <div className="flex flex-wrap gap-1.5">
                {faqs.slice(0, 4).map((faq, i) => (
                  <button key={i} onClick={() => handleFaqClick(faq)}
                    className="text-xs px-2.5 py-1 rounded-full border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors text-left line-clamp-1 max-w-[140px]">
                    {faq.question}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="border-t border-gray-100 px-3 py-2 flex items-center gap-2">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
              placeholder="메시지 입력..."
              className="flex-1 text-sm bg-gray-50 rounded-full px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-tea-400"
            />
            <button onClick={handleSend} disabled={!input.trim()}
              className="w-8 h-8 rounded-full flex items-center justify-center disabled:opacity-40 transition-colors"
              style={{ backgroundColor: themeColor }}>
              <Send size={14} className="text-white" />
            </button>
          </div>
        </div>
      )}
    </>
  );
}
