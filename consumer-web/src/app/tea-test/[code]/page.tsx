'use client';

import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { publicApi } from '@/lib/api';
import Link from 'next/link';
import NavBar from '@/components/NavBar';
import { ShoppingBag, ArrowLeft } from 'lucide-react';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? '';
const imgUrl = (p?: string | null) => p ? (p.startsWith('/') ? `${API_URL}${p}` : p) : null;

type Code = 'FLA'|'FRU'|'CIT'|'SWE'|'HON'|'CRE'|'VEG'|'MAR'|'MIN'|'ROA'|'MAL'|'WOO'|'EAR'|'SPI'|'SMO'|'COM';

const TYPE_INFO: Record<string, { name: string; desc: string; teas: string[] }> = {
  FLA: { name: '꽃향 예술가', desc: '섬세한 꽃향을 감별하는 예민한 취향', teas: ['동방미인','백호은침','자스민차','문산포종'] },
  FRU: { name: '과일향 탐험가', desc: '상쾌한 과일향을 사랑하는 활기찬 취향', teas: ['다즐링 1st Flush','실론','청향 우롱','히비스커스'] },
  CIT: { name: '시트러스 애호가', desc: '톡 쏘는 상큼함을 추구하는 취향', teas: ['얼그레이','레몬그라스','유자차','감귤녹차'] },
  SWE: { name: '달향 수집가', desc: '달콤한 향에 끌리는 포근한 취향', teas: ['바닐라 홍차','카라멜 홍차','루이보스','꿀차'] },
  HON: { name: '꿀향 애호가', desc: '자연스러운 꿀 같은 달콤함을 감별하는 취향', teas: ['백모단','대홍포','밀향단총','황산모봉'] },
  CRE: { name: '크림향 탐험가', desc: '부드럽고 크리미한 맛을 선호', teas: ['밀크우롱','금선차','라떼 블렌드','호지차라떼'] },
  VEG: { name: '풀향 애호가', desc: '신선한 풀과 채소의 향을 즐기는 취향', teas: ['용정차','센차','말차','안길백차'] },
  MAR: { name: '해풍 추구자', desc: '바다와 해초의 미네랄 향을 찾는 취향', teas: ['규스 옥로','제주 녹차','해풍 말차','오키나와 센차'] },
  MIN: { name: '광물향 탐색가', desc: '돌과 광물의 깊은 뉘앙스를 찾는 취향', teas: ['무이암차','대홍포','철관음','동정우롱'] },
  ROA: { name: '볶은향 장인', desc: '구수하게 볶은 따뜻한 향을 사랑', teas: ['호지차','현미차','대맥차','덖음차'] },
  MAL: { name: '맥아 수집가', desc: '몰트와 곡물의 깊은 향미를 즐기는 취향', teas: ['아쌈','기문','전홍','영덕 홍차'] },
  WOO: { name: '숲향 애호가', desc: '나무와 숲의 향기에 편안함을 느끼는 취향', teas: ['운남 생보이차','무이암차','백년송침','단총'] },
  EAR: { name: '대지 탐험가', desc: '흙과 대지의 깊은 향을 탐구하는 취향', teas: ['숙보이차','흑차','안화흑차','육안과편'] },
  SPI: { name: '향신료 여행가', desc: '스파이시한 향과 자극을 즐기는 취향', teas: ['차이','마살라차이','계피차','생강차'] },
  SMO: { name: '훈연향 조련사', desc: '스모키한 매력에 빠진 깊은 취향', teas: ['정산소종','랍상소우총','훈제 보이차','연훈차'] },
  COM: { name: '복합향 현자', desc: '여러 향이 겹치는 복합적 세계를 탐구', teas: ['대홍포','동방미인','다즐링 2nd','숙보이차'] },
};

