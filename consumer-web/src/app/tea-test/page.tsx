'use client';

import Link from 'next/link';
import NavBar from '@/components/NavBar';
import { useAuthStore } from '@/store/authStore';

export default function TeaTestSelectPage() {
  const { consumer } = useAuthStore();

  return (
    <div className="min-h-screen bg-gradient-to-b from-tea-50 to-cream-50">
      <NavBar title="차 취향 검사" back={true} />

      <div className="max-w-md mx-auto px-4 py-10">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-tea-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-tea-700 font-bold text-xl">Tea</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">나의 차 취향</h1>
          <p className="text-gray-500 text-sm">나만의 차 취향을 알아보고 맞춤 상품을 추천받으세요</p>
          {consumer?.teaProfile && (
            <div className="mt-3 inline-flex items-center gap-2 bg-tea-50 border border-tea-200 rounded-full px-4 py-1.5">
              <span className="text-xs text-tea-600">현재 프로필:</span>
              <span className="text-sm font-bold text-tea-700">{consumer.teaProfile}</span>
            </div>
          )}
        </div>

        <div className="space-y-4">
          {/* 간단 테스트 */}
          <Link href="/tea-test/quick"
            className="block bg-white rounded-2xl border border-gray-100 p-6 hover:border-tea-300 hover:shadow-md transition-all group">
            <div className="flex items-start justify-between mb-3">
              <div>
                <h2 className="text-lg font-bold text-gray-900 group-hover:text-tea-700 transition-colors">간단 테스트</h2>
                <p className="text-sm text-gray-500 mt-1">20문항으로 빠르게 알아보는 나의 차 취향</p>
              </div>
              <span className="text-xs bg-tea-50 text-tea-700 px-2.5 py-1 rounded-full font-medium shrink-0">3분</span>
            </div>
            <div className="flex items-center gap-3 text-xs text-gray-400">
              <span>20문항</span>
              <span>|</span>
              <span>기본 향미 유형 분석</span>
              <span>|</span>
              <span>Top 3 유형</span>
            </div>
            <div className="mt-4 text-right">
              <span className="text-sm font-medium text-tea-600 group-hover:text-tea-700">시작하기 &rarr;</span>
            </div>
          </Link>

          {/* 상세 테스트 */}
          <Link href="/tea-test/detailed"
            className="block bg-white rounded-2xl border-2 border-tea-200 p-6 hover:border-tea-400 hover:shadow-md transition-all group relative overflow-hidden">
            <div className="absolute top-0 right-0 bg-tea-600 text-white text-[10px] font-bold px-3 py-1 rounded-bl-lg">PREMIUM</div>
            <div className="flex items-start justify-between mb-3">
              <div>
                <h2 className="text-lg font-bold text-gray-900 group-hover:text-tea-700 transition-colors">상세 테스트</h2>
                <p className="text-sm text-gray-500 mt-1">40문항으로 정밀 분석하는 티 소믈리에급 진단</p>
              </div>
              <span className="text-xs bg-amber-50 text-amber-700 px-2.5 py-1 rounded-full font-medium shrink-0">7분</span>
            </div>
            <div className="flex items-center gap-3 text-xs text-gray-400">
              <span>40문항</span>
              <span>|</span>
              <span>16가지 정밀 분석</span>
              <span>|</span>
              <span>쓴맛/복합성 지수</span>
            </div>
            <ul className="mt-3 text-xs text-gray-500 space-y-1">
              <li>- 향 취향, 맛 취향, 음식 취향, 감각 성향, 티 고급 취향 5파트</li>
              <li>- 쓴맛 허용 지수, 복합향 선호 지수 별도 산출</li>
              <li>- 16개 유형 전체 점수 차트 제공</li>
            </ul>
            <div className="mt-4 text-right">
              <span className="text-sm font-medium text-tea-600 group-hover:text-tea-700">시작하기 &rarr;</span>
            </div>
          </Link>
        </div>

        {consumer && !consumer.teaProfile && (
          <p className="text-center text-xs text-gray-400 mt-6">
            테스트 결과는 자동으로 저장되어 맞춤 상품을 추천받을 수 있습니다
          </p>
        )}
      </div>
    </div>
  );
}
