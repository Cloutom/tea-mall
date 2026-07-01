'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { publicApi, consumerAuthApi } from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import Link from 'next/link';
import NavBar from '@/components/NavBar';
import { ShoppingBag } from 'lucide-react';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? '';
const imgUrl = (p?: string | null) => p ? (p.startsWith('/') ? `${API_URL}${p}` : p) : null;

type Code = 'FLA'|'FRU'|'CIT'|'SWE'|'HON'|'CRE'|'VEG'|'MAR'|'MIN'|'ROA'|'MAL'|'WOO'|'EAR'|'SPI'|'SMO'|'COM';

const TYPE_INFO: Record<Code, { name: string; code: string; desc: string; teas: string[] }> = {
  FLA: { name: '꽃향 예술가', code: 'FLA', desc: '섬세한 꽃향을 감별하는 예민한 취향', teas: ['동방미인','백호은침','자스민차','문산포종'] },
  FRU: { name: '과일향 탐험가', code: 'FRU', desc: '상쾌한 과일향을 사랑하는 활기찬 취향', teas: ['다즐링 1st Flush','실론','청향 우롱','히비스커스'] },
  CIT: { name: '시트러스 애호가', code: 'CIT', desc: '톡 쏘는 상큼함을 추구하는 취향', teas: ['얼그레이','레몬그라스','유자차','감귤녹차'] },
  SWE: { name: '달향 수집가', code: 'SWE', desc: '달콤한 향에 끌리는 포근한 취향', teas: ['바닐라 홍차','카라멜 홍차','루이보스','꿀차'] },
  HON: { name: '꿀향 애호가', code: 'HON', desc: '자연스러운 꿀 같은 달콤함을 감별하는 취향', teas: ['백모단','대홍포','밀향단총','황산모봉'] },
  CRE: { name: '크림향 탐험가', code: 'CRE', desc: '부드럽고 크리미한 맛을 선호', teas: ['밀크우롱','금선차','라떼 블렌드','호지차라떼'] },
  VEG: { name: '풀향 애호가', code: 'VEG', desc: '신선한 풀과 채소의 향을 즐기는 취향', teas: ['용정차','센차','말차','안길백차'] },
  MAR: { name: '해풍 추구자', code: 'MAR', desc: '바다와 해초의 미네랄 향을 찾는 취향', teas: ['규스 옥로','제주 녹차','해풍 말차','오키나와 센차'] },
  MIN: { name: '광물향 탐색가', code: 'MIN', desc: '돌과 광물의 깊은 뉘앙스를 찾는 취향', teas: ['무이암차','대홍포','철관음','동정우롱'] },
  ROA: { name: '볶은향 장인', code: 'ROA', desc: '구수하게 볶은 따뜻한 향을 사랑', teas: ['호지차','현미차','대맥차','덖음차'] },
  MAL: { name: '맥아 수집가', code: 'MAL', desc: '몰트와 곡물의 깊은 향미를 즐기는 취향', teas: ['아쌈','기문','전홍','영덕 홍차'] },
  WOO: { name: '숲향 애호가', code: 'WOO', desc: '나무와 숲의 향기에 편안함을 느끼는 취향', teas: ['운남 생보이차','무이암차','백년송침','단총'] },
  EAR: { name: '대지 탐험가', code: 'EAR', desc: '흙과 대지의 깊은 향을 탐구하는 취향', teas: ['숙보이차','흑차','안화흑차','육안과편'] },
  SPI: { name: '향신료 여행가', code: 'SPI', desc: '스파이시한 향과 자극을 즐기는 취향', teas: ['차이','마살라차이','계피차','생강차'] },
  SMO: { name: '훈연향 조련사', code: 'SMO', desc: '스모키한 매력에 빠진 깊은 취향', teas: ['정산소종','랍상소우총','훈제 보이차','연훈차'] },
  COM: { name: '복합향 현자', code: 'COM', desc: '여러 향이 겹치는 복합적 세계를 탐구', teas: ['대홍포','동방미인','다즐링 2nd','숙보이차'] },
};

interface Q { q: string; opts: { text: string; scores: Partial<Record<Code, number>> }[] }

