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

const TYPE_INFO: Record<Code, { name: string; desc: string; teas: string[] }> = {
  FLA: { name: '꽃향 예술가', desc: '섬세한 꽃향을 감별하는 예민한 취향', teas: ['동방미인','백호은침','자스민차','문산포종'] },
  FRU: { name: '과일향 탐험가', desc: '상쾌한 과일향을 사랑하는 활기찬 취향', teas: ['다즐링 1st Flush','실론','청향 우롱','히비스커스'] },
  CIT: { name: '시트러스 애호가', desc: '톡 쏘는 상큼함을 추구하는 취향', teas: ['얼그레이','레몬그라스','유자차','감귤녹차'] },
  SWE: { name: '달향 수집가', desc: '달콤한 향에 끌리는 포근한 취향', teas: ['바닐라 홍차','카라멜 홍차','루이보스','꿀차'] },
  HON: { name: '꿀향 애호가', desc: '자연스러운 꿀 같은 달콤함을 감별하는 취향', teas: ['백모단','대홍포','밀향단총','황산모봉'] },
  CRE: { name: '크림향 탐험가', desc: '부드럽고 크리미한 맛을 선호', teas: ['밀크우롱','금선차','라떼 블렌드','호지차라떼'] },
  VEG: { name: '풀향 애호가', desc: '신선한 풀과 채소의 향을 즐기는 취향', teas: ['용정차','센차','말차','안길백차'] },
  MAR: { name: '해풍 추구자', desc: '바다와 해초의 미네랄 향을 찾는 취향', teas: ['규스 옥로','제주 녹차','해풍 말차'] },
  MIN: { name: '광물향 탐색가', desc: '돌과 광물의 깊은 뉘앙스를 찾는 취향', teas: ['무이암차','대홍포','철관음','동정우롱'] },
  ROA: { name: '볶은향 장인', desc: '구수하게 볶은 따뜻한 향을 사랑', teas: ['호지차','현미차','대맥차','덖음차'] },
  MAL: { name: '맥아 수집가', desc: '몰트와 곡물의 깊은 향미를 즐기는 취향', teas: ['아쌈','기문','전홍','영덕 홍차'] },
  WOO: { name: '숲향 애호가', desc: '나무와 숲의 향기에 편안함을 느끼는 취향', teas: ['운남 생보이차','무이암차','단총'] },
  EAR: { name: '대지 탐험가', desc: '흙과 대지의 깊은 향을 탐구하는 취향', teas: ['숙보이차','흑차','안화흑차'] },
  SPI: { name: '향신료 여행가', desc: '스파이시한 향과 자극을 즐기는 취향', teas: ['차이','마살라차이','계피차','생강차'] },
  SMO: { name: '훈연향 조련사', desc: '스모키한 매력에 빠진 깊은 취향', teas: ['정산소종','랍상소우총','훈제 보이차'] },
  COM: { name: '복합향 현자', desc: '여러 향이 겹치는 복합적 세계를 탐구', teas: ['대홍포','동방미인','다즐링 2nd','숙보이차'] },
};

const SCALE_LABELS = ['전혀', '조금', '보통', '좋아함', '매우 좋아함'];

