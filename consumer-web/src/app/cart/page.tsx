'use client';

import { useState, useRef, useEffect } from 'react';
import { useCartStore } from '@/store/cartStore';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Trash2, Minus, Plus, ShoppingCart } from 'lucide-react';
import NavBar from '@/components/NavBar';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? '';
const imgUrl = (p?: string | null) => p ? (p.startsWith('/') ? `${API_URL}${p}` : p) : null;

function QuantityInput({ value, stock, onChange }: { value: number; stock: number; onChange: (q: number) => void }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(value));
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setDraft(String(value)); }, [value]);
  useEffect(() => { if (editing) inputRef.current?.select(); }, [editing]);

  const commit = () => {
    setEditing(false);
    const n = parseInt(draft, 10);
    if (isNaN(n) || n <= 0) { setDraft(String(value)); return; }
    onChange(Math.min(n, stock));
  };

  return (
    <div className="flex items-center gap-1">
      <button onClick={() => onChange(value - 1)}
        className="w-7 h-7 rounded-lg border border-gray-200 flex items-center justify-center hover:bg-gray-50 active:bg-gray-100 transition-colors">
        <Minus size={13} />
      </button>
      {editing ? (
        <input ref={inputRef} type="number" min={1} max={stock} value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') { setDraft(String(value)); setEditing(false); } }}
          className="w-12 h-7 text-center text-sm font-medium border border-tea-400 rounded-lg outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" />
      ) : (
        <button onClick={() => setEditing(true)}
          className="w-10 h-7 text-center text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors border border-transparent hover:border-gray-200">
          {value}
        </button>
      )}
      <button onClick={() => onChange(value + 1)}
        disabled={value >= stock}
        className="w-7 h-7 rounded-lg border border-gray-200 flex items-center justify-center hover:bg-gray-50 active:bg-gray-100 transition-colors disabled:opacity-40">
        <Plus size={13} />
      </button>
    </div>
  );
}

export default function CartPage() {
  const { items, removeItem, updateQuantity, totalPrice } = useCartStore();
  const router = useRouter();

  if (items.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50">
        <NavBar title="장바구니" />
        <div className="flex flex-col items-center justify-center h-[60vh] gap-4">
          <ShoppingCart size={48} className="text-gray-300" />
          <p className="text-gray-500 font-medium">장바구니가 비었습니다</p>
          <button onClick={() => router.back()} className="text-sm text-tea-700 hover:underline">쇼핑 계속하기</button>
        </div>
      </div>
    );
  }

  const groupedByStore = items.reduce((acc, item) => {
    const key = item.storeSlug;
    if (!acc[key]) acc[key] = { storeName: item.storeName, items: [] };
    acc[key].items.push(item);
    return acc;
  }, {} as Record<string, { storeName: string; items: typeof items }>);

  const total = totalPrice();

  return (
    <div className="min-h-screen bg-gray-50 pb-36">
      <NavBar title="장바구니" />

      <div className="max-w-2xl mx-auto px-4 py-5 space-y-4">
        {Object.entries(groupedByStore).map(([storeSlug, group]) => (
          <div key={storeSlug} className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-50 flex items-center">
              <span className="text-sm font-semibold text-gray-700">{group.storeName}</span>
              <Link href={`/store/${storeSlug}`} className="text-xs text-tea-700 hover:underline ml-auto">스토어 보기</Link>
            </div>
            <div className="divide-y divide-gray-50">
              {group.items.map((item) => (
                <div key={item.productId} className="flex gap-3 p-4">
                  <div className="w-16 h-16 rounded-xl overflow-hidden bg-gray-100 shrink-0">
                    {item.thumbnail
                      ? <img src={imgUrl(item.thumbnail)!} alt={item.name} className="w-full h-full object-cover" />
                      : <div className="w-full h-full bg-gray-100" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <Link href={`/store/${item.storeSlug}/products/${item.productId}`} className="text-sm font-medium text-gray-900 line-clamp-1 hover:underline">
                      {item.name}
                    </Link>
                    <p className="text-sm font-bold text-gray-900 mt-1">{(item.price * item.quantity).toLocaleString()}원
                      {item.quantity > 1 && <span className="text-xs font-normal text-gray-400 ml-1">({item.price.toLocaleString()}원 x {item.quantity})</span>}
                    </p>
                    <div className="flex items-center gap-2 mt-2">
                      <QuantityInput value={item.quantity} stock={item.stock} onChange={(q) => updateQuantity(item.productId, q)} />
                      {item.stock <= 10 && <span className="text-xs text-amber-500">잔여 {item.stock}개</span>}
                    </div>
                  </div>
                  <button onClick={() => removeItem(item.productId)} className="p-1.5 text-gray-400 hover:text-red-500 self-start">
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        ))}

        <div className="bg-white rounded-2xl border border-gray-100 p-4 space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">상품 금액</span>
            <span className="font-medium">{total.toLocaleString()}원</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">배송비</span>
            <span className="font-medium text-tea-700">무료</span>
          </div>
          <div className="border-t border-gray-100 pt-2 flex justify-between">
            <span className="font-semibold text-gray-900">총 결제금액</span>
            <span className="text-lg font-bold text-gray-900">{total.toLocaleString()}원</span>
          </div>
        </div>
      </div>

      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 px-4 py-4 z-30">
        <div className="max-w-2xl mx-auto">
          <button onClick={() => router.push('/checkout')}
            className="w-full py-3.5 rounded-xl text-white font-semibold bg-tea-700 hover:bg-tea-800 transition-colors text-sm">
            {total.toLocaleString()}원 주문하기
          </button>
        </div>
      </div>
    </div>
  );
}