'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import api, { analyticsApi, storeApi } from '@/lib/api';
import { Settlement } from '@/types';
import {
  Wallet, ChevronLeft, ChevronRight, CheckCircle, Clock, Download,
  CalendarDays, Calculator, BookOpen, ExternalLink, AlertTriangle,
  TrendingUp, Receipt, FileText, BadgeCheck, Info, ChevronDown, ChevronUp,
} from 'lucide-react';
import { format, isAfter, differenceInDays } from 'date-fns';
import { ko } from 'date-fns/locale';
import { clsx } from 'clsx';
import { useAuthStore } from '@/store/authStore';

// ─── 세금 캘린더 데이터 ─────────────────────────────────────────────────────
const TAX_EVENTS = [
  // 부가가치세
  { id: 'vat-q1',   date: '2026-01-25', title: '부가가치세 확정신고', type: 'vat',    detail: '전년도 2기(7~12월) 확정신고 및 납부', target: '일반과세자', link: 'https://hometax.go.kr' },
  { id: 'vat-q2',   date: '2026-04-25', title: '부가가치세 예정신고', type: 'vat',    detail: '1기(1~3월) 예정신고 및 납부', target: '일반과세자', link: 'https://hometax.go.kr' },
  { id: 'vat-q3',   date: '2026-07-25', title: '부가가치세 확정신고', type: 'vat',    detail: '1기(1~6월) 확정신고 및 납부', target: '일반과세자', link: 'https://hometax.go.kr' },
  { id: 'vat-q4',   date: '2026-10-25', title: '부가가치세 예정신고', type: 'vat',    detail: '2기(7~9월) 예정신고 및 납부', target: '일반과세자', link: 'https://hometax.go.kr' },
  { id: 'vat-simp', date: '2027-01-25', title: '부가가치세 확정신고 (간이)', type: 'vat', detail: '간이과세자 연 1회 신고 및 납부', target: '간이과세자', link: 'https://hometax.go.kr' },
  // 종합소득세
  { id: 'income',   date: '2026-05-31', title: '종합소득세 신고', type: 'income', detail: '전년도 사업소득 포함 종합소득세 신고 및 납부', target: '개인사업자 전체', link: 'https://hometax.go.kr' },
  { id: 'income-27',date: '2027-05-31', title: '종합소득세 신고', type: 'income', detail: '전년도 사업소득 포함 종합소득세 신고 및 납부', target: '개인사업자 전체', link: 'https://hometax.go.kr' },
  // 원천세
  { id: 'withhold', date: '2026-07-10', title: '원천세 반기 신고', type: 'withhold', detail: '상반기(1~6월) 원천세 반기납부 신청자', target: '직원 있는 사업자', link: 'https://hometax.go.kr' },
  { id: 'withhold2',date: '2027-01-10', title: '원천세 반기 신고', type: 'withhold', detail: '하반기(7~12월) 원천세 반기납부 신청자', target: '직원 있는 사업자', link: 'https://hometax.go.kr' },
  // 사업장현황신고
  { id: 'status',   date: '2027-02-10', title: '사업장현황신고', type: 'report',  detail: '면세사업자 매출 현황 신고', target: '면세사업자', link: 'https://hometax.go.kr' },
];

// 종합소득세 세율 구간 (2024년 기준)
const INCOME_TAX_BRACKETS = [
  { min: 0,        max: 14000000,   rate: 0.06, deduction: 0 },
  { min: 14000000, max: 50000000,   rate: 0.15, deduction: 1260000 },
  { min: 50000000, max: 88000000,   rate: 0.24, deduction: 5760000 },
  { min: 88000000, max: 150000000,  rate: 0.35, deduction: 15440000 },
  { min: 150000000,max: 300000000,  rate: 0.38, deduction: 19940000 },
  { min: 300000000,max: 500000000,  rate: 0.40, deduction: 25940000 },
  { min: 500000000,max: 1000000000, rate: 0.42, deduction: 35940000 },
  { min: 1000000000,max: Infinity,  rate: 0.45, deduction: 65940000 },
];

function calcIncomeTax(income: number) {
  const bracket = INCOME_TAX_BRACKETS.find((b) => income >= b.min && income < b.max)
    || INCOME_TAX_BRACKETS[INCOME_TAX_BRACKETS.length - 1];
  return Math.max(0, income * bracket.rate - bracket.deduction);
}

const TYPE_STYLES: Record<string, { color: string; bg: string; label: string }> = {
  vat:      { color: 'text-blue-700',   bg: 'bg-blue-50 border-blue-200',   label: '부가가치세' },
  income:   { color: 'text-purple-700', bg: 'bg-purple-50 border-purple-200', label: '종합소득세' },
  withhold: { color: 'text-orange-700', bg: 'bg-orange-50 border-orange-200', label: '원천세' },
  report:   { color: 'text-gray-700',   bg: 'bg-gray-50 border-gray-200',   label: '현황신고' },
};

type Tab = 'settlement' | 'tax-calendar' | 'tax-calc' | 'guide';