export default function AromaProductsPage() {
  const params = useParams();
  const code = (params.code as string || '').toUpperCase();
  const info = TYPE_INFO[code];

  const { data: products, isLoading } = useQuery({
    queryKey: ['tea-rec', code],
    queryFn: () => publicApi.getTeaRecommendations(code).then((r) => r.data.data),
    enabled: !!code,
  });

  if (!info) {
    return (
      <div className="min-h-screen bg-gray-50">
        <NavBar title="향미 프로필" back={true} />
        <div className="flex flex-col items-center justify-center py-20 text-gray-400">존재하지 않는 유형입니다</div>
      </div>
    );
  }

  const items: any[] = products || [];

  return (
    <div className="min-h-screen bg-gray-50">
      <NavBar title={info.name} back={true} />

      {/* 유형 헤더 */}
      <div className="bg-white border-b border-gray-100">
        <div className="max-w-5xl mx-auto px-4 py-5">
          <div className="flex items-center gap-3 mb-2">
            <span className="text-xs font-bold bg-tea-100 text-tea-700 px-2.5 py-1 rounded-full">{code}</span>
            <h1 className="text-lg font-bold text-gray-900">{info.name}</h1>
          </div>
          <p className="text-sm text-gray-500">{info.desc}</p>
          <div className="flex flex-wrap gap-1.5 mt-3">
            {info.teas.map((t) => (
              <span key={t} className="text-xs bg-tea-50 text-tea-700 px-2.5 py-1 rounded-lg border border-tea-100">{t}</span>
            ))}
          </div>
        </div>
      </div>

      {/* 상품 목록 */}
      <div className="max-w-5xl mx-auto px-4 py-6">
        <p className="text-sm font-semibold text-gray-800 mb-4">
          {info.name} 취향에 맞는 상품 {!isLoading && <span className="text-gray-400 font-normal">({items.length}개)</span>}
        </p>

        {isLoading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="bg-white rounded-2xl border border-gray-100 overflow-hidden animate-pulse">
                <div className="aspect-square bg-gray-200" />
                <div className="p-3 space-y-2">
                  <div className="h-3 bg-gray-200 rounded w-2/3" />
                  <div className="h-4 bg-gray-200 rounded w-1/2" />
                </div>
              </div>
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 bg-white rounded-2xl border border-gray-100 gap-3">
            <ShoppingBag size={32} className="text-gray-200" />
            <p className="text-gray-400 text-sm">아직 등록된 상품이 없습니다</p>
            <p className="text-gray-300 text-xs">판매자가 향미 프로필을 설정하면 여기에 표시됩니다</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {items.map((p: any) => (
              <Link key={p.id} href={`/store/${p.store.slug}/products/${p.id}`}
                className="bg-white rounded-2xl border border-gray-100 overflow-hidden hover:shadow-md transition-shadow group">
                <div className="relative aspect-square overflow-hidden">
                  {imgUrl(p.thumbnail) ? (
                    <img src={imgUrl(p.thumbnail)!} alt={p.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                  ) : (
                    <div className="w-full h-full bg-tea-50 flex items-center justify-center">
                      <ShoppingBag size={24} className="text-tea-200" />
                    </div>
                  )}
                  {p.discountRate > 0 && (
                    <span className="absolute top-2 right-2 text-[10px] font-bold bg-red-500 text-white px-1.5 py-0.5 rounded-md">{p.discountRate}%</span>
                  )}
                </div>
                <div className="p-3">
                  <div className="flex items-center gap-1 mb-1">
                    {p.store.logoUrl ? (
                      <img src={imgUrl(p.store.logoUrl)!} alt="" className="w-4 h-4 rounded object-cover" />
                    ) : (
                      <div className="w-4 h-4 rounded bg-tea-600 flex items-center justify-center">
                        <span className="text-white text-[8px] font-bold">{p.store.name?.[0]}</span>
                      </div>
                    )}
                    <span className="text-[10px] text-gray-400 truncate">{p.store.name}</span>
                  </div>
                  <p className="text-xs font-semibold text-gray-800 truncate">{p.name}</p>
                  <div className="flex items-baseline gap-1 mt-1">
                    {p.discountRate > 0 && p.originalPrice && (
                      <span className="text-[10px] text-gray-300 line-through">{p.originalPrice.toLocaleString()}</span>
                    )}
                    <span className="text-sm font-bold text-gray-900">{p.price.toLocaleString()}원</span>
                  </div>
                  {p.aromaProfile && p.aromaProfile.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {p.aromaProfile.map((c: string) => (
                        <span key={c} className={`text-[9px] px-1.5 py-0.5 rounded ${c === code ? 'bg-tea-100 text-tea-700 font-bold' : 'bg-gray-100 text-gray-400'}`}>{c}</span>
                      ))}
                    </div>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}

        <div className="mt-6 text-center">
          <Link href="/tea-test" className="text-sm text-tea-600 hover:underline">차 취향 검사 다시하기</Link>
        </div>
      </div>
    </div>
  );
}