// ── PART 1: 향 선호도 (슬라이더 1~5) ──
const AROMA_SLIDERS: { label: string; sub: string; codes: { code: Code; weight: number }[] }[] = [
  { label: '꽃향', sub: '장미, 자스민, 난초, 백합 같은 향', codes: [{ code: 'FLA', weight: 1 }] },
  { label: '과일향', sub: '복숭아, 포도, 살구, 사과 같은 향', codes: [{ code: 'FRU', weight: 1 }] },
  { label: '시트러스향', sub: '레몬, 귤, 자몽, 베르가못 같은 향', codes: [{ code: 'CIT', weight: 1 }] },
  { label: '달콤한 향', sub: '바닐라, 캐러멜, 사탕 같은 인공적 달콤함', codes: [{ code: 'SWE', weight: 1 }] },
  { label: '꿀향', sub: '자연적인 꿀, 밀납 같은 달콤함', codes: [{ code: 'HON', weight: 1 }] },
  { label: '크리미한 향', sub: '우유, 버터, 크림 같은 부드러움', codes: [{ code: 'CRE', weight: 1 }] },
  { label: '풀/채소 향', sub: '갓 벤 풀, 해초, 시금치 같은 신선함', codes: [{ code: 'VEG', weight: 1 }] },
  { label: '바다/미네랄 향', sub: '해풍, 바위, 미네랄 워터 같은 향', codes: [{ code: 'MAR', weight: 0.5 }, { code: 'MIN', weight: 0.5 }] },
  { label: '볶은/구운 향', sub: '토스트, 볶은 곡물, 커피 같은 향', codes: [{ code: 'ROA', weight: 0.5 }, { code: 'MAL', weight: 0.5 }] },
  { label: '나무/숲 향', sub: '삼나무, 백단향, 젖은 숲 같은 향', codes: [{ code: 'WOO', weight: 1 }] },
  { label: '흙/대지 향', sub: '비 온 뒤 흙, 버섯, 이끼 같은 향', codes: [{ code: 'EAR', weight: 1 }] },
  { label: '향신료 향', sub: '계피, 생강, 후추, 정향 같은 향', codes: [{ code: 'SPI', weight: 1 }] },
  { label: '훈연/스모키 향', sub: '장작불, 캠프파이어, 훈제 같은 향', codes: [{ code: 'SMO', weight: 1 }] },
];

// ── PART 2: 맛 선호도 (슬라이더 1~5) ──
const TASTE_SLIDERS: { label: string; sub: string; effect: 'bitter' | 'sweet' | 'astringent' | 'body' | 'complexity' }[] = [
  { label: '쓴맛 허용도', sub: '에스프레소, 다크초콜릿 같은 쓴맛', effect: 'bitter' },
  { label: '떫은맛 허용도', sub: '덜 익은 감, 레드와인의 탄닌감', effect: 'astringent' },
  { label: '단맛 선호도', sub: '차에서 느껴지는 달콤함을 좋아하는 정도', effect: 'sweet' },
  { label: '묵직한 바디감 선호도', sub: '가벼운 차 vs 묵직한 차', effect: 'body' },
  { label: '복잡한 향 선호도', sub: '단순한 향 vs 여러 겹의 복합적 향', effect: 'complexity' },
];

