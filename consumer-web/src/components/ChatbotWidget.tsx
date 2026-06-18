'use client';

import { useState, useRef, useEffect } from 'react';
import { publicApi } from '@/lib/api';
import { Bot, X, Send, ChevronDown } from 'lucide-react';

interface Message {
  role: 'user' | 'bot';
  text: string;
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
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    publicApi.getStoreFaqs(slug)
      .then((r) => setFaqs(r.data.data || []))
      .catch(() => {});
  }, [slug]);

  useEffect(() => {
    if (open && messages.length === 0) {
      setMessages([{ role: 'bot', text: `안녕하세요! ${storeName || '스토어'} 챗봇입니다. 무엇을 도와드릴까요?` }]);
    }
  }, [open]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

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
    const userMsg: Message = { role: 'user', text };
    setMessages((prev) => [...prev, userMsg]);
    setLoading(true);
    setTimeout(() => {
      const answer = findAnswer(text);
      const botMsg: Message = {
        role: 'bot',
        text: answer || '죄송합니다, 해당 질문에 대한 답변을 찾지 못했습니다. 스토어로 직접 문의해주세요.',
      };
      setMessages((prev) => [...prev, botMsg]);
      setLoading(false);
    }, 600);
  };

  const handleFaqClick = (faq: { question: string; answer: string }) => {
    setMessages((prev) => [
      ...prev,
      { role: 'user', text: faq.question },
      { role: 'bot', text: faq.answer },
    ]);
  };

  return (
    <>
      {/* 플로팅 버튼 */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-20 right-4 w-12 h-12 rounded-full shadow-lg flex items-center justify-center z-40 transition-transform hover:scale-105"
          style={{ backgroundColor: themeColor }}
        >
          <Bot size={22} className="text-white" />
        </button>
      )}

      {/* 챗봇 패널 */}
      {open && (
        <div className="fixed bottom-4 right-4 w-80 max-h-[480px] flex flex-col bg-white rounded-2xl shadow-2xl z-40 overflow-hidden border border-gray-100">
          {/* 헤더 */}
          <div className="flex items-center gap-2 px-4 py-3 text-white" style={{ backgroundColor: themeColor }}>
            <Bot size={18} />
            <span className="text-sm font-semibold flex-1">{storeName || '스토어'} 챗봇</span>
            <button onClick={() => setOpen(false)} className="p-0.5 hover:opacity-80">
              <ChevronDown size={18} />
            </button>
            <button onClick={() => { setOpen(false); setMessages([]); }} className="p-0.5 hover:opacity-80">
              <X size={16} />
            </button>
          </div>

          {/* 메시지 영역 */}
          <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2 min-h-0">
            {messages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[75%] rounded-2xl px-3 py-2 text-sm leading-relaxed ${
                  msg.role === 'user' ? 'text-white rounded-br-sm' : 'bg-gray-100 text-gray-800 rounded-bl-sm'
                }`} style={msg.role === 'user' ? { backgroundColor: themeColor } : {}}>
                  {msg.text}
                </div>
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
            <div ref={bottomRef} />
          </div>

          {/* FAQ 빠른 답변 */}
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

          {/* 입력 영역 */}
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