const QUESTIONS: Q[] = [
  { q: '꽃집 앞을 지나갈 때 가장 끌리는 향은?', opts: [
    { text: '장미·백합', scores: { FLA: 2 } }, { text: '감귤·레몬', scores: { CIT: 2 } },
    { text: '바닐라·달콤한 향', scores: { SWE: 2 } }, { text: '숲속 나무 향', scores: { WOO: 2 } },
  ]},
  { q: '향수를 고른다면?', opts: [
    { text: '플로럴', scores: { FLA: 2 } }, { text: '시트러스', scores: { CIT: 2 } },
    { text: '머스크', scores: { CRE: 2 } }, { text: '우디', scores: { WOO: 2 } },
  ]},
  { q: '가장 좋아하는 과일향은?', opts: [
    { text: '복숭아', scores: { FRU: 2 } }, { text: '포도', scores: { FRU: 2 } },
    { text: '귤', scores: { CIT: 2 } }, { text: '무화과', scores: { HON: 1, WOO: 1 } },
  ]},
  { q: '좋은 차에서 나는 향이라면?', opts: [
    { text: '꽃', scores: { FLA: 2 } }, { text: '과일', scores: { FRU: 2 } },
    { text: '꿀', scores: { HON: 2 } }, { text: '나무', scores: { WOO: 2 } },
  ]},
  { q: '커피는?', opts: [
    { text: '안 마심', scores: { FLA: 1, SWE: 1 } }, { text: '라떼', scores: { CRE: 2 } },
    { text: '아메리카노', scores: { ROA: 1, MAL: 1 } }, { text: '에스프레소', scores: { SMO: 1, COM: 1 } },
  ]},
  { q: '다크초콜릿은?', opts: [
    { text: '싫음', scores: { SWE: 1, FLA: 1 } }, { text: '무난', scores: { HON: 1, CRE: 1 } },
    { text: '좋아함', scores: { ROA: 1, EAR: 1 } }, { text: '매우 좋아함', scores: { SMO: 1, COM: 1 } },
  ]},
  { q: '쓴맛 허용도는?', opts: [
    { text: '매우 낮음', scores: { SWE: 2 } }, { text: '낮음', scores: { FRU: 1, HON: 1 } },
    { text: '높음', scores: { ROA: 1, MAL: 1 } }, { text: '매우 높음', scores: { EAR: 1, COM: 1 } },
  ]},
  { q: '떫은맛 허용도는?', opts: [
    { text: '싫음', scores: { CRE: 1, SWE: 1 } }, { text: '약간 가능', scores: { FLA: 1, FRU: 1 } },
    { text: '괜찮음', scores: { WOO: 1, MIN: 1 } }, { text: '좋아함', scores: { COM: 1, EAR: 1 } },
  ]},
  { q: '더 끌리는 음식은?', opts: [
    { text: '케이크', scores: { SWE: 1, CRE: 1 } }, { text: '과일', scores: { FRU: 1, CIT: 1 } },
    { text: '구운 고기', scores: { ROA: 1, SMO: 1 } }, { text: '버섯요리', scores: { EAR: 1, WOO: 1 } },
  ]},
  { q: '빵을 먹는다면?', opts: [
    { text: '크루아상', scores: { CRE: 2 } }, { text: '과일 데니쉬', scores: { FRU: 2 } },
    { text: '호밀빵', scores: { MAL: 2 } }, { text: '통곡물빵', scores: { ROA: 1, EAR: 1 } },
  ]},
  { q: '좋아하는 디저트는?', opts: [
    { text: '생크림', scores: { CRE: 2 } }, { text: '과일 타르트', scores: { FRU: 1, CIT: 1 } },
    { text: '다크초콜릿', scores: { SMO: 1, COM: 1 } }, { text: '견과류 디저트', scores: { ROA: 1, MAL: 1 } },
  ]},
  { q: '한식에서 가장 좋아하는 향은?', opts: [
    { text: '꽃나물', scores: { FLA: 1, VEG: 1 } }, { text: '과일청', scores: { FRU: 1, HON: 1 } },
    { text: '누룽지', scores: { ROA: 2 } }, { text: '버섯', scores: { EAR: 1, MIN: 1 } },
  ]},
  { q: '영화를 볼 때 중요한 것은?', opts: [
    { text: '감성', scores: { FLA: 1, HON: 1 } }, { text: '아름다운 영상', scores: { FRU: 1, CIT: 1 } },
    { text: '스토리', scores: { ROA: 1, MAL: 1 } }, { text: '세계관', scores: { COM: 2 } },
  ]},
  { q: '여행지를 고른다면?', opts: [
    { text: '꽃축제', scores: { FLA: 2 } }, { text: '해변', scores: { MAR: 1, CIT: 1 } },
    { text: '산', scores: { VEG: 1, MIN: 1 } }, { text: '숲', scores: { WOO: 1, EAR: 1 } },
  ]},
  { q: '복잡한 향에 대한 호감도는?', opts: [
    { text: '싫음', scores: { SWE: 1, CRE: 1 } }, { text: '약간 좋음', scores: { FLA: 1, FRU: 1 } },
    { text: '좋음', scores: { WOO: 1, MIN: 1 } }, { text: '매우 좋음', scores: { COM: 2 } },
  ]},
  { q: '첫 모금에서 중요한 것은?', opts: [
    { text: '향', scores: { FLA: 1, FRU: 1 } }, { text: '상쾌함', scores: { CIT: 1, VEG: 1 } },
    { text: '맛', scores: { MAL: 1, ROA: 1 } }, { text: '여운', scores: { COM: 1, EAR: 1 } },
  ]},
  { q: '가장 궁금한 향은?', opts: [
    { text: '난초', scores: { FLA: 2 } }, { text: '백포도', scores: { FRU: 1, CIT: 1 } },
    { text: '꿀', scores: { HON: 2 } }, { text: '젖은 숲', scores: { EAR: 1, WOO: 1 } },
  ]},
  { q: '아이스티라면?', opts: [
    { text: '복숭아', scores: { FRU: 2 } }, { text: '레몬', scores: { CIT: 2 } },
    { text: '무가당', scores: { VEG: 1, MIN: 1 } }, { text: '안 마심', scores: { ROA: 1, EAR: 1 } },
  ]},
  { q: '차를 마시는 이유는?', opts: [
    { text: '향을 즐기려고', scores: { FLA: 1, COM: 1 } }, { text: '기분전환', scores: { FRU: 1, CIT: 1 } },
    { text: '집중', scores: { MAL: 1, ROA: 1 } }, { text: '탐험', scores: { COM: 2 } },
  ]},
  { q: '차 한 잔을 표현한다면?', opts: [
    { text: '꽃다발', scores: { FLA: 2 } }, { text: '과일바구니', scores: { FRU: 2 } },
    { text: '장작불', scores: { ROA: 1, SMO: 1 } }, { text: '오래된 도서관', scores: { COM: 1, EAR: 1 } },
  ]},
];

