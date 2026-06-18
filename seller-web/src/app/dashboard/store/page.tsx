'use client';

import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { storeApi } from '@/lib/api';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import {
  Store, Palette, Image, Globe, Save, Plus, X, Loader2,
  Upload, Eye, Layout, Megaphone, Trash2, Link, Unlink, Truck
} from 'lucide-react';
import { clsx } from 'clsx';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? '';
const imgUrl = (p?: string | null) => p ? (p.startsWith('/') ? `${API_URL}${p}` : p) : null;

const THEME_PRESETS = [
  { name: '자연 녹차', themeColor: '#2D6A4F', accentColor: '#D4A017', backgroundColor: '#FAFAF5' },
  { name: '우아한 홍차', themeColor: '#7B3F3F', accentColor: '#C9A96E', backgroundColor: '#FDF8F3' },
  { name: '청아한 백차', themeColor: '#4A7C9E', accentColor: '#A8D5BA', backgroundColor: '#F5FAFE' },
  { name: '진한 보이차', themeColor: '#4A3728', accentColor: '#C17F24', backgroundColor: '#FBF6F0' },
  { name: '허브 가든', themeColor: '#5A7A4A', accentColor: '#E8A87C', backgroundColor: '#F5FAF0' },
  { name: '모던 블랙', themeColor: '#1A1A2E', accentColor: '#E94560', backgroundColor: '#F8F8F8' },
];

const FONT_OPTIONS = [
  'Noto Sans KR', 'Nanum Gothic', 'Nanum Myeongjo', 'Spoqa Han Sans Neo', 'IBM Plex Sans KR',
];

const LAYOUT_OPTIONS = [
  { value: 'grid', label: '그리드', desc: '정방형 카드 형태' },
  { value: 'list', label: '리스트', desc: '가로 나열 형태' },
  { value: 'magazine', label: '매거진', desc: '잡지 레이아웃' },
];

