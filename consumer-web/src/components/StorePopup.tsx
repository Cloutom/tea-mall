'use client';

import { useState, useEffect, useCallback } from 'react';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? '';
const imgUrl = (p?: string | null) => p ? (p.startsWith('/') ? `${API_URL}${p}` : p) : null;

interface Popup {
  id: string;
  imageUrl?: string | null;
  linkUrl?: string | null;
  hasLink: boolean;
  width: number;
  height: number;
  closeType: string;
}

interface Props {
  popups: Popup[];
}

export default function StorePopup({ popups }: Props) {
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [loaded, setLoaded] = useState(false);
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    const hiddenUntil: Record<string, number> = JSON.parse(localStorage.getItem('popup-hidden') || '{}');
    const now = Date.now();
    const stillHidden = new Set(
      Object.entries(hiddenUntil)
        .filter(([, until]) => until > now)
        .map(([id]) => id)
    );
    setDismissed(stillHidden);
    setLoaded(true);
  }, []);

  const visiblePopups = popups.filter((p) => !dismissed.has(p.id));

  const handleClose = useCallback(() => {
    if (visiblePopups.length === 0) return;
    const popup = visiblePopups[current];
    if (!popup) return;
    if (popup.closeType === 'hide_week') {
      const hiddenUntil: Record<string, number> = JSON.parse(localStorage.getItem('popup-hidden') || '{}');
      hiddenUntil[popup.id] = Date.now() + 7 * 24 * 60 * 60 * 1000;
      localStorage.setItem('popup-hidden', JSON.stringify(hiddenUntil));
    }
    // 모든 popup 닫기 (X 버튼 = 전체 닫기)
    const allIds = new Set(visiblePopups.map((p) => p.id));
    setDismissed((prev) => new Set([...Array.from(prev), ...Array.from(allIds)]));
  }, [visiblePopups, current]);

  const handleHideWeek = useCallback(() => {
    const hiddenUntil: Record<string, number> = JSON.parse(localStorage.getItem('popup-hidden') || '{}');
    visiblePopups.forEach((p) => {
      hiddenUntil[p.id] = Date.now() + 7 * 24 * 60 * 60 * 1000;
    });
    localStorage.setItem('popup-hidden', JSON.stringify(hiddenUntil));
    setDismissed(new Set(visiblePopups.map((p) => p.id)));
  }, [visiblePopups]);

  if (!loaded || visiblePopups.length === 0) return null;

  const popup = visiblePopups[current] || visiblePopups[0];
  const isMulti = visiblePopups.length > 1;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={handleClose}>
      <div className="absolute inset-0 bg-black/60 animate-fadeIn" />
      <div
        className="relative bg-white rounded-2xl overflow-hidden shadow-2xl animate-scaleIn"
        style={{ maxWidth: `${popup.width}px`, width: '100%' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* 팝업 이미지 */}
        {popup.imageUrl ? (
          popup.hasLink && popup.linkUrl ? (
            <a href={popup.linkUrl} target="_blank" rel="noopener noreferrer">
              <img src={imgUrl(popup.imageUrl)!} alt="팝업"
                className="w-full object-cover cursor-pointer"
                style={{ maxHeight: `${popup.height}px` }} />
            </a>
          ) : (
            <img src={imgUrl(popup.imageUrl)!} alt="팝업"
              className="w-full object-cover"
              style={{ maxHeight: `${popup.height}px` }} />
          )
        ) : (
          <div className="h-40 bg-gray-100 flex items-center justify-center text-gray-400 text-sm">
            이미지 없음
          </div>
        )}

        {/* 슬라이드 컨트롤 (복수 팝업일 때) */}
        {isMulti && (
          <>
            <button
              onClick={() => setCurrent((c) => (c - 1 + visiblePopups.length) % visiblePopups.length)}
              className="absolute left-2 top-1/2 -translate-y-1/2 w-7 h-7 bg-black/40 hover:bg-black/60 rounded-full flex items-center justify-center text-white transition-colors"
            >
              <ChevronLeft size={14} />
            </button>
            <button
              onClick={() => setCurrent((c) => (c + 1) % visiblePopups.length)}
              className="absolute right-2 top-1/2 -translate-y-1/2 w-7 h-7 bg-black/40 hover:bg-black/60 rounded-full flex items-center justify-center text-white transition-colors"
            >
              <ChevronRight size={14} />
            </button>
            {/* 페이지 도트 */}
            <div className="absolute bottom-14 left-0 right-0 flex justify-center gap-1.5">
              {visiblePopups.map((_, i) => (
                <button key={i} onClick={() => setCurrent(i)}
                  className={`w-1.5 h-1.5 rounded-full transition-all ${i === current ? 'bg-white w-4' : 'bg-white/50'}`}
                />
              ))}
            </div>
          </>
        )}

        {/* 하단 버튼 영역 */}
        <div className="flex items-center justify-between px-4 py-2.5 bg-gray-50 border-t border-gray-100">
          {popup.closeType === 'hide_week' ? (
            <button onClick={handleHideWeek}
              className="text-xs text-gray-400 hover:text-gray-600 transition-colors">
              7일간 보지 않기
            </button>
          ) : (
            <div />
          )}
          <button onClick={handleClose}
            className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-800 transition-colors ml-auto">
            <X size={13} /> 닫기
          </button>
        </div>
      </div>
    </div>
  );
}