// ── PART 3: 시나리오 선택 ──
interface ChoiceQ { q: string; opts: { text: string; scores: Partial<Record<Code, number>> }[] }
const SCENARIO_QUESTIONS: ChoiceQ[] = [
  { q: '커피를 마신다면?', opts: [
    { text: '안 마심 / 디카페인', scores: { FLA: 2, SWE: 1 } }, { text: '라떼 / 카푸치노', scores: { CRE: 2, HON: 1 } },
    { text: '아메리카노', scores: { ROA: 2, MAL: 1 } }, { text: '에스프레소 / 핸드드립', scores: { COM: 2, SMO: 1 } },
  ]},
  { q: '가장 끌리는 디저트는?', opts: [
    { text: '과일 타르트 / 마카롱', scores: { FRU: 2, CIT: 1 } }, { text: '생크림 케이크 / 치즈케이크', scores: { CRE: 2, SWE: 1 } },
    { text: '다크 초콜릿 / 브라우니', scores: { SMO: 2, EAR: 1 } }, { text: '약과 / 견과류 디저트', scores: { ROA: 2, MAL: 1 } },
  ]},
  { q: '향수를 고른다면?', opts: [
    { text: '플로럴 / 로즈', scores: { FLA: 3 } }, { text: '시트러스 / 프레시', scores: { CIT: 2, VEG: 1 } },
    { text: '우디 / 앰버', scores: { WOO: 2, EAR: 1 } }, { text: '머스크 / 오리엔탈', scores: { COM: 2, SPI: 1 } },
  ]},
  { q: '숲에서 가장 좋은 냄새는?', opts: [
    { text: '꽃향기', scores: { FLA: 2, FRU: 1 } }, { text: '감귤 / 허브 향', scores: { CIT: 2, VEG: 1 } },
    { text: '나무 / 수액 향', scores: { WOO: 3 } }, { text: '비 온 뒤 흙냄새', scores: { EAR: 2, MIN: 1 } },
  ]},
  { q: '여행지를 고른다면?', opts: [
    { text: '꽃축제 / 라벤더밭', scores: { FLA: 2, HON: 1 } }, { text: '해변 / 열대 섬', scores: { MAR: 2, CIT: 1 } },
    { text: '고성 / 유적지', scores: { EAR: 2, COM: 1 } }, { text: '차밭 / 산속 사찰', scores: { VEG: 2, MIN: 1 } },
  ]},
  { q: '와인이라면?', opts: [
    { text: '안 마심 / 모름', scores: { SWE: 1, CRE: 1 } }, { text: '화이트 / 스파클링', scores: { CIT: 2, FRU: 1 } },
    { text: '레드 와인', scores: { EAR: 2, COM: 1 } }, { text: '내추럴 / 오렌지 와인', scores: { MIN: 2, COM: 1 } },
  ]},
  { q: '차를 마시는 이유는?', opts: [
    { text: '향을 즐기려고', scores: { FLA: 2, FRU: 1 } }, { text: '기분전환 / 힐링', scores: { SWE: 1, CRE: 1, HON: 1 } },
    { text: '집중 / 명상', scores: { MIN: 2, VEG: 1 } }, { text: '탐험 / 수집', scores: { COM: 3 } },
  ]},
  { q: '차 한 잔을 표현한다면?', opts: [
    { text: '꽃다발', scores: { FLA: 3 } }, { text: '과일 바구니', scores: { FRU: 2, CIT: 1 } },
    { text: '장작불 옆 핫초코', scores: { ROA: 2, SMO: 1 } }, { text: '오래된 도서관', scores: { COM: 2, EAR: 1 } },
  ]},
  { q: '가향차(얼그레이, 바닐라 등)에 대한 생각?', opts: [
    { text: '매우 좋다', scores: { SWE: 2, FRU: 1 } }, { text: '괜찮다', scores: { CIT: 1, CRE: 1 } },
    { text: '자연향이 더 좋다', scores: { FLA: 1, VEG: 1, MIN: 1 } }, { text: '절대 안 마신다', scores: { COM: 2, MIN: 1 } },
  ]},
  { q: '찻잎 산지, 우림 방법이 중요한가?', opts: [
    { text: '전혀 모른다', scores: { SWE: 1, CRE: 1 } }, { text: '약간 관심', scores: { FLA: 1, HON: 1 } },
    { text: '꽤 중요하다', scores: { WOO: 1, MIN: 1 } }, { text: '테루아가 핵심', scores: { COM: 3 } },
  ]},
];

function calculateResult(
  aromaValues: number[], tasteValues: number[], choiceAnswers: number[]
) {
  const scores: Record<string, number> = {};
  for (const c of Object.keys(TYPE_INFO)) scores[c] = 0;

  // Part 1: 향 슬라이더 (최대 5점 * weight per code)
  aromaValues.forEach((val, i) => {
    const s = AROMA_SLIDERS[i];
    s.codes.forEach(({ code, weight }) => { scores[code] += val * weight * 2; });
  });

  // Part 2: 맛 슬라이더 보정
  const bitter = tasteValues[0] || 1;
  const astringent = tasteValues[1] || 1;
  const sweet = tasteValues[2] || 1;
  const body = tasteValues[3] || 1;
  const complexity = tasteValues[4] || 1;

  if (bitter >= 4) { scores.ROA += 2; scores.SMO += 2; scores.EAR += 1; scores.COM += 1; }
  if (bitter <= 2) { scores.SWE += 2; scores.FLA += 1; scores.CRE += 1; }
  if (astringent >= 4) { scores.WOO += 2; scores.MIN += 1; scores.COM += 1; }
  if (sweet >= 4) { scores.SWE += 2; scores.HON += 2; scores.CRE += 1; }
  if (body >= 4) { scores.MAL += 2; scores.EAR += 2; scores.ROA += 1; }
  if (body <= 2) { scores.FLA += 1; scores.VEG += 1; scores.CIT += 1; }
  if (complexity >= 4) { scores.COM += 3; scores.MIN += 1; }
  if (complexity <= 2) { scores.SWE += 1; scores.CRE += 1; }

  // Part 3: 시나리오 선택
  choiceAnswers.forEach((ai, qi) => {
    const opt = SCENARIO_QUESTIONS[qi]?.opts[ai];
    if (!opt) return;
    for (const [code, pts] of Object.entries(opt.scores)) scores[code] += pts || 0;
  });

  const sorted = Object.entries(scores).sort((a, b) => b[1] - a[1]);
  const top3 = sorted.slice(0, 3).map(([c]) => c as Code);
  const bitterScore = Math.round(bitter * 20);
  const complexityScore = Math.round(complexity * 20);
  const bitterLevel = bitterScore <= 25 ? '매우 낮음' : bitterScore <= 50 ? '낮음' : bitterScore <= 75 ? '보통' : '높음';
  const complexLevel = complexityScore <= 25 ? '단순 향 선호' : complexityScore <= 50 ? '중간' : complexityScore <= 75 ? '복합향 선호' : '티 매니아';

  return {
    profile: top3.join('-'), top3, scores: scores as Record<Code, number>,
    bitterScore, bitterLevel, complexityScore, complexLevel,
    tasteProfile: { bitter, astringent, sweet, body, complexity },
  };
}