function calculateResult(answers: number[]): { profile: string; top3: Code[]; scores: Record<Code, number> } {
  const scores: Record<string, number> = {};
  for (const c of Object.keys(TYPE_INFO)) scores[c] = 0;
  answers.forEach((ai, qi) => {
    const opt = QUESTIONS[qi]?.opts[ai];
    if (!opt) return;
    for (const [code, pts] of Object.entries(opt.scores)) scores[code] = (scores[code] || 0) + (pts || 0);
  });
  const sorted = Object.entries(scores).sort((a, b) => b[1] - a[1]);
  const top3 = sorted.slice(0, 3).map(([c]) => c as Code);
  return { profile: top3.join('-'), top3, scores: scores as Record<Code, number> };
}

export default function TeaTestPage() {
  const { accessToken } = useAuthStore();
  const [step, setStep] = useState<'intro' | 'quiz' | 'result'>('intro');
  const [current, setCurrent] = useState(0);
  const [answers, setAnswers] = useState<number[]>([]);
  const [result, setResult] = useState<ReturnType<typeof calculateResult> | null>(null);

  const { data: recProducts } = useQuery({
    queryKey: ['tea-rec', result?.profile],
    queryFn: () => publicApi.getTeaRecommendations(result!.top3.join(',')).then((r) => r.data.data),
    enabled: !!result,
  });

  const handleAnswer = (idx: number) => {
    const next = [...answers, idx];
    setAnswers(next);
    if (current < QUESTIONS.length - 1) {
      setCurrent(current + 1);
    } else {
      const r = calculateResult(next);
      setResult(r);
      setStep('result');
      if (accessToken) {
        consumerAuthApi.saveTeaProfile({ teaProfile: r.profile, teaScores: r.scores }, accessToken).catch(() => {});
      }
    }
  };

  const restart = () => { setStep('intro'); setCurrent(0); setAnswers([]); setResult(null); };

  return (
    <div className="min-h-screen bg-gradient-to-b from-tea-50 to-cream-50">
      <NavBar title="차 취향 검사" back={true} />

      {step === 'intro' && (
        <div className="max-w-md mx-auto px-4 py-12 text-center">
          <div className="w-16 h-16 bg-tea-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-tea-700 font-bold text-xl">Tea</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">나의 차 취향은?</h1>
          <p className="text-gray-500 text-sm mb-1">20개 질문으로 알아보는 나만의 차 취향</p>
          <p className="text-gray-400 text-xs mb-8">16가지 향미 유형 중 나의 타입을 찾아보세요</p>
          <button onClick={() => setStep('quiz')}
            className="w-full py-3.5 bg-tea-600 text-white rounded-2xl font-semibold text-lg hover:bg-tea-700 transition-colors shadow-lg shadow-tea-200">
            테스트 시작하기
          </button>
          <p className="text-xs text-gray-400 mt-4">약 3분 소요</p>
        </div>
      )}

      {step === 'quiz' && (
        <div className="max-w-md mx-auto px-4 py-6">
          {/* 진행바 */}
          <div className="mb-6">
            <div className="flex justify-between text-xs text-gray-400 mb-1">
              <span>Q{current + 1} / {QUESTIONS.length}</span>
              <span>{Math.round(((current + 1) / QUESTIONS.length) * 100)}%</span>
            </div>
            <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
              <div className="h-full bg-tea-500 rounded-full transition-all duration-300"
                style={{ width: `${((current + 1) / QUESTIONS.length) * 100}%` }} />
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <p className="text-lg font-bold text-gray-900 mb-5">{QUESTIONS[current].q}</p>
            <div className="space-y-2.5">
              {QUESTIONS[current].opts.map((opt, i) => (
                <button key={`${current}-${i}`} onClick={() => handleAnswer(i)}
                  className="w-full text-left px-4 py-3.5 rounded-xl border border-gray-200 hover:border-tea-400 hover:bg-tea-50 transition-all text-sm text-gray-700 font-medium">
                  {opt.text}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {step === 'result' && result && (
        <div className="max-w-md mx-auto px-4 py-6 space-y-5">
          {/* 메인 결과 */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 text-center">
            <p className="text-xs text-tea-600 font-medium mb-2">나의 차 취향</p>
            <div className="flex justify-center gap-2 mb-3">
              {result.top3.map((c) => (
                <span key={c} className="text-sm font-bold bg-tea-100 text-tea-700 px-2.5 py-1 rounded-full">{c}</span>
              ))}
            </div>
            <p className="text-lg font-bold text-gray-900 tracking-wider mb-1">{result.profile}</p>
            <p className="text-base font-semibold text-tea-700">
              {result.top3.map((c) => TYPE_INFO[c].name).join(' · ')}
            </p>
          </div>

          {/* Top 3 유형 상세 */}
          {result.top3.map((code, rank) => (
            <Link key={code} href={`/tea-test/${code}`}
              className="block bg-white rounded-2xl shadow-sm border border-gray-100 p-5 hover:border-tea-300 hover:shadow-md transition-all group">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs font-bold text-white bg-tea-600 w-5 h-5 rounded-full flex items-center justify-center">{rank + 1}</span>
                <span className="text-xs font-bold bg-gray-100 text-gray-600 px-2 py-0.5 rounded">{code}</span>
                <span className="font-bold text-gray-900">{TYPE_INFO[code].name}</span>
                <span className="text-xs text-gray-400 ml-auto">{result.scores[code]}점</span>
              </div>
              <p className="text-sm text-gray-500 mb-3">{TYPE_INFO[code].desc}</p>
              <div>
                <p className="text-xs font-semibold text-tea-700 mb-1">추천 차</p>
                <div className="flex flex-wrap gap-1.5">
                  {TYPE_INFO[code].teas.map((t) => (
                    <span key={t} className="text-xs bg-tea-50 text-tea-700 px-2 py-1 rounded-lg">{t}</span>
                  ))}
                </div>
              </div>
              <div className="mt-3 pt-3 border-t border-gray-100 text-center">
                <span className="text-sm font-medium text-tea-600">이 취향의 상품 보기 &rarr;</span>
              </div>
            </Link>
          ))}

          {/* 전체 점수 차트 */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
            <p className="font-bold text-gray-900 mb-3 text-sm">향미 프로필</p>
            <div className="space-y-1.5">
              {Object.entries(result.scores)
                .sort((a, b) => b[1] - a[1])
                .filter(([, v]) => v > 0)
                .map(([code, score]) => {
                  const info = TYPE_INFO[code as Code];
                  const maxScore = Math.max(...Object.values(result.scores));
                  return (
                    <div key={code} className="flex items-center gap-2 text-xs">
                      <span className="w-5 text-center text-[9px] font-bold text-gray-400">{code}</span>
                      <span className="w-16 text-gray-600 truncate">{info.name.split(' ')[0]}</span>
                      <div className="flex-1 h-3 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full bg-tea-400 rounded-full transition-all" style={{ width: `${(score / maxScore) * 100}%` }} />
                      </div>
                      <span className="w-6 text-right text-gray-400">{score}</span>
                    </div>
                  );
                })}
            </div>
          </div>

          {/* 추천 상품 */}
          {recProducts && recProducts.length > 0 && (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
              <p className="font-bold text-gray-900 mb-3 text-sm">나에게 맞는 상품</p>
              <div className="space-y-3">
                {recProducts.slice(0, 3).map((p: any) => (
                  <Link key={p.id} href={`/store/${p.store.slug}/products/${p.id}`}
                    className="flex gap-3 items-center hover:bg-gray-50 rounded-xl p-2 -mx-2 transition-colors">
                    <div className="w-14 h-14 rounded-xl overflow-hidden bg-gray-100 shrink-0">
                      {imgUrl(p.thumbnail) ? <img src={imgUrl(p.thumbnail)!} alt="" className="w-full h-full object-cover" /> :
                        <div className="w-full h-full flex items-center justify-center"><ShoppingBag size={18} className="text-gray-300" /></div>}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-900 truncate">{p.name}</p>
                      <p className="text-xs text-gray-400 truncate">{p.store.name}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        {p.discountRate > 0 && <span className="text-xs font-bold text-red-500">{p.discountRate}%</span>}
                        <span className="text-sm font-bold text-gray-900">{p.price.toLocaleString()}원</span>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* 버튼 */}
          <div className="flex gap-3">
            <button onClick={restart} className="flex-1 py-3 border border-gray-200 rounded-2xl text-sm font-medium text-gray-600 hover:bg-gray-50">
              다시 테스트
            </button>
            <Link href="/" className="flex-1 py-3 bg-tea-600 text-white rounded-2xl text-sm font-medium text-center hover:bg-tea-700">
              쇼핑하러 가기
            </Link>
          </div>

          {!accessToken && (
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 text-center">
              <p className="text-sm font-semibold text-gray-800 mb-1">회원가입하면 이 결과가 저장됩니다</p>
              <p className="text-xs text-gray-500 mb-4">내 차 취향에 맞는 상품을 메인 페이지에서 매번 추천받을 수 있어요</p>
              <Link href="/auth/register" className="inline-block px-6 py-2.5 bg-tea-600 text-white rounded-xl text-sm font-medium hover:bg-tea-700 transition-colors">
                회원가입하고 맞춤 추천 받기
              </Link>
              <p className="text-xs text-gray-400 mt-2">
                이미 계정이 있다면? <Link href="/auth/login" className="text-tea-600 hover:underline">로그인</Link>
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