export default function SettlementPage() {
  const [page, setPage] = useState(1);
  const [tab, setTab] = useState<Tab>('settlement');
  const [taxType, setTaxType] = useState<'general' | 'simplified'>('general');
  const [expenseRate, setExpenseRate] = useState(30);
  const [openGuide, setOpenGuide] = useState<string | null>(null);
  const now = new Date();
  const [selectedPeriods, setSelectedPeriods] = useState<string[]>([`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`]);
  const { seller } = useAuthStore();

  const { data, isLoading } = useQuery({
    queryKey: ['settlements', page],
    queryFn: () => analyticsApi.getSettlements({ page, limit: 12 }).then((r) => r.data),
  });

  const { data: dashboardData } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: () => analyticsApi.getDashboard().then((r) => r.data.data),
  });

  const { data: siteSettings } = useQuery({
    queryKey: ['site-settings'],
    queryFn: () => api.get('/api/public/point-setting').then((r) => r.data.data),
  });

  const settlements: Settlement[] = data?.data || [];
  const pagination = data?.pagination;

  const formatKRW = (n: number) => `${Math.round(n).toLocaleString()}원`;

  const excelMonths = Array.from({ length: 12 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });

  const togglePeriod = (m: string) => {
    setSelectedPeriods(prev =>
      prev.includes(m) ? prev.filter(p => p !== m) : [...prev, m].sort()
    );
  };

  const filteredSettlements = selectedPeriods.length === 0
    ? settlements
    : settlements.filter(s => selectedPeriods.includes(s.period));

  const handleExcelDownload = async () => {
    if (selectedPeriods.length === 0) { alert('다운로드할 월을 선택해주세요.'); return; }
    try {
      const allRows: any[] = [];

      for (const period of [...selectedPeriods].sort()) {
        const res = await storeApi.getSettlementDetail(period);
        const { rows } = res.data.data;
        for (const r of rows) allRows.push({ ...r, period });
      }

      // 정산 요약 계산
      const periodSettlements = settlements.filter(s => selectedPeriods.includes(s.period));
      const summaryTotalSales = periodSettlements.reduce((s, v) => s + v.totalSales, 0);
      const summaryPending = periodSettlements.filter(s => s.status === 'PENDING').reduce((s, v) => s + v.netAmount, 0);
      const summaryPaid = periodSettlements.filter(s => s.status === 'PAID').reduce((s, v) => s + v.netAmount, 0);

      const BOM = '﻿';
      const csvRows: string[] = [];

      // 요약 헤더
      csvRows.push(['[정산 요약]'].join(','));
      csvRows.push(['항목', '금액'].join(','));
      csvRows.push(['"총 판매금액"', summaryTotalSales].join(','));
      csvRows.push(['"정산 예정 금액"', summaryPending].join(','));
      csvRows.push(['"입금 완료 금액"', summaryPaid].join(','));
      csvRows.push('');

      // 데이터 헤더
      const headers = [
        '공급처', '상품명', '카테고리', '수취인', '상태', '주문날짜',
        '도매공급가', '도매배송비', '마켓택배비', '소비자배송비', '마켓할인',
        '마진률(%)', '마진금액', '정산가', '주문가', '순수익',
      ];
      csvRows.push(headers.join(','));

      const sums = { wholesalePrice: 0, wholesaleShipping: 0, marketShippingCost: 0, consumerShippingFee: 0, marketDiscount: 0, marginAmount: 0, settlementPrice: 0, orderPrice: 0, netProfit: 0 };

      for (const r of allRows) {
        sums.wholesalePrice += r.wholesalePrice || 0;
        sums.wholesaleShipping += r.wholesaleShipping || 0;
        sums.marketShippingCost += r.marketShippingCost || 0;
        sums.consumerShippingFee += r.consumerShippingFee || 0;
        sums.marketDiscount += r.marketDiscount || 0;
        sums.marginAmount += r.marginAmount || 0;
        sums.settlementPrice += r.settlementPrice || 0;
        sums.orderPrice += r.orderPrice || 0;
        sums.netProfit += r.netProfit || 0;

        csvRows.push([
          `"${(r.wholesaleSupplier || '').replace(/"/g, '""')}"`,
          `"${(r.productName || '').replace(/"/g, '""')}"`,
          `"${(r.category || '').replace(/"/g, '""')}"`,
          `"${(r.recipient || '').replace(/"/g, '""')}"`,
          r.status,
          new Date(r.orderDate).toLocaleDateString('ko-KR'),
          r.wholesalePrice ?? '',
          r.wholesaleShipping ?? '',
          r.marketShippingCost ?? '',
          r.consumerShippingFee ?? 0,
          r.marketDiscount || '',
          r.marginRate != null ? `${r.marginRate}%` : '',
          r.marginAmount ?? '',
          r.settlementPrice,
          r.orderPrice,
          r.netProfit ?? '',
        ].join(','));
      }

      csvRows.push([
        '"합계"', '', '', '', '', '',
        sums.wholesalePrice, sums.wholesaleShipping, sums.marketShippingCost, sums.consumerShippingFee, sums.marketDiscount,
        '', sums.marginAmount, sums.settlementPrice, sums.orderPrice, sums.netProfit,
      ].join(','));
      csvRows.push('');
      csvRows.push(['"총 판매금액"', sums.orderPrice].join(','));
      csvRows.push(['"총 순수익금"', sums.netProfit].join(','));

      const fileName = selectedPeriods.length === 1
        ? `정산내역_${selectedPeriods[0]}.csv`
        : `정산내역_${selectedPeriods[0]}_${selectedPeriods[selectedPeriods.length - 1]}.csv`;

      const blob = new Blob([BOM + csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      alert('정산 상세 데이터를 불러올 수 없습니다.');
    }
  };

  const totalSettled = settlements.filter((s) => s.status === 'PAID').reduce((sum, s) => sum + s.netAmount, 0);
  const totalPending = settlements.filter((s) => s.status === 'PENDING').reduce((sum, s) => sum + s.netAmount, 0);
  const annualRevenue = settlements.reduce((sum, s) => sum + s.totalSales, 0);

  // ─── 세금 계산 ────────────────────────────────────────────────────────────
  const vatBase = annualRevenue;
  const estimatedVAT = taxType === 'general'
    ? vatBase * 0.1
    : vatBase * 0.03;  // 간이과세자 평균 3%

  const netIncome = annualRevenue * (1 - expenseRate / 100);
  const estimatedIncomeTax = calcIncomeTax(netIncome);
  const localIncomeTax = estimatedIncomeTax * 0.1;

  // ─── 세금 캘린더 ──────────────────────────────────────────────────────────
  const today = new Date('2026-06-08');
  const upcomingEvents = TAX_EVENTS
    .map((e) => ({ ...e, dateObj: new Date(e.date) }))
    .filter((e) => isAfter(e.dateObj, today) || differenceInDays(e.dateObj, today) >= -7)
    .sort((a, b) => a.dateObj.getTime() - b.dateObj.getTime())
    .slice(0, 8);

  const TABS: { id: Tab; label: string; icon: any }[] = [
    { id: 'settlement',   label: '정산 내역',    icon: Wallet },
    { id: 'tax-calendar', label: '세금 캘린더',  icon: CalendarDays },
    { id: 'tax-calc',     label: '세금 계산',    icon: Calculator },
    { id: 'guide',        label: '사업자 가이드', icon: BookOpen },
  ];

  const GUIDES = [
    {
      id: 'vat',
      title: '부가가치세 (VAT) 신고 가이드',

      summary: '매출의 10%를 납부하는 소비세. 일반과세자는 분기별, 간이과세자는 연 1회 신고.',
      content: [
        { label: '일반과세자 기준', text: '연 매출 8,000만원 이상 (또는 자진 등록)' },
        { label: '간이과세자 기준', text: '연 매출 8,000만원 미만 (일부 업종 제외)' },
        { label: '신고 방법', text: '홈택스(hometax.go.kr) → 신고/납부 → 부가가치세' },
        { label: '필요 서류', text: '매출·매입 세금계산서, 신용카드·현금영수증 자료' },
        { label: '플랫폼 매출 반영', text: '차 쇼핑몰 매출은 전자세금계산서 또는 카드매출로 자동 집계됩니다.' },
      ],
      link: 'https://www.nts.go.kr',
    },
    {
      id: 'income',
      title: '종합소득세 신고 가이드',

      summary: '사업소득, 금융소득 등을 합산해 다음 해 5월에 신고하는 세금.',
      content: [
        { label: '신고 기간', text: '매년 5월 1일 ~ 5월 31일 (성실신고확인대상자는 6월 30일)' },
        { label: '세율', text: '6% ~ 45% 누진세율 (과세표준 구간별 적용)' },
        { label: '필요경비', text: '재료비, 포장비, 배송비, 광고비, 임대료 등 사업 관련 지출' },
        { label: '단순경비율/기준경비율', text: '장부를 작성하지 않는 경우 업종별 경비율로 간편 신고 가능' },
        { label: '전자신고 혜택', text: '홈택스 전자신고 시 2만원 세액공제' },
      ],
      link: 'https://www.nts.go.kr',
    },
    {
      id: 'receipt',
      title: '현금영수증 의무 발행',

      summary: '소비자가 요청하지 않아도 건당 10만원 이상 거래 시 자동 발행 의무.',
      content: [
        { label: '의무 발행 기준', text: '현금 거래 건당 10만원 이상 (소비자 미요청도 발행)' },
        { label: '미발행 제재', text: '미발행 금액의 20% 가산세' },
        { label: '온라인 쇼핑몰', text: '신용카드·계좌이체 거래는 자동 처리, 현금 거래 시에만 별도 발행' },
        { label: '발행 방법', text: '국세청 현금영수증 가맹점 가입 후 홈택스 또는 결제 시스템 통해 발행' },
      ],
      link: 'https://www.nts.go.kr',
    },
    {
      id: 'expense',
      title: '필요경비 처리 항목',

      summary: '매출에서 차감 가능한 사업 관련 비용. 많을수록 종소세가 줄어듭니다.',
      content: [
        { label: '상품 매입비', text: '원재료비, 포장재, 용기 등 직접 비용' },
        { label: '택배·배송비', text: '주문 배송에 실제 소요된 비용 전액' },
        { label: '플랫폼 수수료', text: '차 쇼핑몰 플랫폼 수수료, PG 결제 수수료 포함' },
        { label: '광고·마케팅비', text: 'SNS 광고, 네이버·쿠팡 광고비 등' },
        { label: '사무·통신비', text: '업무용 휴대폰 요금, 인터넷 요금 등 (50% 경비 인정)' },
        { label: '증빙 주의', text: '세금계산서·카드영수증·현금영수증 반드시 보관 (5년)' },
      ],
      link: 'https://www.nts.go.kr',
    },
    {
      id: 'checklist',
      title: '연간 세무 체크리스트',

      summary: '사업자가 놓치기 쉬운 세무 의무 항목을 확인하세요.',
      content: [
        { label: '사업자등록증 업태/종목', text: '실제 판매 품목과 일치하는지 확인 (불일치 시 가산세 위험)' },
        { label: '과세 유형 확인', text: '간이과세자 → 일반과세자 전환 기준(연 8,000만원) 초과 여부 체크' },
        { label: '홈택스 전자고지 신청', text: '납부 안내 문자/이메일 수신 설정으로 신고 누락 방지' },
        { label: '세금계산서 수취', text: '매입 거래처로부터 세금계산서 제때 수취 (부가세 공제 위해)' },
        { label: '장부 기장', text: '복식부기의무자 여부 확인, 필요 시 세무대리인 선임 검토' },
      ],
      link: null,
    },
  ];

  return (
    <div className="space-y-5 animate-fade-in">
      {/* 헤더 */}
      <div>
        <h1 className="text-xl font-bold text-gray-900">정산 · 세무 관리</h1>
        <p className="text-gray-500 text-sm mt-0.5">정산 내역 확인과 사업자 세금 신고를 한 곳에서 관리하세요</p>
      </div>

      {/* 요약 카드 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="stat-card border-l-4 border-tea-500">
          <div className="flex items-center gap-1.5 mb-1">
            <TrendingUp size={14} className="text-tea-600" />
            <span className="text-xs font-medium text-gray-500">이번달 매출</span>
          </div>
          <p className="text-xl font-bold text-gray-900">{formatKRW(dashboardData?.month?.sales || 0)}</p>
          <p className="text-xs text-gray-400 mt-0.5">{dashboardData?.month?.orders || 0}건</p>
        </div>
        <div className="stat-card border-l-4 border-amber-400">
          <div className="flex items-center gap-1.5 mb-1">
            <Clock size={14} className="text-amber-600" />
            <span className="text-xs font-medium text-gray-500">정산 예정</span>
          </div>
          <p className="text-xl font-bold text-gray-900">{formatKRW(totalPending)}</p>
          <p className="text-xs text-gray-400 mt-0.5">익월 10일 지급</p>
        </div>
        <div className="stat-card border-l-4 border-emerald-400">
          <div className="flex items-center gap-1.5 mb-1">
            <CheckCircle size={14} className="text-emerald-600" />
            <span className="text-xs font-medium text-gray-500">누적 정산</span>
          </div>
          <p className="text-xl font-bold text-gray-900">{formatKRW(totalSettled)}</p>
          <p className="text-xs text-gray-400 mt-0.5">정산 완료 합계</p>
        </div>
        <div className="stat-card border-l-4 border-blue-400">
          <div className="flex items-center gap-1.5 mb-1">
            <Receipt size={14} className="text-blue-600" />
            <span className="text-xs font-medium text-gray-500">연간 매출 합계</span>
          </div>
          <p className="text-xl font-bold text-gray-900">{formatKRW(annualRevenue)}</p>
          <p className="text-xs text-gray-400 mt-0.5">부가세 신고 기준</p>
        </div>
      </div>

      {/* 탭 */}
      <div className="border-b border-gray-200">
        <div className="flex gap-1">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={clsx(
                'flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap',
                tab === t.id
                  ? 'border-tea-600 text-tea-700'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              )}
            >
              <t.icon size={15} />
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── 정산 내역 탭 ── */}
      {tab === 'settlement' && (
        <div className="space-y-4">
          <div className="bg-tea-50 border border-tea-200 rounded-xl p-4 text-sm text-tea-800">
            <p className="font-semibold mb-1">정산 안내</p>
            {siteSettings?.settlementNotice ? (
              <div className="text-xs text-tea-700 whitespace-pre-line">{siteSettings.settlementNotice}</div>
            ) : (
              <ul className="text-xs text-tea-700 space-y-1 list-disc list-inside">
                <li>정산은 매월 말일 기준으로 익월 10일에 지급됩니다.</li>
                <li>플랫폼 수수료: {siteSettings?.platformFeeRate ?? 3.5}% | 결제 수수료: {siteSettings?.paymentFeeRate ?? 2}%</li>
                <li>정산 문의: 고객센터 1588-0000 (평일 9:00~18:00)</li>
              </ul>
            )}
          </div>

          <div className="card p-0 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="font-semibold text-gray-900">정산 내역</h2>
                  <p className="text-xs text-gray-400 mt-0.5">기간을 선택하면 해당 월 정산만 표시됩니다</p>
                </div>
                <button
                  onClick={handleExcelDownload}
                  disabled={selectedPeriods.length === 0}
                  className={clsx(
                    'flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold border transition-all',
                    selectedPeriods.length > 0
                      ? 'bg-tea-600 text-white border-tea-600 hover:bg-tea-700'
                      : 'bg-gray-50 text-gray-300 border-gray-200 cursor-not-allowed'
                  )}
                >
                  <Download size={13} />
                  엑셀 다운로드
                  {selectedPeriods.length > 0 && (
                    <span className="bg-white/30 text-white text-xs px-1.5 py-0.5 rounded-full font-bold leading-none">
                      {selectedPeriods.length}
                    </span>
                  )}
                </button>
              </div>

              {/* 기간 선택 */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-gray-500">기간 선택 (클릭하면 해당 월만 표시)</span>
                  <div className="flex gap-1.5">
                    <button
                      onClick={() => setSelectedPeriods(excelMonths)}
                      className="text-xs px-2.5 py-1 rounded-md border border-gray-200 text-gray-500 hover:bg-gray-50 hover:border-gray-300 transition-colors"
                    >
                      전체 선택
                    </button>
                    <button
                      onClick={() => setSelectedPeriods([])}
                      className="text-xs px-2.5 py-1 rounded-md border border-gray-200 text-gray-500 hover:bg-gray-50 hover:border-gray-300 transition-colors"
                    >
                      전체 보기
                    </button>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {excelMonths.map(m => {
                    const isSelected = selectedPeriods.includes(m);
                    const settlement = settlements.find(s => s.period === m);
                    return (
                      <button
                        key={m}
                        onClick={() => togglePeriod(m)}
                        className={clsx(
                          'flex flex-col items-center px-3 py-2 rounded-xl border-2 text-xs font-medium transition-all min-w-[56px]',
                          isSelected
                            ? 'bg-tea-600 text-white border-tea-600 shadow-sm'
                            : 'bg-white text-gray-600 border-gray-200 hover:border-tea-300 hover:text-tea-700'
                        )}
                      >
                        <span className={clsx('font-bold text-[11px]', isSelected ? 'text-white/70' : 'text-gray-400')}>
                          {m.split('-')[0].slice(2)}년
                        </span>
                        <span className="font-bold text-sm leading-tight">{m.split('-')[1]}월</span>
                        {settlement && (
                          <span className={clsx('mt-0.5 text-[10px] font-medium', isSelected ? 'text-white/80' : settlement.status === 'PAID' ? 'text-emerald-500' : 'text-amber-500')}>
                            {settlement.status === 'PAID' ? '완료' : '예정'}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 선택된 기간 정산 합계 */}
              {selectedPeriods.length > 0 && filteredSettlements.length > 0 && (
                <div className="flex gap-3 p-3 bg-tea-50 rounded-xl border border-tea-100">
                  <div className="flex-1 text-center">
                    <p className="text-xs text-tea-600 font-medium">선택 기간 매출</p>
                    <p className="text-sm font-bold text-gray-900">{formatKRW(filteredSettlements.reduce((s, v) => s + v.totalSales, 0))}</p>
                  </div>
                  <div className="w-px bg-tea-200" />
                  <div className="flex-1 text-center">
                    <p className="text-xs text-tea-600 font-medium">정산 금액 합계</p>
                    <p className="text-sm font-bold text-tea-700">{formatKRW(filteredSettlements.reduce((s, v) => s + v.netAmount, 0))}</p>
                  </div>
                  <div className="w-px bg-tea-200" />
                  <div className="flex-1 text-center">
                    <p className="text-xs text-tea-600 font-medium">수수료 합계</p>
                    <p className="text-sm font-bold text-red-500">-{formatKRW(filteredSettlements.reduce((s, v) => s + v.platformFee + v.paymentFee, 0))}</p>
                  </div>
                </div>
              )}
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100">
                    {['정산 기간', '총 매출', '플랫폼 수수료', '결제 수수료', '정산 금액', '상태', '정산일'].map((h, i) => (
                      <th key={h} className={clsx('px-5 py-3 text-xs font-semibold text-gray-500 uppercase', i === 0 ? 'text-left' : i < 5 ? 'text-right' : 'text-center')}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {isLoading ? (
                    Array.from({ length: 6 }).map((_, i) => (
                      <tr key={i} className="animate-pulse">
                        {Array.from({ length: 7 }).map((_, j) => (
                          <td key={j} className="px-5 py-4"><div className="h-4 bg-gray-100 rounded" /></td>
                        ))}
                      </tr>
                    ))
                  ) : filteredSettlements.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="text-center py-16">
                        <Wallet size={40} className="mx-auto text-gray-200 mb-3" />
                        <p className="text-gray-400 text-sm">
                          {selectedPeriods.length > 0 ? '선택한 기간의 정산 내역이 없습니다' : '정산 내역이 없습니다'}
                        </p>
                      </td>
                    </tr>
                  ) : (
                    filteredSettlements.map((s) => (
                      <tr key={s.id} className="hover:bg-gray-50/50 transition-colors">
                        <td className="px-5 py-4 text-sm font-medium text-gray-900">{s.period}</td>
                        <td className="px-5 py-4 text-sm text-right text-gray-700">{formatKRW(s.totalSales)}</td>
                        <td className="px-5 py-4 text-sm text-right text-red-500">-{formatKRW(s.platformFee)}</td>
                        <td className="px-5 py-4 text-sm text-right text-red-500">-{formatKRW(s.paymentFee)}</td>
                        <td className="px-5 py-4 text-sm text-right font-bold text-gray-900">{formatKRW(s.netAmount)}</td>
                        <td className="px-5 py-4 text-center">
                          <span className={clsx('text-xs px-2.5 py-1 rounded-full font-medium',
                            s.status === 'PAID' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700')}>
                            {s.status === 'PAID' ? '정산완료' : '정산예정'}
                          </span>
                        </td>
                        <td className="px-5 py-4 text-center text-sm text-gray-500">
                          {s.settledAt ? format(new Date(s.settledAt), 'MM/dd', { locale: ko }) : '-'}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            {pagination && pagination.totalPages > 1 && (
              <div className="flex items-center justify-between px-5 py-4 border-t border-gray-100">
                <span className="text-sm text-gray-500">{pagination.total}건</span>
                <div className="flex gap-2">
                  <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}
                    className="p-2 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-40">
                    <ChevronLeft size={16} />
                  </button>
                  <span className="text-sm text-gray-600 flex items-center px-2">{page} / {pagination.totalPages}</span>
                  <button onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))} disabled={page === pagination.totalPages}
                    className="p-2 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-40">
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── 세금 캘린더 탭 ── */}
      {tab === 'tax-calendar' && (
        <div className="space-y-4">
          <div className="card space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-gray-900">다가오는 세금 신고 일정</h2>
              <span className="text-xs text-gray-400">기준일: {format(today, 'yyyy.MM.dd')}</span>
            </div>

            <div className="space-y-3">
              {upcomingEvents.map((event) => {
                const daysLeft = differenceInDays(event.dateObj, today);
                const isUrgent = daysLeft <= 14 && daysLeft >= 0;
                const isPast = daysLeft < 0;
                const style = TYPE_STYLES[event.type];
                return (
                  <div key={event.id} className={clsx(
                    'flex items-start gap-4 p-4 rounded-xl border transition-all',
                    isUrgent ? 'border-red-200 bg-red-50' : isPast ? 'border-gray-100 bg-gray-50 opacity-60' : `${style.bg}`
                  )}>
                    <div className="text-center shrink-0 w-12">
                      <p className="text-xs font-medium text-gray-500">{format(event.dateObj, 'M월', { locale: ko })}</p>
                      <p className={clsx('text-2xl font-bold leading-tight', isUrgent ? 'text-red-600' : style.color)}>
                        {format(event.dateObj, 'd')}
                      </p>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className={clsx('text-xs font-semibold px-2 py-0.5 rounded-full', style.bg, style.color)}>
                          {style.label}
                        </span>
                        {isUrgent && (
                          <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-red-100 text-red-600 flex items-center gap-1">
                            <AlertTriangle size={10} /> D-{daysLeft}
                          </span>
                        )}
                        <span className="text-xs text-gray-400">{event.target}</span>
                      </div>
                      <p className="text-sm font-semibold text-gray-900">{event.title}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{event.detail}</p>
                    </div>
                    <a href={event.link} target="_blank" rel="noopener noreferrer"
                      className="shrink-0 flex items-center gap-1 text-xs text-tea-600 hover:text-tea-800 font-medium px-2 py-1 rounded-lg hover:bg-white/80 transition-colors">
                      홈택스 <ExternalLink size={11} />
                    </a>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 유형별 설명 */}
          <div className="grid grid-cols-2 gap-3">
            {Object.entries(TYPE_STYLES).map(([key, style]) => (
              <div key={key} className={clsx('p-4 rounded-xl border', style.bg)}>
                <p className={clsx('text-sm font-semibold mb-1', style.color)}>{style.label}</p>
                <p className="text-xs text-gray-600">
                  {key === 'vat' && '사업자가 소비자 대신 납부하는 세금. 매출세액에서 매입세액을 뺀 금액을 납부합니다.'}
                  {key === 'income' && '사업소득을 포함한 모든 소득을 합산해 신고. 개인사업자라면 5월에 반드시 신고해야 합니다.'}
                  {key === 'withhold' && '직원 급여를 지급할 때 원천징수한 세금을 신고·납부합니다.'}
                  {key === 'report' && '면세 매출이 있는 사업자는 별도로 현황을 신고해야 합니다.'}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── 세금 계산 탭 ── */}
      {tab === 'tax-calc' && (
        <div className="space-y-4">
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex gap-2 text-sm text-amber-800">
            <Info size={16} className="shrink-0 mt-0.5" />
            <p>아래 계산은 <strong>참고용 예상치</strong>입니다. 정확한 세액은 세무사 또는 국세청 홈택스를 통해 확인하세요.</p>
          </div>

          {/* 과세 유형 선택 */}
          <div className="card space-y-4">
            <h2 className="font-semibold text-gray-900">과세 유형 선택</h2>
            <div className="grid grid-cols-2 gap-3">
              {[
                { value: 'general', label: '일반과세자', desc: '연 매출 8,000만원 이상 또는 자진 등록', badge: '부가세 10%' },
                { value: 'simplified', label: '간이과세자', desc: '연 매출 8,000만원 미만 (일부 업종 제외)', badge: '부가세 1.5~4%' },
              ].map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setTaxType(opt.value as any)}
                  className={clsx(
                    'flex flex-col gap-1.5 p-4 rounded-xl border-2 text-left transition-all',
                    taxType === opt.value ? 'border-tea-500 bg-tea-50' : 'border-gray-200 hover:border-tea-300'
                  )}
                >
                  <div className="flex items-center justify-between">
                    <p className={clsx('text-sm font-semibold', taxType === opt.value ? 'text-tea-700' : 'text-gray-800')}>{opt.label}</p>
                    <span className={clsx('text-xs px-2 py-0.5 rounded-full font-medium', taxType === opt.value ? 'bg-tea-200 text-tea-800' : 'bg-gray-100 text-gray-600')}>
                      {opt.badge}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500">{opt.desc}</p>
                </button>
              ))}
            </div>
          </div>

          {/* 부가가치세 계산 */}
          <div className="card space-y-4">
            <div className="flex items-center gap-2">
              <Receipt size={18} className="text-blue-600" />
              <h2 className="font-semibold text-gray-900">부가가치세 예상</h2>
            </div>
            <div className="space-y-3">
              <div className="flex justify-between items-center py-2 border-b border-gray-100">
                <span className="text-sm text-gray-600">연간 총 매출 (과세표준)</span>
                <span className="text-sm font-semibold text-gray-900">{formatKRW(vatBase)}</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-gray-100">
                <span className="text-sm text-gray-600">
                  적용 세율 {taxType === 'general' ? '(일반과세자 10%)' : '(간이과세자 평균 3%)'}
                </span>
                <span className="text-sm text-gray-600">{taxType === 'general' ? '10%' : '약 3%'}</span>
              </div>
              <div className="flex justify-between items-center py-3 bg-blue-50 rounded-xl px-4">
                <span className="text-sm font-semibold text-blue-800">예상 부가가치세</span>
                <span className="text-lg font-bold text-blue-700">{formatKRW(estimatedVAT)}</span>
              </div>
              {taxType === 'general' && (
                <p className="text-xs text-gray-400">※ 매입 세금계산서 수취 시 매입세액 공제로 실제 납부액이 줄어듭니다.</p>
              )}
              {taxType === 'simplified' && (
                <p className="text-xs text-gray-400">※ 간이과세자는 업종별 부가가치율(15~40%)에 10%를 곱한 세액을 납부합니다. 식료품 유통은 약 15%.</p>
              )}
            </div>
          </div>

          {/* 종합소득세 계산 */}
          <div className="card space-y-4">
            <div className="flex items-center gap-2">
              <FileText size={18} className="text-purple-600" />
              <h2 className="font-semibold text-gray-900">종합소득세 예상</h2>
            </div>

            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="text-sm text-gray-700">필요경비 비율</label>
                <span className="text-sm font-semibold text-gray-900">{expenseRate}%</span>
              </div>
              <input
                type="range" min={10} max={70} step={5}
                value={expenseRate}
                onChange={(e) => setExpenseRate(Number(e.target.value))}
                className="w-full accent-tea-600"
              />
              <div className="flex justify-between text-xs text-gray-400 mt-1">
                <span>10% (경비 적음)</span><span>40% (일반적)</span><span>70% (경비 많음)</span>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between items-center py-2 border-b border-gray-100">
                <span className="text-sm text-gray-600">연간 총 매출</span>
                <span className="text-sm text-gray-900">{formatKRW(annualRevenue)}</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-gray-100">
                <span className="text-sm text-gray-600">필요경비 (-{expenseRate}%)</span>
                <span className="text-sm text-red-500">-{formatKRW(annualRevenue * expenseRate / 100)}</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-gray-100">
                <span className="text-sm text-gray-600">사업소득 (과세표준 추정)</span>
                <span className="text-sm font-medium text-gray-900">{formatKRW(netIncome)}</span>
              </div>
              {/* 세율 구간 표시 */}
              <div className="py-2 border-b border-gray-100">
                {(() => {
                  const bracket = INCOME_TAX_BRACKETS.find((b) => netIncome >= b.min && netIncome < b.max) || INCOME_TAX_BRACKETS[INCOME_TAX_BRACKETS.length - 1];
                  return (
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">적용 세율 구간</span>
                      <span className="text-sm font-semibold text-purple-600">{(bracket.rate * 100).toFixed(0)}%</span>
                    </div>
                  );
                })()}
              </div>
              <div className="flex justify-between items-center py-3 bg-purple-50 rounded-xl px-4">
                <span className="text-sm font-semibold text-purple-800">예상 종합소득세</span>
                <span className="text-lg font-bold text-purple-700">{formatKRW(estimatedIncomeTax)}</span>
              </div>
              <div className="flex justify-between items-center py-2 bg-gray-50 rounded-xl px-4">
                <span className="text-sm text-gray-600">지방소득세 (10%)</span>
                <span className="text-sm font-medium text-gray-700">{formatKRW(localIncomeTax)}</span>
              </div>
              <div className="flex justify-between items-center py-2 border-t border-gray-200 pt-3">
                <span className="text-sm font-bold text-gray-900">총 납부 예상 세액</span>
                <span className="text-base font-bold text-gray-900">{formatKRW(estimatedIncomeTax + localIncomeTax)}</span>
              </div>
            </div>

            <p className="text-xs text-gray-400">※ 각종 소득공제(기본공제, 연금보험료 등)가 반영되지 않은 단순 예상 금액입니다.</p>
          </div>

          {/* 세율 구간표 */}
          <div className="card space-y-3">
            <h2 className="font-semibold text-gray-900 text-sm">2024년 종합소득세율 구간</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="px-3 py-2 text-left text-gray-500">과세표준</th>
                    <th className="px-3 py-2 text-right text-gray-500">세율</th>
                    <th className="px-3 py-2 text-right text-gray-500">누진공제</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {INCOME_TAX_BRACKETS.filter((b) => b.max !== Infinity).map((b, i) => {
                    const isActive = netIncome >= b.min && netIncome < b.max;
                    return (
                      <tr key={i} className={clsx(isActive && 'bg-purple-50 font-semibold')}>
                        <td className={clsx('px-3 py-2', isActive ? 'text-purple-700' : 'text-gray-600')}>
                          {(b.min / 10000).toLocaleString()}만원 ~ {(b.max / 10000).toLocaleString()}만원
                        </td>
                        <td className={clsx('px-3 py-2 text-right', isActive ? 'text-purple-700' : 'text-gray-600')}>
                          {(b.rate * 100).toFixed(0)}%
                        </td>
                        <td className={clsx('px-3 py-2 text-right', isActive ? 'text-purple-700' : 'text-gray-600')}>
                          {(b.deduction / 10000).toLocaleString()}만원
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── 사업자 가이드 탭 ── */}
      {tab === 'guide' && (
        <div className="space-y-3">
          {/* 빠른 링크 */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              { label: '홈택스', desc: '세금신고·납부', href: 'https://www.hometax.go.kr', color: 'bg-blue-50 border-blue-100 text-blue-700' },
              { label: '국세청', desc: '세법 안내·FAQ', href: 'https://www.nts.go.kr', color: 'bg-green-50 border-green-100 text-green-700' },
              { label: '사업자등록', desc: '등록증 발급·수정', href: 'https://www.hometax.go.kr', color: 'bg-orange-50 border-orange-100 text-orange-700' },
              { label: '세무사 찾기', desc: '세무대리인 검색', href: 'https://www.kacpta.or.kr', color: 'bg-purple-50 border-purple-100 text-purple-700' },
            ].map((link) => (
              <a key={link.label} href={link.href} target="_blank" rel="noopener noreferrer"
                className={clsx('flex flex-col gap-1 p-4 rounded-xl border-2 transition-all hover:shadow-md', link.color)}>
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold">{link.label}</p>
                  <ExternalLink size={13} />
                </div>
                <p className="text-xs opacity-75">{link.desc}</p>
              </a>
            ))}
          </div>

          {/* 아코디언 가이드 */}
          <div className="space-y-2">
            {GUIDES.map((guide) => (
              <div key={guide.id} className="card p-0 overflow-hidden">
                <button
                  type="button"
                  onClick={() => setOpenGuide(openGuide === guide.id ? null : guide.id)}
                  className="w-full flex items-center gap-3 px-5 py-4 text-left hover:bg-gray-50 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900">{guide.title}</p>
                    <p className="text-xs text-gray-400 mt-0.5 truncate">{guide.summary}</p>
                  </div>
                  {openGuide === guide.id ? <ChevronUp size={16} className="text-gray-400 shrink-0" /> : <ChevronDown size={16} className="text-gray-400 shrink-0" />}
                </button>

                {openGuide === guide.id && (
                  <div className="px-5 pb-5 border-t border-gray-100 pt-4 space-y-3">
                    <p className="text-sm text-gray-600">{guide.summary}</p>
                    <div className="space-y-2">
                      {guide.content.map((item, i) => (
                        <div key={i} className="flex gap-3">
                          <span className="shrink-0 w-1.5 h-1.5 rounded-full bg-tea-400 mt-2" />
                          <div>
                            <span className="text-xs font-semibold text-gray-700">{item.label}: </span>
                            <span className="text-xs text-gray-600">{item.text}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                    {guide.link && (
                      <a href={guide.link} target="_blank" rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-xs text-tea-600 font-medium hover:text-tea-800 mt-2">
                        <BadgeCheck size={13} /> 국세청 공식 안내 보기 <ExternalLink size={11} />
                      </a>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* 사업자 등록 정보 요약 */}
          {seller && (
            <div className="card space-y-3">
              <h2 className="font-semibold text-gray-900 flex items-center gap-2">
                <BadgeCheck size={16} className="text-tea-600" /> 내 사업자 정보
              </h2>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: '상호명', value: seller.businessName },
                  { label: '대표자명', value: seller.businessOwner },
                  { label: '사업자번호', value: seller.businessNumber ? seller.businessNumber.replace(/(\d{3})(\d{2})(\d{5})/, '$1-$2-$3') : undefined },
                  { label: '업태/종목', value: seller.businessType && seller.businessCategory ? `${seller.businessType} / ${seller.businessCategory}` : undefined },
                ].map((item) => (
                  <div key={item.label} className="bg-gray-50 rounded-xl p-3">
                    <p className="text-xs text-gray-400 mb-0.5">{item.label}</p>
                    <p className="text-sm font-medium text-gray-800">{item.value || '미등록'}</p>
                  </div>
                ))}
              </div>
              <div className={clsx('flex items-center gap-2 p-3 rounded-xl text-sm',
                seller.businessVerified ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700')}>
                {seller.businessVerified
                  ? <><CheckCircle size={15} /> 사업자 인증 완료</>
                  : <><AlertTriangle size={15} /> 사업자 인증이 필요합니다</>}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
