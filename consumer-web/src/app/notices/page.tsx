'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { publicApi } from '@/lib/api';
import NavBar from '@/components/NavBar';
import { Bell, ChevronDown, ChevronUp, Pin } from 'lucide-react';

export default function NoticesPage() {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const { data: notices, isLoading } = useQuery({
    queryKey: ['notices'], queryFn: () => publicApi.getNotices().then(r => r.data.data),
  });

  const items: any[] = notices || [];

  return (
    <div className="min-h-screen bg-gray-50 pb-16">
      <NavBar title="공지사항" back={true} />
      <div className="max-w-lg mx-auto px-4 py-6">
        {isLoading ? (
          <div className="text-center py-16 text-gray-400">로딩 중...</div>
        ) : items.length === 0 ? (
          <div className="text-center py-16">
            <Bell size={32} className="text-gray-200 mx-auto mb-2" />
            <p className="text-gray-400 text-sm">공지사항이 없습니다</p>
          </div>
        ) : (
          <div className="space-y-2">
            {items.map((n: any) => (
              <div key={n.id} className="bg-white rounded-xl border border-gray-100 overflow-hidden">
                <button onClick={() => setExpandedId(expandedId === n.id ? null : n.id)}
                  className="w-full flex items-center justify-between p-4 text-left hover:bg-gray-50 transition-colors">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    {n.isPinned && <Pin size={12} className="text-tea-600 shrink-0" />}
                    <span className="text-sm font-medium text-gray-800 truncate">{n.title}</span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 ml-2">
                    <span className="text-xs text-gray-400">{new Date(n.createdAt).toLocaleDateString('ko-KR')}</span>
                    {expandedId === n.id ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
                  </div>
                </button>
                {expandedId === n.id && (
                  <div className="px-4 pb-4 border-t border-gray-50">
                    <p className="text-sm text-gray-600 whitespace-pre-wrap pt-3">{n.content}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