export default function StorePage() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'basic' | 'theme' | 'banner' | 'policy' | 'popup' | 'shipping'>('basic');
  const [showPreview, setShowPreview] = useState(false);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [bannerFile, setBannerFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState('');
  const [bannerPreview, setBannerPreview] = useState('');
  const [bannerImageFile, setBannerImageFile] = useState<File | null>(null);
  const [showPopupInPreview, setShowPopupInPreview] = useState(true);
  // 팝업 관리 상태
  const [editingPopupId, setEditingPopupId] = useState<string | 'new' | null>(null);
  const [popupImageFile, setPopupImageFile] = useState<File | null>(null);
  const [popupImagePreview, setPopupImagePreview] = useState('');
  const popupImageRef = useRef<HTMLInputElement>(null);
  // 일괄 업로드 상태
  const [bulkMode, setBulkMode] = useState(false);
  const [bulkFiles, setBulkFiles] = useState<{ file: File; preview: string; startAt: string; endAt: string }[]>([]);
  const [bulkPeriodMode, setBulkPeriodMode] = useState<'bulk' | 'individual'>('bulk');
  const [bulkStartAt, setBulkStartAt] = useState(new Date().toISOString().slice(0, 10));
  const [bulkEndAt, setBulkEndAt] = useState('');
  const [bulkCloseType, setBulkCloseType] = useState('close_only');
  const bulkFileRef = useRef<HTMLInputElement>(null);
  const logoRef = useRef<HTMLInputElement>(null);
  const bannerRef = useRef<HTMLInputElement>(null);
  const addBannerRef = useRef<HTMLInputElement>(null);

  const { data: storeData, isLoading } = useQuery({
    queryKey: ['my-store'],
    queryFn: () => storeApi.getMyStore().then((r) => r.data.data),
  });

  const { data: popupResult, refetch: refetchPopups } = useQuery({
    queryKey: ['my-popups'],
    queryFn: () => storeApi.getPopups().then((r) => r.data.data),
  });
  const popupList: any[] = popupResult?.popups || [];
  const popupDisplayMode: string = popupResult?.displayMode || 'individual';

  const store = storeData;

  const basicForm = useForm({
    values: {
      name: store?.name || '',
      description: store?.description || '',
      isOpen: store?.isOpen ?? true,
      openMessage: store?.openMessage || '',
      closedMessage: store?.closedMessage || '',
      instagramUrl: store?.instagramUrl || '',
      naverBlogUrl: store?.naverBlogUrl || '',
      youtubeUrl: store?.youtubeUrl || '',
    },
  });

  const themeForm = useForm({
    values: {
      themeColor: store?.themeColor || '#2D6A4F',
      accentColor: store?.accentColor || '#D4A017',
      backgroundColor: store?.backgroundColor || '#FAFAFA',
      fontFamily: store?.fontFamily || 'Noto Sans KR',
      layoutType: store?.layoutType || 'grid',
      bannerType: store?.bannerType || 'image',
    },
  });

  const popupForm = useForm({
    defaultValues: {
      hasLink: false,
      linkUrl: '',
      width: 400,
      height: 500,
      startAt: new Date().toISOString().slice(0, 10),
      endAt: '',
      isActive: true,
      closeType: 'close_only',
    },
  });

  const policyForm = useForm({
    values: {
      shippingPolicy: store?.shippingPolicy || '',
      returnPolicy: store?.returnPolicy || '',
      minOrderAmount: store?.minOrderAmount || '',
    },
  });

  const [shippingFee, setShippingFee] = useState<string>('0');
  const [freeShippingThreshold, setFreeShippingThreshold] = useState<string>('');
  const [shippingPolicies, setShippingPolicies] = useState<{ region: string; fee: string }[]>([]);
  const [shippingInitialized, setShippingInitialized] = useState(false);

  const updateShippingMutation = useMutation({
    mutationFn: (data: object) => storeApi.updateShipping(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-store'] });
      toast.success('배송비 설정이 저장되었습니다.');
    },
    onError: () => toast.error('배송비 설정 저장에 실패했습니다.'),
  });

  // 스토어 데이터 로드 후 배송비 상태 초기화
  useState(() => {
    if (store && !shippingInitialized) {
      setShippingFee(String(store.shippingFee ?? 0));
      setFreeShippingThreshold(store.freeShippingThreshold ? String(store.freeShippingThreshold) : '');
      if (store.shippingPolicies) {
        setShippingPolicies((store.shippingPolicies as any[]).map((p: any) => ({ region: p.region, fee: String(p.fee) })));
      }
      setShippingInitialized(true);
    }
  });

  const createMutation = useMutation({
    mutationFn: (data: { name: string; description?: string }) => storeApi.createStore(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-store'] });
      toast.success('스토어가 생성되었습니다!');
    },
    onError: (e: any) => toast.error(e.response?.data?.error || '생성 실패'),
  });

  const updateBasicMutation = useMutation({
    mutationFn: (formData: FormData) => storeApi.updateStore(formData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-store'] });
      toast.success('기본 정보가 저장되었습니다.');
    },
    onError: () => toast.error('저장에 실패했습니다.'),
  });

  const updateThemeMutation = useMutation({
    mutationFn: (data: object) => storeApi.updateTheme(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-store'] });
      toast.success('테마가 저장되었습니다.');
    },
    onError: () => toast.error('테마 저장에 실패했습니다.'),
  });

  const addBannerMutation = useMutation({
    mutationFn: (formData: FormData) => storeApi.addBanner(formData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-store'] });
      toast.success('배너가 추가되었습니다.');
      setBannerImageFile(null);
    },
    onError: () => toast.error('배너 추가에 실패했습니다.'),
  });

  const deleteBannerMutation = useMutation({
    mutationFn: (bannerId: string) => storeApi.deleteBanner(bannerId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-store'] });
      toast.success('배너가 삭제되었습니다.');
    },
  });

  const createPopupMutation = useMutation({
    mutationFn: (formData: FormData) => storeApi.createPopup(formData),
    onSuccess: () => {
      refetchPopups();
      setEditingPopupId(null);
      setPopupImageFile(null);
      setPopupImagePreview('');
      popupForm.reset();
      toast.success('팝업이 추가되었습니다.');
    },
    onError: () => toast.error('팝업 추가에 실패했습니다.'),
  });

  const updatePopupMutation = useMutation({
    mutationFn: ({ id, formData }: { id: string; formData: FormData }) =>
      storeApi.updatePopup(id, formData),
    onSuccess: () => {
      refetchPopups();
      setEditingPopupId(null);
      setPopupImageFile(null);
      setPopupImagePreview('');
      popupForm.reset();
      toast.success('팝업이 수정되었습니다.');
    },
    onError: () => toast.error('팝업 수정에 실패했습니다.'),
  });

  const deletePopupMutation = useMutation({
    mutationFn: (popupId: string) => storeApi.deletePopup(popupId),
    onSuccess: () => {
      refetchPopups();
      toast.success('팝업이 삭제되었습니다.');
    },
  });

  const displayModeMutation = useMutation({
    mutationFn: (mode: string) => storeApi.updatePopupDisplayMode(mode),
    onSuccess: () => {
      refetchPopups();
      toast.success('표시 방식이 변경되었습니다.');
    },
  });

  const openNewPopupForm = () => {
    popupForm.reset({
      hasLink: false, linkUrl: '', width: 400, height: 500,
      startAt: new Date().toISOString().slice(0, 10),
      endAt: '', isActive: true, closeType: 'close_only',
    });
    setPopupImageFile(null);
    setPopupImagePreview('');
    setEditingPopupId('new');
  };

  const openEditPopupForm = (popup: any) => {
    popupForm.reset({
      hasLink: popup.hasLink,
      linkUrl: popup.linkUrl || '',
      width: popup.width,
      height: popup.height,
      startAt: popup.startAt?.slice(0, 10) || '',
      endAt: popup.endAt?.slice(0, 10) || '',
      isActive: popup.isActive,
      closeType: popup.closeType,
    });
    setPopupImageFile(null);
    setPopupImagePreview(
      popup.imageUrl
        ? (popup.imageUrl.startsWith('/') ? `${process.env.NEXT_PUBLIC_API_URL ?? ''}${popup.imageUrl}` : popup.imageUrl)
        : ''
    );
    setEditingPopupId(popup.id);
  };

  const onPopupSubmit = (data: any) => {
    const formData = new FormData();
    Object.entries(data).forEach(([k, v]) => formData.append(k, String(v)));
    if (popupImageFile) formData.append('image', popupImageFile);
    if (editingPopupId === 'new') {
      createPopupMutation.mutate(formData);
    } else if (editingPopupId) {
      updatePopupMutation.mutate({ id: editingPopupId, formData });
    }
  };

  const onBulkSubmit = async () => {
    if (bulkFiles.length === 0) { toast.error('이미지를 선택해주세요.'); return; }
    let successCount = 0;
    for (const item of bulkFiles) {
      const formData = new FormData();
      formData.append('image', item.file);
      formData.append('isActive', 'true');
      formData.append('width', '400');
      formData.append('height', '500');
      formData.append('closeType', bulkCloseType);
      formData.append('hasLink', 'false');
      formData.append('startAt', bulkPeriodMode === 'bulk' ? bulkStartAt : item.startAt);
      formData.append('endAt', bulkPeriodMode === 'bulk' ? bulkEndAt : item.endAt);
      try {
        await storeApi.createPopup(formData);
        successCount++;
      } catch {}
    }
    refetchPopups();
    setBulkFiles([]);
    setBulkMode(false);
    toast.success(`${successCount}개 팝업이 추가되었습니다.`);
  };

  const onBasicSubmit = (data: any) => {
    const formData = new FormData();
    Object.entries(data).forEach(([k, v]) => formData.append(k, String(v)));
    if (logoFile) formData.append('logo', logoFile);
    if (bannerFile) formData.append('banner', bannerFile);
    updateBasicMutation.mutate(formData);
  };

  const onThemeSubmit = (data: any) => {
    updateThemeMutation.mutate(data);
  };

  const onAddBanner = () => {
    if (!bannerImageFile) {
      toast.error('배너 이미지를 선택해주세요.');
      return;
    }
    const formData = new FormData();
    formData.append('image', bannerImageFile);
    addBannerMutation.mutate(formData);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <p className="text-gray-500 text-sm">스토어 정보를 불러오는 중...</p>
        </div>
      </div>
    );
  }

  // 스토어 미생성 시
  if (!store) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="card text-center max-w-md">
          <h2 className="text-xl font-bold text-gray-900 mb-2">스토어를 만들어보세요!</h2>
          <p className="text-gray-500 text-sm mb-6">나만의 차 전문 스토어를 개설하고 상품을 판매하세요.</p>
          <form onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.target as HTMLFormElement);
            createMutation.mutate({
              name: fd.get('name') as string,
              description: fd.get('description') as string,
            });
          }}>
            <div className="space-y-3 text-left">
              <div>
                <label className="label-base">스토어 이름 *</label>
                <input name="name" required placeholder="예: 제주 다원" className="input-base" />
              </div>
              <div>
                <label className="label-base">스토어 소개</label>
                <textarea name="description" placeholder="스토어 소개 문구" className="input-base h-20 resize-none" />
              </div>
            </div>
            <button type="submit" disabled={createMutation.isPending} className="btn-primary w-full mt-4">
              {createMutation.isPending ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
              스토어 개설하기
            </button>
          </form>
        </div>
      </div>
    );
  }

  const tabs = [
    { id: 'basic', label: '기본 정보', icon: Store },
    { id: 'theme', label: '테마/디자인', icon: Palette },
    { id: 'banner', label: '배너 관리', icon: Image },
    { id: 'popup', label: '팝업 관리', icon: Megaphone },
    { id: 'policy', label: '정책/안내', icon: Globe },
    { id: 'shipping', label: '배송비 설정', icon: Truck },
  ];

  const currentTheme = themeForm.watch();
  const currentBasic = basicForm.watch();

  return (
    <div className="space-y-5 animate-fade-in">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">상점 꾸미기</h1>
          <p className="text-gray-500 text-sm mt-0.5">나만의 스타일로 스토어를 꾸며보세요</p>
        </div>
        <button
          type="button"
          onClick={() => { setShowPreview(true); setShowPopupInPreview(true); }}
          className="btn-secondary py-2"
        >
          <Eye size={16} />
          미리보기
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-5">
        {/* 탭 사이드바 */}
        <div className="lg:col-span-1">
          <div className="card p-2 space-y-1">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={clsx(
                  'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all',
                  activeTab === tab.id
                    ? 'bg-tea-600 text-white'
                    : 'text-gray-600 hover:bg-gray-50'
                )}
              >
                <tab.icon size={18} />
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* 내용 영역 */}
        <div className="lg:col-span-3">
          {/* 기본 정보 */}
          {activeTab === 'basic' && (
            <form onSubmit={basicForm.handleSubmit(onBasicSubmit)} className="card space-y-5">
              <h2 className="font-semibold text-gray-900">기본 정보</h2>

              {/* 로고 & 배너 이미지 */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label-base">스토어 로고</label>
                  <div
                    onClick={() => logoRef.current?.click()}
                    className="border-2 border-dashed border-gray-200 rounded-xl p-4 text-center cursor-pointer hover:border-tea-300 hover:bg-tea-50 transition-all"
                  >
                    {(logoPreview || store.logoUrl) ? (
                      <img src={logoPreview || imgUrl(store.logoUrl)!} alt="로고" className="h-20 w-20 object-contain rounded-lg mx-auto" />
                    ) : (
                      <div>
                        <Upload size={24} className="mx-auto text-gray-300 mb-1" />
                        <p className="text-xs text-gray-400">로고 업로드</p>
                      </div>
                    )}
                  </div>
                  <input ref={logoRef} type="file" accept="image/*" className="hidden" onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) { setLogoFile(f); setLogoPreview(URL.createObjectURL(f)); }
                  }} />
                </div>
                <div>
                  <label className="label-base">스토어 배너</label>
                  <div
                    onClick={() => bannerRef.current?.click()}
                    className="border-2 border-dashed border-gray-200 rounded-xl p-4 text-center cursor-pointer hover:border-tea-300 hover:bg-tea-50 transition-all"
                  >
                    {(bannerPreview || store.bannerUrl) ? (
                      <img src={bannerPreview || imgUrl(store.bannerUrl)!} alt="배너" className="h-20 w-full object-cover rounded-lg" />
                    ) : (
                      <div>
                        <Upload size={24} className="mx-auto text-gray-300 mb-1" />
                        <p className="text-xs text-gray-400">배너 업로드</p>
                      </div>
                    )}
                  </div>
                  <input ref={bannerRef} type="file" accept="image/*" className="hidden" onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) { setBannerFile(f); setBannerPreview(URL.createObjectURL(f)); }
                  }} />
                </div>
              </div>

              <div>
                <label className="label-base">스토어 이름</label>
                <input {...basicForm.register('name')} className="input-base" />
              </div>

              <div>
                <label className="label-base">스토어 소개</label>
                <textarea {...basicForm.register('description')} className="input-base h-24 resize-none" placeholder="스토어를 소개하는 문구를 입력하세요" />
              </div>

              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" {...basicForm.register('isOpen')} className="rounded text-tea-600 focus:ring-tea-500" />
                  <span className="text-sm font-medium text-gray-700">영업중</span>
                </label>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label-base">영업 메시지</label>
                  <input {...basicForm.register('openMessage')} placeholder="예: 오늘도 좋은 차 한잔!" className="input-base" />
                </div>
                <div>
                  <label className="label-base">휴무 메시지</label>
                  <input {...basicForm.register('closedMessage')} placeholder="예: 잠시 휴가 중입니다" className="input-base" />
                </div>
              </div>

              <div>
                <label className="label-base">SNS 링크</label>
                <div className="space-y-2">
                  <input {...basicForm.register('instagramUrl')} placeholder="인스타그램 URL" className="input-base" />
                  <input {...basicForm.register('naverBlogUrl')} placeholder="네이버 블로그 URL" className="input-base" />
                  <input {...basicForm.register('youtubeUrl')} placeholder="유튜브 URL" className="input-base" />
                </div>
              </div>

              <button type="submit" disabled={updateBasicMutation.isPending} className="btn-primary w-full">
                {updateBasicMutation.isPending ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                저장하기
              </button>
            </form>
          )}

          {/* 테마/디자인 */}
          {activeTab === 'theme' && (
            <form onSubmit={themeForm.handleSubmit(onThemeSubmit)} className="card space-y-6">
              <h2 className="font-semibold text-gray-900">테마 & 디자인</h2>

              {/* 색상 프리셋 */}
              <div>
                <label className="label-base">색상 프리셋</label>
                <div className="grid grid-cols-3 gap-3">
                  {THEME_PRESETS.map((preset) => (
                    <button
                      key={preset.name}
                      type="button"
                      onClick={() => {
                        themeForm.setValue('themeColor', preset.themeColor);
                        themeForm.setValue('accentColor', preset.accentColor);
                        themeForm.setValue('backgroundColor', preset.backgroundColor);
                      }}
                      className="p-3 rounded-xl border-2 border-transparent hover:border-tea-400 transition-all text-left"
                      style={{ backgroundColor: preset.backgroundColor }}
                    >
                      <div className="flex gap-1 mb-1.5">
                        <div className="w-5 h-5 rounded-full" style={{ backgroundColor: preset.themeColor }} />
                        <div className="w-5 h-5 rounded-full" style={{ backgroundColor: preset.accentColor }} />
                      </div>
                      <p className="text-xs font-medium" style={{ color: preset.themeColor }}>{preset.name}</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* 색상 직접 설정 */}
              <div className="grid grid-cols-3 gap-4">
                {[
                  { field: 'themeColor', label: '메인 컬러' },
                  { field: 'accentColor', label: '포인트 컬러' },
                  { field: 'backgroundColor', label: '배경색' },
                ].map(({ field, label }) => (
                  <div key={field}>
                    <label className="label-base">{label}</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        {...themeForm.register(field as any)}
                        className="w-10 h-10 rounded-lg border border-gray-300 cursor-pointer p-1"
                      />
                      <input
                        {...themeForm.register(field as any)}
                        placeholder="#000000"
                        className="input-base flex-1"
                      />
                    </div>
                  </div>
                ))}
              </div>

              {/* 폰트 */}
              <div>
                <label className="label-base">폰트</label>
                <select {...themeForm.register('fontFamily')} className="input-base">
                  {FONT_OPTIONS.map((f) => <option key={f} value={f} style={{ fontFamily: f }}>{f}</option>)}
                </select>
              </div>

              {/* 레이아웃 */}
              <div>
                <label className="label-base">상품 레이아웃</label>
                <div className="grid grid-cols-3 gap-3">
                  {LAYOUT_OPTIONS.map((opt) => (
                    <label
                      key={opt.value}
                      className={clsx(
                        'flex flex-col items-center gap-2 p-3 rounded-xl border-2 cursor-pointer transition-all',
                        themeForm.watch('layoutType') === opt.value
                          ? 'border-tea-500 bg-tea-50'
                          : 'border-gray-200 hover:border-tea-300'
                      )}
                    >
                      <input type="radio" {...themeForm.register('layoutType')} value={opt.value} className="sr-only" />
                      <Layout size={24} className={themeForm.watch('layoutType') === opt.value ? 'text-tea-600' : 'text-gray-400'} />
                      <div className="text-center">
                        <p className="text-sm font-medium text-gray-800">{opt.label}</p>
                        <p className="text-xs text-gray-400">{opt.desc}</p>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              {/* 라이브 미리보기 */}
              <div
                className="rounded-xl p-4 border-2 border-dashed border-gray-200"
                style={{ backgroundColor: currentTheme.backgroundColor }}
              >
                <p className="text-xs text-gray-400 mb-3">미리보기</p>
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-lg" style={{ backgroundColor: currentTheme.themeColor }} />
                  <div>
                    <p className="font-bold text-sm" style={{ color: currentTheme.themeColor, fontFamily: currentTheme.fontFamily }}>
                      {store.name}
                    </p>
                    <p className="text-xs text-gray-500" style={{ fontFamily: currentTheme.fontFamily }}>
                      차 전문 스토어
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    className="px-3 py-1.5 rounded-lg text-xs text-white font-medium"
                    style={{ backgroundColor: currentTheme.themeColor }}
                  >
                    장바구니
                  </button>
                  <button
                    type="button"
                    className="px-3 py-1.5 rounded-lg text-xs font-medium border"
                    style={{ color: currentTheme.accentColor, borderColor: currentTheme.accentColor }}
                  >
                    찜하기
                  </button>
                </div>
              </div>

              <button type="submit" disabled={updateThemeMutation.isPending} className="btn-primary w-full">
                {updateThemeMutation.isPending ? <Loader2 size={16} className="animate-spin" /> : <Palette size={16} />}
                테마 저장
              </button>
            </form>
          )}

          {/* 배너 관리 */}
          {activeTab === 'banner' && (
            <div className="card space-y-5">
              <h2 className="font-semibold text-gray-900">배너 관리</h2>

              {/* 배너 추가 */}
              <div className="border-2 border-dashed border-gray-200 rounded-xl p-5">
                <div
                  onClick={() => addBannerRef.current?.click()}
                  className="cursor-pointer text-center"
                >
                  {bannerImageFile ? (
                    <div className="relative">
                      <img
                        src={URL.createObjectURL(bannerImageFile)}
                        alt="새 배너"
                        className="h-40 w-full object-cover rounded-lg"
                      />
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); setBannerImageFile(null); }}
                        className="absolute top-2 right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center"
                      >
                        <X size={12} />
                      </button>
                    </div>
                  ) : (
                    <div>
                      <Upload size={32} className="mx-auto text-gray-300 mb-2" />
                      <p className="text-sm text-gray-500">배너 이미지 업로드</p>
                      <p className="text-xs text-gray-400 mt-1">권장 크기: 1200×400px</p>
                    </div>
                  )}
                </div>
                <input
                  ref={addBannerRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) setBannerImageFile(f);
                  }}
                />
                {bannerImageFile && (
                  <button
                    type="button"
                    onClick={onAddBanner}
                    disabled={addBannerMutation.isPending}
                    className="btn-primary w-full mt-3"
                  >
                    {addBannerMutation.isPending ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
                    배너 추가
                  </button>
                )}
              </div>

              {/* 기존 배너 목록 */}
              <div className="space-y-3">
                <p className="text-sm font-medium text-gray-700">등록된 배너 ({store.banners?.length || 0}개)</p>
                {store.banners?.length === 0 ? (
                  <p className="text-center text-gray-400 text-sm py-8">등록된 배너가 없습니다</p>
                ) : (
                  store.banners?.map((banner: any, index: number) => (
                    <div key={banner.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                      <img src={imgUrl(banner.imageUrl)!} alt="" className="w-24 h-14 object-cover rounded-lg shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-700">{banner.title || `배너 ${index + 1}`}</p>
                        {banner.linkUrl && (
                          <p className="text-xs text-gray-400 truncate">{banner.linkUrl}</p>
                        )}
                      </div>
                      <button
                        onClick={() => {
                          if (confirm('배너를 삭제하시겠습니까?')) {
                            deleteBannerMutation.mutate(banner.id);
                          }
                        }}
                        className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                      >
                        <X size={16} />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* 팝업 관리 */}
          {activeTab === 'popup' && (
            <div className="space-y-4">
              {/* 표시 방식 선택 */}
              <div className="card space-y-3">
                <h2 className="font-semibold text-gray-900">팝업 표시 방식</h2>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { value: 'individual', label: '개별 팝업', desc: '여러 팝업을 각각 독립적으로 표시', icon: '⊞' },
                    { value: 'slideshow', label: '슬라이드쇼', desc: '하나의 팝업에서 슬라이드 형식으로 표시', icon: '▷' },
                  ].map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => displayModeMutation.mutate(opt.value)}
                      className={clsx(
                        'flex items-start gap-3 p-4 rounded-xl border-2 text-left transition-all',
                        popupDisplayMode === opt.value
                          ? 'border-tea-500 bg-tea-50'
                          : 'border-gray-200 hover:border-tea-300'
                      )}
                    >
                      <span className="text-2xl shrink-0">{opt.icon}</span>
                      <div>
                        <p className={clsx('text-sm font-semibold', popupDisplayMode === opt.value ? 'text-tea-700' : 'text-gray-800')}>
                          {opt.label}
                        </p>
                        <p className="text-xs text-gray-400 mt-0.5">{opt.desc}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* 팝업 목록 */}
              <div className="card space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="font-semibold text-gray-900">팝업 목록 ({popupList.length}개)</h2>
                  {editingPopupId === null && !bulkMode && (
                    <div className="flex gap-2">
                      <button type="button" onClick={() => { setBulkMode(true); setBulkFiles([]); setEditingPopupId(null); }}
                        className="btn-secondary py-1.5 text-sm">
                        <Upload size={14} /> 여러 장 추가
                      </button>
                      <button type="button" onClick={openNewPopupForm} className="btn-primary py-1.5 text-sm">
                        <Plus size={15} /> 팝업 추가
                      </button>
                    </div>
                  )}
                </div>

                {/* 일괄 업로드 UI */}
                {bulkMode && (
                  <div className="border-2 border-tea-200 rounded-xl p-4 space-y-4 bg-tea-50/30">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-semibold text-tea-800">여러 팝업 한 번에 추가</p>
                      <button type="button" onClick={() => { setBulkMode(false); setBulkFiles([]); }}
                        className="p-1 text-gray-400 hover:text-gray-600"><X size={16} /></button>
                    </div>

                    {/* 이미지 선택 */}
                    <div>
                      <button type="button" onClick={() => bulkFileRef.current?.click()}
                        className="w-full border-2 border-dashed border-gray-200 rounded-xl p-4 text-center hover:border-tea-300 hover:bg-tea-50 transition-all">
                        <Upload size={20} className="mx-auto text-gray-300 mb-1" />
                        <p className="text-sm text-gray-400">클릭하여 이미지 여러 장 선택</p>
                        <p className="text-xs text-gray-300 mt-0.5">JPG, PNG, GIF</p>
                      </button>
                      <input ref={bulkFileRef} type="file" accept="image/*" multiple className="hidden"
                        onChange={(e) => {
                          const files = Array.from(e.target.files || []);
                          const today = new Date().toISOString().slice(0, 10);
                          setBulkFiles((prev) => [
                            ...prev,
                            ...files.map((f) => ({ file: f, preview: URL.createObjectURL(f), startAt: today, endAt: '' })),
                          ]);
                          e.target.value = '';
                        }} />
                    </div>

                    {bulkFiles.length > 0 && (
                      <>
                        {/* 기간 설정 모드 */}
                        <div>
                          <label className="label-base">기간 설정 방식</label>
                          <div className="grid grid-cols-2 gap-2 mb-3">
                            {[{ value: 'bulk', label: '일괄 설정', desc: '모든 팝업에 같은 기간 적용' }, { value: 'individual', label: '개별 설정', desc: '팝업마다 기간을 따로 설정' }].map((opt) => (
                              <button key={opt.value} type="button"
                                onClick={() => setBulkPeriodMode(opt.value as any)}
                                className={clsx('flex flex-col items-start p-3 rounded-xl border-2 transition-all text-left',
                                  bulkPeriodMode === opt.value ? 'border-tea-500 bg-tea-50' : 'border-gray-200 hover:border-tea-300')}>
                                <p className={clsx('text-sm font-medium', bulkPeriodMode === opt.value ? 'text-tea-700' : 'text-gray-700')}>{opt.label}</p>
                                <p className="text-xs text-gray-400 mt-0.5">{opt.desc}</p>
                              </button>
                            ))}
                          </div>

                          {bulkPeriodMode === 'bulk' && (
                            <div className="grid grid-cols-2 gap-3">
                              <div>
                                <label className="label-base">시작일</label>
                                <input type="date" value={bulkStartAt} onChange={(e) => setBulkStartAt(e.target.value)} className="input-base" />
                              </div>
                              <div>
                                <label className="label-base">종료일</label>
                                <input type="date" value={bulkEndAt} onChange={(e) => setBulkEndAt(e.target.value)} className="input-base" />
                              </div>
                            </div>
                          )}

                          <div className="mt-3">
                            <label className="label-base">닫기 방식</label>
                            <div className="grid grid-cols-2 gap-2">
                              {[{ value: 'close_only', label: '닫기만' }, { value: 'hide_week', label: '7일간 보지 않기' }].map((opt) => (
                                <label key={opt.value} className={clsx('flex items-center gap-2 p-2.5 rounded-xl border-2 cursor-pointer transition-all',
                                  bulkCloseType === opt.value ? 'border-tea-500 bg-tea-50' : 'border-gray-200 hover:border-tea-300')}>
                                  <input type="radio" checked={bulkCloseType === opt.value} onChange={() => setBulkCloseType(opt.value)} className="sr-only" />
                                  <span className="text-sm font-medium text-gray-700">{opt.label}</span>
                                </label>
                              ))}
                            </div>
                          </div>
                        </div>

                        {/* 이미지 목록 */}
                        <div className="space-y-2">
                          {bulkFiles.map((item, idx) => (
                            <div key={idx} className="flex items-center gap-3 p-2 bg-white rounded-xl border border-gray-100">
                              <img src={item.preview} alt="" className="w-14 h-14 object-cover rounded-lg shrink-0" />
                              <div className="flex-1 min-w-0">
                                <p className="text-xs font-medium text-gray-700 truncate">{item.file.name}</p>
                                {bulkPeriodMode === 'individual' && (
                                  <div className="grid grid-cols-2 gap-2 mt-1.5">
                                    <input type="date" value={item.startAt} className="input-base text-xs py-1"
                                      onChange={(e) => setBulkFiles((prev) => prev.map((f, i) => i === idx ? { ...f, startAt: e.target.value } : f))} />
                                    <input type="date" value={item.endAt} className="input-base text-xs py-1"
                                      onChange={(e) => setBulkFiles((prev) => prev.map((f, i) => i === idx ? { ...f, endAt: e.target.value } : f))} />
                                  </div>
                                )}
                              </div>
                              <button type="button" onClick={() => setBulkFiles((prev) => prev.filter((_, i) => i !== idx))}
                                className="p-1 text-gray-400 hover:text-red-500 shrink-0"><X size={14} /></button>
                            </div>
                          ))}
                        </div>

                        <div className="flex gap-2">
                          <button type="button" onClick={() => { setBulkMode(false); setBulkFiles([]); }} className="btn-secondary flex-1">취소</button>
                          <button type="button" onClick={onBulkSubmit} className="btn-primary flex-1">
                            <Plus size={15} /> {bulkFiles.length}개 팝업 추가
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                )}


                {popupList.length === 0 && editingPopupId === null && (
                  <div className="text-center py-8 text-gray-400">
                    <Megaphone size={32} className="mx-auto mb-2 opacity-30" />
                    <p className="text-sm">등록된 팝업이 없습니다</p>
                  </div>
                )}

                {/* 팝업 카드 목록 */}
                {popupList.map((popup) => (
                  <div key={popup.id}>
                    {editingPopupId === popup.id ? (
                      /* 수정 폼 인라인 */
                      <PopupForm
                        popupForm={popupForm}
                        popupImageFile={popupImageFile}
                        popupImagePreview={popupImagePreview}
                        popupImageRef={popupImageRef}
                        setPopupImageFile={setPopupImageFile}
                        setPopupImagePreview={setPopupImagePreview}
                        isPending={updatePopupMutation.isPending}
                        onSubmit={popupForm.handleSubmit(onPopupSubmit)}
                        onCancel={() => { setEditingPopupId(null); setPopupImageFile(null); setPopupImagePreview(''); }}
                        isEdit
                      />
                    ) : (
                      /* 팝업 카드 요약 */
                      <div className="flex items-center gap-3 p-3 rounded-xl border border-gray-100 bg-gray-50">
                        <div className="w-16 h-16 rounded-lg overflow-hidden bg-gray-200 shrink-0">
                          {popup.imageUrl ? (
                            <img
                              src={popup.imageUrl.startsWith('/') ? `${process.env.NEXT_PUBLIC_API_URL ?? ''}${popup.imageUrl}` : popup.imageUrl}
                              alt="" className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-gray-400 text-xs">없음</div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className={clsx('text-xs px-2 py-0.5 rounded-full font-medium', popup.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500')}>
                              {popup.isActive ? '활성' : '비활성'}
                            </span>
                            <span className="text-xs text-gray-400">{popup.width}×{popup.height}px</span>
                            {popup.closeType === 'hide_week' && <span className="text-xs text-blue-500">일주일 안보기</span>}
                          </div>
                          <p className="text-xs text-gray-500 truncate">
                            {popup.startAt?.slice(0, 10)} ~ {popup.endAt?.slice(0, 10)}
                          </p>
                          {popup.hasLink && popup.linkUrl && (
                            <p className="text-xs text-tea-600 truncate mt-0.5">{popup.linkUrl}</p>
                          )}
                        </div>
                        <div className="flex gap-1 shrink-0">
                          <button type="button" onClick={() => openEditPopupForm(popup)} className="p-2 text-gray-400 hover:text-tea-600 hover:bg-tea-50 rounded-lg transition-colors">
                            <Save size={15} />
                          </button>
                          <button
                            type="button"
                            onClick={() => { if (confirm('팝업을 삭제하시겠습니까?')) deletePopupMutation.mutate(popup.id); }}
                            className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}

                {/* 새 팝업 추가 폼 */}
                {editingPopupId === 'new' && (
                  <PopupForm
                    popupForm={popupForm}
                    popupImageFile={popupImageFile}
                    popupImagePreview={popupImagePreview}
                    popupImageRef={popupImageRef}
                    setPopupImageFile={setPopupImageFile}
                    setPopupImagePreview={setPopupImagePreview}
                    isPending={createPopupMutation.isPending}
                    onSubmit={popupForm.handleSubmit(onPopupSubmit)}
                    onCancel={() => { setEditingPopupId(null); setPopupImageFile(null); setPopupImagePreview(''); }}
                    isEdit={false}
                  />
                )}
              </div>
            </div>
          )}

          {/* 정책 */}
          {activeTab === 'policy' && (
            <form onSubmit={policyForm.handleSubmit((data) => {
              const formData = new FormData();
              Object.entries(data).forEach(([k, v]) => v && formData.append(k, String(v)));
              updateBasicMutation.mutate(formData);
            })} className="card space-y-4">
              <h2 className="font-semibold text-gray-900">운영 정책</h2>

              <div>
                <label className="label-base">최소 주문 금액</label>
                <div className="relative">
                  <input
                    {...policyForm.register('minOrderAmount')}
                    type="number"
                    placeholder="0 (무제한)"
                    className="input-base pr-8"
                    min="0"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">원</span>
                </div>
              </div>

              <div>
                <label className="label-base">배송 정책</label>
                <textarea
                  {...policyForm.register('shippingPolicy')}
                  placeholder="배송 방법, 기간, 비용 등을 안내해주세요"
                  className="input-base h-32 resize-none"
                />
              </div>

              <div>
                <label className="label-base">반품/교환 정책</label>
                <textarea
                  {...policyForm.register('returnPolicy')}
                  placeholder="반품 및 교환 관련 안내를 작성해주세요"
                  className="input-base h-32 resize-none"
                />
              </div>

              <button type="submit" disabled={updateBasicMutation.isPending} className="btn-primary w-full">
                {updateBasicMutation.isPending ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                정책 저장
              </button>
            </form>
          )}

          {/* 배송비 설정 */}
          {activeTab === 'shipping' && (
            <div className="card space-y-6">
              <div>
                <h2 className="font-semibold text-gray-900 mb-1">배송비 설정</h2>
                <p className="text-sm text-gray-500">소비자 결제 시 자동으로 적용됩니다</p>
              </div>

              {/* 기본 배송비 */}
              <div>
                <label className="label-base">기본 배송비</label>
                <div className="relative max-w-xs">
                  <input type="number" value={shippingFee} onChange={(e) => setShippingFee(e.target.value)}
                    placeholder="3000" min="0" className="input-base pr-8" />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">원</span>
                </div>
                <p className="text-xs text-gray-400 mt-1">0원으로 설정하면 무료배송으로 표시됩니다</p>
              </div>

              {/* 무료배송 기준 */}
              <div>
                <label className="label-base">무료배송 기준금액</label>
                <div className="relative max-w-xs">
                  <input type="number" value={freeShippingThreshold} onChange={(e) => setFreeShippingThreshold(e.target.value)}
                    placeholder="50000 (비워두면 조건부 무료배송 없음)" min="0" className="input-base pr-8" />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">원</span>
                </div>
                {freeShippingThreshold && (
                  <p className="text-xs text-tea-700 mt-1 font-medium">
                    → {Number(freeShippingThreshold).toLocaleString()}원 이상 구매 시 무료배송
                  </p>
                )}
              </div>

              {/* 지역별 추가 배송비 */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="label-base mb-0">지역별 추가 배송비</label>
                  <button type="button"
                    onClick={() => setShippingPolicies((p) => [...p, { region: '', fee: '' }])}
                    className="flex items-center gap-1 text-xs text-tea-700 hover:text-tea-800 font-medium">
                    <Plus size={13} /> 지역 추가
                  </button>
                </div>

                {shippingPolicies.length === 0 ? (
                  <div className="text-center py-4 border-2 border-dashed border-gray-200 rounded-xl text-sm text-gray-400">
                    지역별 추가 배송비 없음
                  </div>
                ) : (
                  <div className="space-y-2">
                    {shippingPolicies.map((policy, idx) => (
                      <div key={idx} className="flex gap-2 items-center">
                        <input value={policy.region}
                          onChange={(e) => setShippingPolicies((p) => p.map((x, i) => i === idx ? { ...x, region: e.target.value } : x))}
                          placeholder="예: 제주도" className="input-base flex-1" />
                        <div className="relative flex-1">
                          <input type="number" value={policy.fee}
                            onChange={(e) => setShippingPolicies((p) => p.map((x, i) => i === idx ? { ...x, fee: e.target.value } : x))}
                            placeholder="3000" min="0" className="input-base pr-8" />
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">원</span>
                        </div>
                        <button type="button" onClick={() => setShippingPolicies((p) => p.filter((_, i) => i !== idx))}
                          className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                          <X size={16} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                <p className="text-xs text-gray-400 mt-2">기본 배송비에 추가로 부과됩니다. 소비자가 직접 선택하거나 안내됩니다.</p>
              </div>

              {/* 미리보기 */}
              <div className="bg-tea-50 rounded-xl p-4 border border-tea-100">
                <p className="text-xs font-semibold text-tea-700 mb-2">스토어 배송 정보 미리보기</p>
                <div className="text-xs text-tea-600 space-y-1">
                  <p>기본 배송비: <strong>{shippingFee ? `${Number(shippingFee).toLocaleString()}원` : '무료'}</strong></p>
                  {freeShippingThreshold && <p>무료배송 조건: <strong>{Number(freeShippingThreshold).toLocaleString()}원 이상</strong></p>}
                  {shippingPolicies.filter((p) => p.region && p.fee).map((p, i) => (
                    <p key={i}>{p.region}: 기본 배송비 + <strong>{Number(p.fee).toLocaleString()}원 추가</strong></p>
                  ))}
                </div>
              </div>

              <button type="button" disabled={updateShippingMutation.isPending}
                onClick={() => updateShippingMutation.mutate({
                  shippingFee: shippingFee === '' ? 0 : Number(shippingFee),
                  freeShippingThreshold: freeShippingThreshold === '' ? null : Number(freeShippingThreshold),
                  shippingPolicies: shippingPolicies.filter((p) => p.region && p.fee).map((p) => ({ region: p.region, fee: Number(p.fee) })),
                })}
                className="btn-primary w-full">
                {updateShippingMutation.isPending ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                배송비 설정 저장
              </button>
            </div>
          )}
        </div>
      </div>

      {/* 전체화면 미리보기 모달 */}
      {showPreview && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl">
            {/* 모달 헤더 */}
            <div className="sticky top-0 bg-white border-b border-gray-200 px-5 py-3 flex items-center justify-between rounded-t-2xl z-10">
              <div className="flex items-center gap-2">
                <Eye size={16} className="text-tea-600" />
                <span className="font-semibold text-gray-800 text-sm">스토어 미리보기</span>
                <span className="text-xs text-gray-400 ml-1">실제 화면과 다를 수 있습니다</span>
              </div>
              <button
                onClick={() => setShowPreview(false)}
                className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X size={18} className="text-gray-500" />
              </button>
            </div>

            {/* 스토어 미리보기 본문 */}
            <div className="relative" style={{ backgroundColor: currentTheme.backgroundColor, fontFamily: currentTheme.fontFamily }}>
              {/* 배너 영역 */}
              <div className="relative h-40 overflow-hidden">
                {(bannerPreview || store.bannerUrl) ? (
                  <img
                    src={bannerPreview || imgUrl(store.bannerUrl)!}
                    alt="배너"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div
                    className="w-full h-full flex items-center justify-center"
                    style={{ background: `linear-gradient(135deg, ${currentTheme.themeColor}, ${currentTheme.accentColor})` }}
                  >
                    <span className="text-white/60 text-sm">배너 이미지</span>
                  </div>
                )}
              </div>

              {/* 스토어 헤더 */}
              <div className="px-6 py-5 border-b" style={{ borderColor: `${currentTheme.themeColor}20` }}>
                <div className="flex items-center gap-4">
                  <div
                    className="w-16 h-16 rounded-xl overflow-hidden shrink-0 border-2"
                    style={{ borderColor: currentTheme.themeColor }}
                  >
                    {(logoPreview || store.logoUrl) ? (
                      <img src={logoPreview || imgUrl(store.logoUrl)!} alt="로고" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-white text-xl font-bold"
                        style={{ backgroundColor: currentTheme.themeColor }}>
                        {(currentBasic.name || store.name || '?')[0]}
                      </div>
                    )}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h2 className="text-lg font-bold" style={{ color: currentTheme.themeColor }}>
                        {currentBasic.name || store.name || '스토어 이름'}
                      </h2>
                      <span
                        className="text-xs px-2 py-0.5 rounded-full font-medium"
                        style={{ backgroundColor: `${currentTheme.themeColor}15`, color: currentTheme.themeColor }}
                      >
                        {currentBasic.isOpen ? '영업중' : '휴무'}
                      </span>
                    </div>
                    <p className="text-sm text-gray-500 mt-0.5 line-clamp-2">
                      {currentBasic.description || store.description || '스토어 소개가 여기에 표시됩니다.'}
                    </p>
                  </div>
                </div>
              </div>

              {/* 팝업 미리보기 오버레이 — 첫 번째 활성 팝업 표시 */}
              {showPopupInPreview && popupList.length > 0 && (() => {
                const firstPopup = popupList.find((p) => p.isActive) || popupList[0];
                const imgSrc = firstPopup?.imageUrl?.startsWith('/') ? `${process.env.NEXT_PUBLIC_API_URL ?? ''}${firstPopup.imageUrl}` : firstPopup?.imageUrl;
                const popupW = firstPopup?.width || 400;
                const currentPopup = { closeType: firstPopup?.closeType };
                return (
                  <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-20 p-4">
                    <div
                      className="bg-white rounded-xl overflow-hidden shadow-2xl relative"
                      style={{ width: Math.min(popupW, 340), maxWidth: '100%' }}
                    >
                      {imgSrc && (
                        <img src={imgSrc} alt="팝업" className="w-full object-contain" />
                      )}
                      {!imgSrc && (
                        <div className="h-48 flex items-center justify-center bg-gray-100">
                          <p className="text-gray-400 text-sm">팝업 이미지</p>
                        </div>
                      )}
                      <div className="p-3 border-t border-gray-100 flex justify-end gap-2">
                        {(currentPopup.closeType === 'hide_week') && (
                          <button type="button" className="text-xs text-gray-400 hover:text-gray-600 px-2 py-1">
                            일주일 동안 보지 않기
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => setShowPopupInPreview(false)}
                          className="text-xs bg-gray-800 text-white px-3 py-1.5 rounded-lg hover:bg-gray-700"
                        >
                          닫기
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* 상품 목록 샘플 */}
              <div className="px-6 py-5">
                <h3 className="text-sm font-semibold mb-4" style={{ color: currentTheme.themeColor }}>
                  상품 목록
                </h3>
                <div className={clsx(
                  currentTheme.layoutType === 'list' ? 'space-y-3' : 'grid gap-3',
                  currentTheme.layoutType === 'grid' && 'grid-cols-2',
                  currentTheme.layoutType === 'magazine' && 'grid-cols-3',
                )}>
                  {[
                    { name: '제주 녹차 프리미엄', price: '28,000원', tag: '베스트' },
                    { name: '우전 세작 선물세트', price: '45,000원', tag: '신상' },
                    { name: '홍차 블렌딩 컬렉션', price: '32,000원', tag: '' },
                    { name: '허브 카모마일 티백', price: '15,000원', tag: '인기' },
                  ].slice(0, currentTheme.layoutType === 'magazine' ? 3 : 4).map((product, i) => (
                    <div
                      key={i}
                      className={clsx(
                        'rounded-xl border overflow-hidden bg-white',
                        currentTheme.layoutType === 'list' && 'flex items-center gap-3 p-3',
                      )}
                      style={{ borderColor: `${currentTheme.themeColor}20` }}
                    >
                      <div
                        className={clsx(
                          'flex items-center justify-center text-white/80 text-2xl shrink-0',
                          currentTheme.layoutType === 'list' ? 'w-14 h-14 rounded-lg' : 'w-full h-28',
                        )}
                        style={{ background: `linear-gradient(135deg, ${currentTheme.themeColor}40, ${currentTheme.accentColor}40)` }}
                      >
                      </div>
                      <div className="p-3 flex-1">
                        {product.tag && (
                          <span
                            className="text-xs px-1.5 py-0.5 rounded font-medium mr-1"
                            style={{ backgroundColor: currentTheme.accentColor, color: 'white' }}
                          >
                            {product.tag}
                          </span>
                        )}
                        <p className="text-sm font-medium text-gray-800 mt-1 line-clamp-1">{product.name}</p>
                        <p className="text-sm font-bold mt-0.5" style={{ color: currentTheme.themeColor }}>
                          {product.price}
                        </p>
                        <button
                          type="button"
                          className="mt-2 w-full py-1.5 rounded-lg text-xs text-white font-medium"
                          style={{ backgroundColor: currentTheme.themeColor }}
                        >
                          담기
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── 팝업 편집 폼 컴포넌트 ────────────────────────────────────────────────────
function PopupForm({
  popupForm, popupImageFile, popupImagePreview, popupImageRef,
  setPopupImageFile, setPopupImagePreview,
  isPending, onSubmit, onCancel, isEdit,
}: {
  popupForm: any;
  popupImageFile: File | null;
  popupImagePreview: string;
  popupImageRef: React.RefObject<HTMLInputElement>;
  setPopupImageFile: (f: File | null) => void;
  setPopupImagePreview: (s: string) => void;
  isPending: boolean;
  onSubmit: (e: React.FormEvent) => void;
  onCancel: () => void;
  isEdit: boolean;
}) {
  const API_URL = process.env.NEXT_PUBLIC_API_URL ?? '';
  const currentPopup = popupForm.watch();

  return (
    <form onSubmit={onSubmit} className="border-2 border-tea-200 rounded-xl p-4 space-y-4 bg-tea-50/30">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-tea-800">{isEdit ? '팝업 수정' : '새 팝업 추가'}</p>
        <button type="button" onClick={onCancel} className="p-1 text-gray-400 hover:text-gray-600">
          <X size={16} />
        </button>
      </div>

      {/* 팝업 활성화 */}
      <label className="flex items-center gap-2 cursor-pointer">
        <input type="checkbox" {...popupForm.register('isActive')} className="w-4 h-4 accent-tea-600" />
        <span className="text-sm text-gray-700">팝업 활성화</span>
      </label>

      {/* 이미지 */}
      <div>
        <label className="label-base">팝업 이미지</label>
        <div
          onClick={() => popupImageRef.current?.click()}
          className="border-2 border-dashed border-gray-200 rounded-xl p-4 text-center cursor-pointer hover:border-tea-300 hover:bg-tea-50 transition-all"
        >
          {popupImagePreview ? (
            <div className="relative inline-block">
              <img src={popupImagePreview} alt="팝업 이미지" className="max-h-40 rounded-lg object-contain mx-auto" />
              <button type="button" onClick={(e) => { e.stopPropagation(); setPopupImageFile(null); setPopupImagePreview(''); }}
                className="absolute top-1 right-1 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center">
                <X size={12} />
              </button>
            </div>
          ) : (
            <div>
              <Upload size={24} className="mx-auto text-gray-300 mb-1" />
              <p className="text-sm text-gray-400">이미지 업로드 (JPG, PNG, GIF)</p>
            </div>
          )}
        </div>
        <input ref={popupImageRef} type="file" accept="image/*" className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) { setPopupImageFile(f); setPopupImagePreview(URL.createObjectURL(f)); } }} />
      </div>

      {/* 팝업 사이즈 */}
      <div>
        <label className="label-base">사이즈</label>
        <div className="grid grid-cols-3 gap-2">
          {[{ label: '소형', w: 300, h: 400 }, { label: '중형', w: 400, h: 500 }, { label: '대형', w: 500, h: 600 }].map((size) => (
            <label key={size.label} className={clsx('flex flex-col items-center p-2.5 rounded-xl border-2 cursor-pointer transition-all text-center',
              currentPopup.width === size.w ? 'border-tea-500 bg-tea-50' : 'border-gray-200 hover:border-tea-300')}>
              <input type="radio" className="sr-only"
                onChange={() => { popupForm.setValue('width', size.w); popupForm.setValue('height', size.h); }}
                checked={currentPopup.width === size.w} />
              <p className="text-xs font-semibold text-gray-800">{size.label}</p>
              <p className="text-xs text-gray-400">{size.w}×{size.h}</p>
            </label>
          ))}
        </div>
      </div>

      {/* 게시 기간 */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label-base">시작일</label>
          <input {...popupForm.register('startAt')} type="date" className="input-base" />
        </div>
        <div>
          <label className="label-base">종료일</label>
          <input {...popupForm.register('endAt')} type="date" className="input-base" />
        </div>
      </div>

      {/* 링크 */}
      <div>
        <label className="label-base">클릭 동작</label>
        <div className="grid grid-cols-2 gap-2 mb-2">
          {[
            { value: false, label: '링크 없음', icon: Unlink },
            { value: true, label: '링크 이동', icon: Link },
          ].map((opt) => (
            <label key={String(opt.value)} className={clsx('flex items-center gap-2 p-2.5 rounded-xl border-2 cursor-pointer transition-all',
              currentPopup.hasLink === opt.value ? 'border-tea-500 bg-tea-50' : 'border-gray-200 hover:border-tea-300')}>
              <input type="radio" className="sr-only" onChange={() => popupForm.setValue('hasLink', opt.value)} checked={currentPopup.hasLink === opt.value} />
              <opt.icon size={15} className={currentPopup.hasLink === opt.value ? 'text-tea-600' : 'text-gray-400'} />
              <span className="text-sm text-gray-700">{opt.label}</span>
            </label>
          ))}
        </div>
        {currentPopup.hasLink && (
          <input {...popupForm.register('linkUrl')} placeholder="https://example.com" className="input-base" />
        )}
      </div>

      {/* 닫기 설정 */}
      <div>
        <label className="label-base">닫기 버튼</label>
        <div className="grid grid-cols-2 gap-2">
          {[
            { value: 'close_only', label: '닫기만' },
            { value: 'hide_week', label: '일주일 안 보기' },
          ].map((opt) => (
            <label key={opt.value} className={clsx('flex items-center gap-2 p-2.5 rounded-xl border-2 cursor-pointer transition-all',
              currentPopup.closeType === opt.value ? 'border-tea-500 bg-tea-50' : 'border-gray-200 hover:border-tea-300')}>
              <input type="radio" {...popupForm.register('closeType')} value={opt.value} className="sr-only" />
              <span className="text-sm text-gray-700">{opt.label}</span>
            </label>
          ))}
        </div>
      </div>

      {/* 미리보기 */}
      {popupImagePreview && (
        <div>
          <label className="label-base">미리보기</label>
          <div className="rounded-xl border border-gray-200 bg-gray-50 p-3 flex justify-center">
            <div className="bg-white rounded-xl overflow-hidden shadow-lg" style={{ width: Math.min((currentPopup.width || 400) * 0.55, 220), maxWidth: '100%' }}>
              <img src={popupImagePreview} alt="미리보기" className="w-full object-contain" />
              <div className="px-2 py-1.5 border-t border-gray-100 flex justify-end gap-2">
                {currentPopup.closeType === 'hide_week' && <span className="text-xs text-gray-400">일주일간 안 보기</span>}
                <span className="text-xs bg-gray-800 text-white px-2 py-0.5 rounded">닫기</span>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="flex gap-2">
        <button type="button" onClick={onCancel} className="btn-secondary flex-1 py-2">취소</button>
        <button type="submit" disabled={isPending} className="btn-primary flex-1 py-2">
          {isPending ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
          {isEdit ? '수정 완료' : '추가하기'}
        </button>
      </div>
    </form>
  );
}