export default function DetailedTestPage() {
  const { accessToken } = useAuthStore();
  const [step, setStep] = useState<'intro' | 'part1' | 'part2' | 'part3' | 'result'>('intro');
  const [saved, setSaved] = useState(false);

  // Part 1: 향 슬라이더 값 (0 = 미응답)
  const [aromaValues, setAromaValues] = useState<number[]>(AROMA_SLIDERS.map(() => 0));
  // Part 2: 맛 슬라이더 값 (0 = 미응답)
  const [tasteValues, setTasteValues] = useState<number[]>(TASTE_SLIDERS.map(() => 0));
  // Part 3: 시나리오 선택
  const [current, setCurrent] = useState(0);
  const [choiceAnswers, setChoiceAnswers] = useState<number[]>([]);

  const [result, setResult] = useState<ReturnType<typeof calculateResult> | null>(null);

  const { data: recProducts } = useQuery({
    queryKey: ['tea-rec-detail', result?.profile],
    queryFn: () => publicApi.getTeaRecommendations(result!.top3.join(',')).then((r) => r.data.data),
    enabled: !!result,
  });

  const currentPartNum = step === 'part1' ? 1 : step === 'part2' ? 2 : step === 'part3' ? 3 : 0;
  const overallProgress = step === 'part1' ? 10 : step === 'part2' ? 40 : step === 'part3' ? 60 + (choiceAnswers.length / SCENARIO_QUESTIONS.length) * 40 : 100;

  const handleChoiceAnswer = (idx: number) => {
    const next = [...choiceAnswers, idx];
    setChoiceAnswers(next);
    if (current < SCENARIO_QUESTIONS.length - 1) {
      setCurrent(current + 1);
    } else {
      const r = calculateResult(aromaValues, tasteValues, next);
      setResult(r);
      setStep('result');
      if (accessToken) {
        consumerAuthApi.saveTeaProfile({ teaProfile: r.profile, teaScores: r.scores }, accessToken)
          .then(() => setSaved(true)).catch(() => {});
      }
    }
  };

  const restart = () => { setStep('intro'); setAromaValues(AROMA_SLIDERS.map(() => 0)); setTasteValues(TASTE_SLIDERS.map(() => 0)); setCurrent(0); setChoiceAnswers([]); setResult(null); setSaved(false); };

  return (
    <div className="min-h-screen bg-gradient-to-b from-tea-50 to-cream-50">
      <NavBar title="상세 차 취향 검사" back={true} />

      {/* 전체 진행바 */}
      {step !== 'intro' && step !== 'result' && (
        <div className="sticky top-14 z-10 bg-white/80 backdrop-blur border-b border-gray-100 px-4 py-2">
          <div className="max-w-md mx-auto flex items-center gap-3">
            <span className="text-xs font-bold text-tea-600">PART {currentPartNum}/3</span>
            <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
              <div className="h-full bg-tea-500 rounded-full transition-all duration-300" style={{ width: `${overallProgress}%` }} />
            </div>
            <span className="text-xs text-gray-400">{Math.round(overallProgress)}%</span>
          </div>
        </div>
      )}

      {/* ── INTRO ── */}
      {step === 'intro' && (
        <div className="max-w-md mx-auto px-4 py-10 text-center">
          <div className="w-16 h-16 bg-tea-600 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-white font-bold text-lg">Pro</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">상세 차 취향 진단</h1>
          <p className="text-gray-500 text-sm mb-6">슬라이더와 선택형을 통한 정밀 분석</p>
          <div className="bg-white rounded-2xl border border-gray-100 p-4 mb-6 text-left space-y-3">
            <div className="flex items-center gap-3 text-sm">
              <span className="w-7 h-7 rounded-full bg-tea-100 text-tea-700 text-xs font-bold flex items-center justify-center shrink-0">1</span>
              <div><p className="font-medium text-gray-800">향 선호도</p><p className="text-xs text-gray-400">13가지 향에 대한 선호도를 1~5점으로 평가</p></div>
            </div>
            <div className="flex items-center gap-3 text-sm">
              <span className="w-7 h-7 rounded-full bg-tea-100 text-tea-700 text-xs font-bold flex items-center justify-center shrink-0">2</span>
              <div><p className="font-medium text-gray-800">맛 성향</p><p className="text-xs text-gray-400">쓴맛, 떫은맛, 단맛, 바디감, 복합성 1~5점 평가</p></div>
            </div>
            <div className="flex items-center gap-3 text-sm">
              <span className="w-7 h-7 rounded-full bg-tea-100 text-tea-700 text-xs font-bold flex items-center justify-center shrink-0">3</span>
              <div><p className="font-medium text-gray-800">라이프스타일</p><p className="text-xs text-gray-400">10개 시나리오 선택으로 취향 보정</p></div>
            </div>
          </div>
          <button onClick={() => setStep('part1')}
            className="w-full py-3.5 bg-tea-600 text-white rounded-2xl font-semibold text-lg hover:bg-tea-700 transition-colors shadow-lg shadow-tea-200">
            테스트 시작하기
          </button>
          <p className="text-xs text-gray-400 mt-4">약 5~7분 소요</p>
        </div>
      )}

      {/* ── PART 1: 향 슬라이더 ── */}
      {step === 'part1' && (
        <div className="max-w-md mx-auto px-4 py-6">
          <div className="mb-5">
            <h2 className="text-lg font-bold text-gray-900">PART 1. 향 선호도</h2>
            <p className="text-sm text-gray-500 mt-1">각 향을 얼마나 좋아하는지 1~5점으로 평가해주세요</p>
          </div>
          <div className="space-y-4">
            {AROMA_SLIDERS.map((s, i) => (
              <div key={i} className={`bg-white rounded-xl border p-4 transition-colors ${aromaValues[i] > 0 ? 'border-tea-200' : 'border-gray-100'}`}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-semibold text-gray-800">{s.label}</span>
                  {aromaValues[i] > 0 && <span className="text-xs font-bold text-tea-600">{SCALE_LABELS[aromaValues[i] - 1]}</span>}
                </div>
                <p className="text-xs text-gray-400 mb-3">{s.sub}</p>
                <div className="flex gap-2">
                  {SCALE_LABELS.map((l, li) => (
                    <button key={li} type="button"
                      onClick={() => { const v = [...aromaValues]; v[i] = li + 1; setAromaValues(v); }}
                      className={`flex-1 py-2 rounded-lg text-xs font-medium transition-all ${aromaValues[i] === li + 1 ? 'bg-tea-600 text-white shadow-sm' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>
                      {l}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
          {aromaValues.some(v => v === 0) && (
            <p className="text-xs text-amber-600 text-center mt-3">모든 항목에 응답해주세요 ({aromaValues.filter(v => v > 0).length}/{aromaValues.length})</p>
          )}
          <button onClick={() => setStep('part2')}
            disabled={aromaValues.some(v => v === 0)}
            className="w-full mt-4 py-3 bg-tea-600 text-white rounded-2xl font-semibold hover:bg-tea-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
            다음: 맛 성향
          </button>
        </div>
      )}

      {/* ── PART 2: 맛 슬라이더 ── */}
      {step === 'part2' && (
        <div className="max-w-md mx-auto px-4 py-6">
          <div className="mb-5">
            <h2 className="text-lg font-bold text-gray-900">PART 2. 맛 성향</h2>
            <p className="text-sm text-gray-500 mt-1">각 맛에 대한 선호도/허용도를 평가해주세요</p>
          </div>
          <div className="space-y-4">
            {TASTE_SLIDERS.map((s, i) => (
              <div key={i} className={`bg-white rounded-xl border p-4 transition-colors ${tasteValues[i] > 0 ? 'border-tea-200' : 'border-gray-100'}`}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-semibold text-gray-800">{s.label}</span>
                  {tasteValues[i] > 0 && <span className="text-xs font-bold text-tea-600">{SCALE_LABELS[tasteValues[i] - 1]}</span>}
                </div>
                <p className="text-xs text-gray-400 mb-3">{s.sub}</p>
                <div className="flex gap-2">
                  {SCALE_LABELS.map((l, li) => (
                    <button key={li} type="button"
                      onClick={() => { const v = [...tasteValues]; v[i] = li + 1; setTasteValues(v); }}
                      className={`flex-1 py-2 rounded-lg text-xs font-medium transition-all ${tasteValues[i] === li + 1 ? 'bg-tea-600 text-white shadow-sm' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>
                      {l}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
          {tasteValues.some(v => v === 0) && (
            <p className="text-xs text-amber-600 text-center mt-3">모든 항목에 응답해주세요 ({tasteValues.filter(v => v > 0).length}/{tasteValues.length})</p>
          )}
          <div className="flex gap-3 mt-4">
            <button onClick={() => setStep('part1')} className="flex-1 py-3 border border-gray-200 rounded-2xl text-sm font-medium text-gray-600 hover:bg-gray-50">이전</button>
            <button onClick={() => setStep('part3')}
              disabled={tasteValues.some(v => v === 0)}
              className="flex-1 py-3 bg-tea-600 text-white rounded-2xl font-semibold hover:bg-tea-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed">다음: 시나리오</button>
          </div>
        </div>
      )}

      {/* ── PART 3: 시나리오 선택 ── */}
      {step === 'part3' && (
        <div className="max-w-md mx-auto px-4 py-6">
          <div className="mb-5">
            <div className="flex justify-between text-xs text-gray-400 mb-1">
              <span>Q{choiceAnswers.length + 1} / {SCENARIO_QUESTIONS.length}</span>
              <span>{Math.round(((choiceAnswers.length + 1) / SCENARIO_QUESTIONS.length) * 100)}%</span>
            </div>
            <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
              <div className="h-full bg-tea-500 rounded-full transition-all duration-300"
                style={{ width: `${((choiceAnswers.length + 1) / SCENARIO_QUESTIONS.length) * 100}%` }} />
            </div>
          </div>
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <p className="text-lg font-bold text-gray-900 mb-5">{SCENARIO_QUESTIONS[current].q}</p>
            <div className="space-y-2.5">
              {SCENARIO_QUESTIONS[current].opts.map((opt, i) => (
                <button key={`${current}-${i}`} onClick={() => handleChoiceAnswer(i)}
                  className="w-full text-left px-4 py-3.5 rounded-xl border border-gray-200 hover:border-tea-400 hover:bg-tea-50 transition-all text-sm text-gray-700 font-medium">
                  {opt.text}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── RESULT ── */}
      {step === 'result' && result && (
        <div className="max-w-md mx-auto px-4 py-6 space-y-5">
          {/* 메인 결과 */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 text-center">
            <p className="text-xs text-tea-600 font-medium mb-2">상세 차 취향</p>
            <div className="flex justify-center gap-2 mb-3">
              {result.top3.map((c) => (
                <span key={c} className="text-sm font-bold bg-tea-100 text-tea-700 px-2.5 py-1 rounded-full">{c}</span>
              ))}
            </div>
            <p className="text-lg font-bold text-gray-900 tracking-wider mb-1">{result.profile}</p>
            <p className="text-base font-semibold text-tea-700">{result.top3.map((c) => TYPE_INFO[c].name).join(' / ')}</p>
            {saved && <p className="text-xs text-green-600 mt-2">프로필이 저장되었습니다. 메인 페이지에서 맞춤 추천을 받을 수 있습니다.</p>}
            {!accessToken && <p className="text-xs text-amber-600 mt-2"><Link href="/auth/login" className="underline">로그인</Link>하면 결과를 저장할 수 있습니다.</p>}
          </div>

          {/* 맛 성향 지수 */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
            <p className="font-bold text-gray-900 mb-3 text-sm">맛 성향 분석</p>
            <div className="space-y-3">
              {[
                { label: '쓴맛 허용', value: result.bitterScore, level: result.bitterLevel },
                { label: '복합향 선호', value: result.complexityScore, level: result.complexLevel },
                { label: '떫은맛 허용', value: (result.tasteProfile.astringent) * 20, level: '' },
                { label: '단맛 선호', value: (result.tasteProfile.sweet) * 20, level: '' },
                { label: '바디감 선호', value: (result.tasteProfile.body) * 20, level: '' },
              ].map((item) => (
                <div key={item.label}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-gray-600 font-medium">{item.label}</span>
                    <span className="text-gray-400">{item.value}% {item.level && `(${item.level})`}</span>
                  </div>
                  <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full bg-tea-500 rounded-full transition-all" style={{ width: `${item.value}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Top 3 유형 */}
          {result.top3.map((code, rank) => (
            <Link key={code} href={`/tea-test/${code}`}
              className="block bg-white rounded-2xl shadow-sm border border-gray-100 p-5 hover:border-tea-300 hover:shadow-md transition-all">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs font-bold text-white bg-tea-600 w-5 h-5 rounded-full flex items-center justify-center">{rank + 1}</span>
                <span className="text-xs font-bold bg-gray-100 text-gray-600 px-2 py-0.5 rounded">{code}</span>
                <span className="font-bold text-gray-900">{TYPE_INFO[code].name}</span>
                <span className="text-xs text-gray-400 ml-auto">{Math.round(result.scores[code])}점</span>
              </div>
              <p className="text-sm text-gray-500 mb-3">{TYPE_INFO[code].desc}</p>
              <div className="flex flex-wrap gap-1.5 mb-3">
                {TYPE_INFO[code].teas.map((t) => (
                  <span key={t} className="text-xs bg-tea-50 text-tea-700 px-2 py-1 rounded-lg">{t}</span>
                ))}
              </div>
              <div className="text-center border-t border-gray-100 pt-3">
                <span className="text-sm font-medium text-tea-600">이 취향의 상품 보기 &rarr;</span>
              </div>
            </Link>
          ))}

          {/* 16가지 전체 점수 */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
            <p className="font-bold text-gray-900 mb-3 text-sm">16가지 향미 프로필</p>
            <div className="space-y-1.5">
              {Object.entries(result.scores).sort((a, b) => b[1] - a[1]).filter(([, v]) => v > 0).map(([code, score]) => {
                const info = TYPE_INFO[code as Code];
                const maxScore = Math.max(...Object.values(result.scores));
                return (
                  <div key={code} className="flex items-center gap-2 text-xs">
                    <span className="w-6 text-[9px] font-bold text-gray-400">{code}</span>
                    <span className="w-14 text-gray-600 truncate">{info?.name?.split(' ')[0]}</span>
                    <div className="flex-1 h-3 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full bg-tea-400 rounded-full transition-all" style={{ width: `${(score / maxScore) * 100}%` }} />
                    </div>
                    <span className="w-8 text-right text-gray-400">{Math.round(score)}</span>
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
                      <p className="text-xs text-gray-400">{p.store.name}</p>
                      <span className="text-sm font-bold text-gray-900">{p.price.toLocaleString()}원</span>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}

          <div className="flex gap-3">
            <button onClick={restart} className="flex-1 py-3 border border-gray-200 rounded-2xl text-sm font-medium text-gray-600 hover:bg-gray-50">다시 테스트</button>
            <Link href="/" className="flex-1 py-3 bg-tea-600 text-white rounded-2xl text-sm font-medium text-center hover:bg-tea-700">쇼핑하러 가기</Link>
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
