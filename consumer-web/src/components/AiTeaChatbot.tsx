'use client';

import { useState, useRef, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { publicApi } from '@/lib/api';
import Link from 'next/link';
import { X, Send, ShoppingBag } from 'lucide-react';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? '';
const imgUrl = (p?: string | null) => p ? (p.startsWith('/') ? `${API_URL}${p}` : p) : null;

interface Msg { role: 'ai' | 'user' | 'products'; text?: string; products?: any[] }

export default function AiTeaChatbot() {
  const pathname = usePathname();
  const isStorePage = pathname?.startsWith('/store/');
  if (isStorePage) return null;
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => { if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight; }, [msgs, loading]);

  const handleOpen = () => {
    setOpen(true);
    if (msgs.length === 0) {
      const hour = new Date().getHours();
      const greet = hour < 6 ? '이 늦은 시간에도 잠이 안 오시나요?' : hour < 12 ? '오늘 아침은 어떤 차로 시작해볼까요?' : hour < 18 ? '오후의 나른함, 차 한 잔으로 깨워볼까요?' : hour < 22 ? '하루 마무리, 오늘 당신을 위한 차 한 잔 어때요?' : '늦은 밤, 따뜻한 차 한 잔 하고 가세요.';
      setMsgs([{ role: 'ai', text: `${greet}\n\n오늘 기분이 어떠세요?` }]);
    }
  };

  const handleSend = async (text: string) => {
    if (!text.trim() || loading) return;
    const userMsg: Msg = { role: 'user', text: text.trim() };
    const newMsgs = [...msgs, userMsg];
    setMsgs(newMsgs);
    setInput('');
    setLoading(true);

    try {
      const history = newMsgs.filter(m => m.role === 'ai' || m.role === 'user').map(m => ({ role: m.role, text: m.text }));
      const res = await publicApi.aiTeaRecommend({ message: text.trim(), history });
      const data = res.data.data;

      setMsgs(prev => [
        ...prev,
        { role: 'ai', text: data.message },
        ...(data.recommendations?.length > 0 ? [{ role: 'products' as const, products: data.recommendations }] : []),
      ]);
    } catch {
      setMsgs(prev => [...prev, { role: 'ai', text: '앗, 잠깐 문제가 생겼어요. 다시 한번 이야기해주실래요?' }]);
    } finally {
      setLoading(false);
    }
  };

  const quickOptions = msgs.length <= 1
    ? ['좀 지쳤어요', '마음이 무거워요', '기분이 좋아요', '따뜻한 게 마시고 싶어요']
    : [];

  return (
    <>
      {!open && (
        <button onClick={handleOpen}
          className="fixed bottom-6 right-6 z-50 w-14 h-14 bg-gradient-to-br from-tea-600 to-tea-700 text-white rounded-full shadow-xl flex items-center justify-center transition-all hover:scale-110 hover:shadow-2xl">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
        </button>
      )}

      {open && (
        <div className="fixed bottom-6 right-6 z-50 w-[370px] max-w-[calc(100vw-2rem)] bg-cream-50 rounded-2xl shadow-2xl border border-tea-100 flex flex-col overflow-hidden" style={{ height: '540px' }}>
          <div className="bg-gradient-to-r from-tea-700 to-tea-600 text-white px-5 py-3.5 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center text-xs font-bold">Tea</div>
              <div>
                <p className="font-semibold text-sm">오늘의 마음 찻집</p>
                <p className="text-tea-200 text-[10px]">AI가 당신만을 위한 차를 찾아드려요</p>
              </div>
            </div>
            <button onClick={() => setOpen(false)} className="text-tea-200 hover:text-white transition-colors"><X size={18} /></button>
          </div>

          <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-2.5" style={{ scrollbarWidth: 'thin' }}>
            {msgs.map((msg, i) => (
              <div key={i}>
                {msg.role === 'user' && (
                  <div className="flex justify-end">
                    <div className="bg-tea-600 text-white rounded-2xl rounded-br-sm px-3.5 py-2 max-w-[78%] text-[13px] leading-relaxed">{msg.text}</div>
                  </div>
                )}
                {msg.role === 'ai' && (
                  <div className="flex justify-start gap-2">
                    <div className="w-6 h-6 bg-tea-100 rounded-full flex items-center justify-center shrink-0 mt-1 text-[9px] text-tea-700 font-bold">T</div>
                    <div className="bg-white rounded-2xl rounded-bl-sm px-3.5 py-2.5 max-w-[82%] text-[13px] text-gray-700 leading-relaxed whitespace-pre-line shadow-sm border border-gray-50">{msg.text}</div>
                  </div>
                )}
                {msg.role === 'products' && msg.products && (
                  <div className="space-y-2 pl-8 mt-1">
                    {msg.products.map((p: any, j: number) => (
                      <Link key={j} href={`/store/${p.store?.slug}/products/${p.id}`} onClick={() => setOpen(false)}
                        className="flex gap-2.5 bg-white border border-tea-100 rounded-xl p-2.5 hover:border-tea-300 transition-all shadow-sm">
                        <div className="w-12 h-12 rounded-lg overflow-hidden bg-gray-100 shrink-0">
                          {imgUrl(p.thumbnail) ? <img src={imgUrl(p.thumbnail)!} alt="" className="w-full h-full object-cover" /> :
                            <div className="w-full h-full flex items-center justify-center"><ShoppingBag size={14} className="text-gray-300" /></div>}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold text-gray-800 truncate">{p.name}</p>
                          <p className="text-[10px] text-gray-400">{p.store?.name} | {p.teaType}</p>
                          <p className="text-xs font-bold text-tea-700 mt-0.5">{p.price?.toLocaleString()}원</p>
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            ))}

            {quickOptions.length > 0 && !loading && (
              <div className="flex flex-wrap gap-1.5 pl-8 mt-1">
                {quickOptions.map((q) => (
                  <button key={q} onClick={() => handleSend(q)}
                    className="px-3 py-1.5 bg-white border border-tea-200 rounded-full text-xs text-tea-700 hover:bg-tea-50 hover:border-tea-400 transition-all shadow-sm">
                    {q}
                  </button>
                ))}
              </div>
            )}

            {loading && (
              <div className="flex justify-start gap-2">
                <div className="w-6 h-6 bg-tea-100 rounded-full flex items-center justify-center shrink-0 text-[9px] text-tea-700 font-bold">T</div>
                <div className="bg-white rounded-2xl px-4 py-3 shadow-sm border border-gray-50">
                  <span className="inline-flex gap-1">
                    <span className="w-1.5 h-1.5 bg-tea-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-1.5 h-1.5 bg-tea-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="w-1.5 h-1.5 bg-tea-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </span>
                </div>
              </div>
            )}
          </div>

          <div className="border-t border-tea-100 bg-white p-3 shrink-0">
            <div className="flex gap-2">
              <input value={input} onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.nativeEvent.isComposing && input.trim()) handleSend(input); }}
                placeholder="편하게 이야기해주세요..."
                disabled={loading}
                className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-[13px] focus:outline-none focus:ring-2 focus:ring-tea-400 focus:border-transparent bg-gray-50 disabled:opacity-50" />
              <button onClick={() => handleSend(input)} disabled={loading || !input.trim()}
                className="px-3 py-2 bg-tea-600 text-white rounded-xl hover:bg-tea-700 disabled:opacity-40 transition-colors">
                <Send size={15} />
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
