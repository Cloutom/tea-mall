'use client';

import { useState, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useQuery, useMutation } from '@tanstack/react-query';
import { productApi } from '@/lib/api';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import {
  Upload, X, Plus, ChevronLeft, Loader2, Star,
  Package, Thermometer, Leaf, Tag, Percent, Settings2,
} from 'lucide-react';
import Link from 'next/link';
import { clsx } from 'clsx';

const TEA_TYPES = ['녹차', '홍차', '백차', '우롱차', '보이차', '허브차', '블렌딩', '말차', '기타'];
const CAFFEINE_LEVELS = [{ value: 'high', label: '높음' }, { value: 'medium', label: '중간' }, { value: 'low', label: '낮음' }, { value: 'none', label: '없음' }];
const HARVEST_SEASONS = ['우전 (4월 초순 이전)', '세작 (4월 중~하순)', '중작 (5월)', '대작 (6월 이후)', '가을차 (9~10월)', '기타'];
const PROCESSING_METHODS = ['덖음(초제)', '증제(쪄서 건조)', '산화(부분)', '완전산화', '발효(후발효)', '냉동건조', '기타'];
const LIQUID_COLORS = ['연한 노란색', '황금색', '연두색', '올리브색', '진한 갈색', '붉은색', '주홍색', '연한 분홍', '흑갈색'];
const BODY_OPTIONS = [
  { value: 'light', label: '가벼움', desc: '산뜻하고 깔끔함' },
  { value: 'medium', label: '중간',  desc: '균형감 있음' },
  { value: 'full',   label: '진함',  desc: '묵직하고 풍부함' },
];
const AROMA_OPTIONS = ['꽃향', '과일향', '구수한향', '풀향', '스모키', '달콤한향', '민트/청량', '흙향', '나무향', '허브향'];
const RECOMMENDED_TIMES = ['이른 아침', '오전 티타임', '점심 후', '오후 티타임', '저녁', '취침 전', '명상/요가', '독서'];
const FLAVOR_LABELS = [
  { key: 'flavorBitter',     label: '쓴맛',    color: 'bg-gray-600' },
  { key: 'flavorSweet',      label: '단맛',    color: 'bg-amber-400' },
  { key: 'flavorAstringent', label: '떫은맛',  color: 'bg-green-600' },
  { key: 'flavorSavory',     label: '구수한맛', color: 'bg-yellow-600' },
  { key: 'flavorFloral',     label: '꽃향미',  color: 'bg-pink-400' },
];

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? '';
const imgUrl = (p: string) => p?.startsWith('/') ? `${API_URL}${p}` : p;

export default function EditProductPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [thumbnail, setThumbnail] = useState<File | null>(null);
  const [thumbnailPreview, setThumbnailPreview] = useState('');
  const [newImages, setNewImages] = useState<File[]>([]);
  const [newImagePreviews, setNewImagePreviews] = useState<string[]>([]);
  const [existingImages, setExistingImages] = useState<string[]>([]);
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [selectedAromas, setSelectedAromas] = useState<string[]>([]);
  const [selectedTimes, setSelectedTimes] = useState<string[]>([]);
  const [flavors, setFlavors] = useState({ flavorBitter: 0, flavorSweet: 0, flavorAstringent: 0, flavorSavory: 0, flavorFloral: 0 });
  const [initialized, setInitialized] = useState(false);
  const [showCatForm, setShowCatForm] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [newCatIcon, setNewCatIcon] = useState('');
  const thumbnailRef = useRef<HTMLInputElement>(null);
  const imagesRef = useRef<HTMLInputElement>(null);

  const { data: categoriesData } = useQuery({
    queryKey: ['categories'],
    queryFn: () => productApi.getCategories().then((r) => r.data.data),
  });

  const { data: storeCatsData, refetch: refetchStoreCats } = useQuery({
    queryKey: ['store-categories'],
    queryFn: () => productApi.getStoreCategories().then((r) => r.data.data),
  });

  const addCatMutation = useMutation({
    mutationFn: (data: { name: string; icon?: string }) => productApi.createStoreCategory(data),
    onSuccess: () => { refetchStoreCats(); setShowCatForm(false); setNewCatName(''); setNewCatIcon(''); toast.success('카테고리가 추가되었습니다.'); },
    onError: () => toast.error('카테고리 추가에 실패했습니다.'),
  });

  const deleteCatMutation = useMutation({
    mutationFn: (catId: string) => productApi.deleteStoreCategory(catId),
    onSuccess: () => { refetchStoreCats(); toast.success('삭제되었습니다.'); },
  });

  const { register, handleSubmit, formState: { errors }, watch, reset, setValue } = useForm({
    defaultValues: {
      name: '', description: '', price: '', originalPrice: '',
      discountStartAt: '', discountEndAt: '',
      stock: '', unit: '개', weight: '',
      categoryId: '', storeCategoryId: '',
      teaType: '', teaTypeCustom: '', teaOrigin: '', caffeineLevel: '',
      brewingTemp: '', brewingTime: '',
      harvestSeason: '', processingMethod: '', liquidColor: '', body: '',
      isActive: 'true', isSignature: 'false',
      newBadgeDays: '0',
    },
  });

  const watchPrice = watch('price');
  const watchOriginal = watch('originalPrice');
  const watchTeaType = watch('teaType');

  const discountRate = (() => {
    const p = parseFloat(watchPrice);
    const o = parseFloat(watchOriginal);
    if (o > 0 && p > 0 && o > p) return Math.round((o - p) / o * 100);
    return null;
  })();

  const { isLoading } = useQuery({
    queryKey: ['product', id],
    queryFn: async () => {
      const res = await productApi.getProduct(id);
      const p = res.data.data;
      if (!initialized) {
        const fmtDate = (d: string | null) => d ? new Date(d).toISOString().slice(0, 16) : '';
        reset({
          name: p.name || '',
          description: p.description || '',
          price: String(p.price || ''),
          originalPrice: p.originalPrice ? String(p.originalPrice) : '',
          discountStartAt: fmtDate(p.discountStartAt),
          discountEndAt: fmtDate(p.discountEndAt),
          stock: p.stock != null ? String(p.stock) : '',
          unit: p.unit || '개',
          weight: p.weight ? String(p.weight) : '',
          categoryId: p.categoryId || '',
          storeCategoryId: p.storeCategoryId || '',
          teaType: p.teaType || '',
          teaTypeCustom: p.teaTypeCustom || '',
          teaOrigin: p.teaOrigin || '',
          caffeineLevel: p.caffeineLevel || '',
          brewingTemp: p.brewingTemp || '',
          brewingTime: p.brewingTime || '',
          harvestSeason: p.harvestSeason || '',
          processingMethod: p.processingMethod || '',
          liquidColor: p.liquidColor || '',
          body: p.body || '',
          isActive: p.isActive ? 'true' : 'false',
          isSignature: p.isSignature ? 'true' : 'false',
          newBadgeDays: String(p.newBadgeDays ?? 0),
        });
        setThumbnailPreview(p.thumbnail ? imgUrl(p.thumbnail) : '');
        setExistingImages(p.images || []);
        setTags(p.tags || []);
        setSelectedAromas(p.aroma ? p.aroma.split(',').map((a: string) => a.trim()).filter(Boolean) : []);
        setSelectedTimes(p.recommendedTime ? p.recommendedTime.split(',').map((t: string) => t.trim()).filter(Boolean) : []);
        setFlavors({
          flavorBitter: p.flavorBitter ?? 0,
          flavorSweet: p.flavorSweet ?? 0,
          flavorAstringent: p.flavorAstringent ?? 0,
          flavorSavory: p.flavorSavory ?? 0,
          flavorFloral: p.flavorFloral ?? 0,
        });
        setInitialized(true);
      }
      return p;
    },
    enabled: !!id,
    staleTime: 0,
  });

  const updateMutation = useMutation({
    mutationFn: (formData: FormData) => productApi.updateProduct(id, formData),
    onSuccess: () => { toast.success('상품이 수정되었습니다!'); router.push(`/dashboard/products/${id}`); },
    onError: (e: any) => toast.error(e.response?.data?.error || '상품 수정에 실패했습니다.'),
  });

  const onSubmit = (data: any) => {
    if (!data.teaOrigin) { toast.error('원산지를 입력해주세요.'); return; }
    if (!data.harvestSeason) { toast.error('수확 시기를 선택해주세요.'); return; }
    if (!data.processingMethod) { toast.error('가공 방법을 선택해주세요.'); return; }
    if (!data.caffeineLevel) { toast.error('카페인 함량을 선택해주세요.'); return; }
    if (!data.liquidColor) { toast.error('수색을 선택해주세요.'); return; }
    if (!data.body) { toast.error('바디감을 선택해주세요.'); return; }
    if (!data.brewingTemp) { toast.error('권장 물 온도를 입력해주세요.'); return; }
    if (!data.brewingTime) { toast.error('우리는 시간을 입력해주세요.'); return; }
    if (selectedAromas.length === 0) { toast.error('향 특성을 최소 1개 선택해주세요.'); return; }
    if (data.teaType === '기타' && !data.teaTypeCustom) { toast.error('기타 차 종류를 직접 입력해주세요.'); return; }

    const formData = new FormData();
    Object.entries(data).forEach(([k, v]) => { if (v !== undefined && v !== null && v !== '') formData.append(k, String(v)); });
    if (discountRate !== null) formData.append('discountRate', String(discountRate));
    Object.entries(flavors).forEach(([k, v]) => formData.append(k, String(v)));
    if (selectedAromas.length) formData.append('aroma', selectedAromas.join(','));
    if (selectedTimes.length) formData.append('recommendedTime', selectedTimes.join(','));
    if (thumbnail) formData.append('thumbnail', thumbnail);
    newImages.forEach((img) => formData.append('images', img));
    existingImages.forEach((url) => formData.append('existingImages', url));
    tags.forEach((tag) => formData.append('tags', tag));
    updateMutation.mutate(formData);
  };

  const toggleAroma = (a: string) => setSelectedAromas((p) => p.includes(a) ? p.filter((x) => x !== a) : [...p, a]);
  const toggleTime = (t: string) => setSelectedTimes((p) => p.includes(t) ? p.filter((x) => x !== t) : [...p, t]);

  const storeCats: any[] = storeCatsData || [];

  if (isLoading || !initialized) {
    return <div className="flex items-center justify-center h-64"><Loader2 size={28} className="animate-spin text-tea-600" /></div>;
  }

  return (
    <div className="max-w-3xl mx-auto space-y-4 pb-10 px-4 sm:px-0 animate-fade-in">
      <div className="flex items-center gap-3">
        <Link href={`/dashboard/products/${id}`} className="p-2 rounded-lg hover:bg-gray-100 transition-colors shrink-0">
          <ChevronLeft size={20} className="text-gray-600" />
        </Link>
        <div>
          <h1 className="text-lg sm:text-xl font-bold text-gray-900">상품 수정</h1>
          <p className="text-gray-500 text-xs sm:text-sm">상품 정보를 수정하세요</p>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">

        {/* ── 기본 정보 ── */}
        <section className="card space-y-4">
          <h2 className="font-semibold text-gray-900 flex items-center gap-2 text-sm sm:text-base">
            <Package size={17} className="text-tea-600 shrink-0" /> 기본 정보
          </h2>
          <div>
            <label className="label-base">상품명 *</label>
            <input {...register('name', { required: '상품명을 입력해주세요' })} className="input-base" />
            {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name.message as string}</p>}
          </div>
          <div>
            <label className="label-base">상품 설명</label>
            <textarea {...register('description')} className="input-base h-20 resize-none" />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="label-base">글로벌 카테고리</label>
              <select {...register('categoryId')} className="input-base">
                <option value="">카테고리 선택</option>
                {(categoriesData || []).map((cat: any) => (
                  <optgroup key={cat.id} label={cat.name}>
                    {cat.children?.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
                    <option value={cat.id}>{cat.name} (전체)</option>
                  </optgroup>
                ))}
              </select>
            </div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="label-base mb-0">스토어 카테고리</label>
                <button type="button" onClick={() => setShowCatForm((p) => !p)}
                  className="text-xs text-tea-600 hover:underline flex items-center gap-1">
                  <Settings2 size={12} /> 관리
                </button>
              </div>
              <select {...register('storeCategoryId')} className="input-base">
                <option value="">스토어 카테고리 선택</option>
                {storeCats.map((c: any) => <option key={c.id} value={c.id}>{c.icon ? `${c.icon} ` : ''}{c.name}</option>)}
              </select>
              {showCatForm && (
                <div className="mt-2 p-3 bg-gray-50 rounded-xl border border-gray-200 space-y-2">
                  <p className="text-xs font-semibold text-gray-700">스토어 카테고리 관리</p>
                  <div className="flex gap-2">
                    <input value={newCatIcon} onChange={(e) => setNewCatIcon(e.target.value)}
                      placeholder="아이콘" className="input-base w-16 text-center p-2 text-sm" maxLength={4} />
                    <input value={newCatName} onChange={(e) => setNewCatName(e.target.value)}
                      placeholder="카테고리 이름" className="input-base flex-1" />
                    <button type="button" disabled={!newCatName || addCatMutation.isPending}
                      onClick={() => addCatMutation.mutate({ name: newCatName, icon: newCatIcon })}
                      className="btn-primary py-2 px-3 text-sm shrink-0">
                      {addCatMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                    </button>
                  </div>
                  {storeCats.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-1">
                      {storeCats.map((c: any) => (
                        <span key={c.id} className="flex items-center gap-1 bg-white border border-gray-200 text-gray-700 px-2.5 py-1 rounded-full text-xs">
                          {c.icon && <span>{c.icon}</span>}{c.name}
                          <button type="button" onClick={() => deleteCatMutation.mutate(c.id)}><X size={10} className="text-gray-400 hover:text-red-500" /></button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="label-base">차 종류 *</label>
              <select {...register('teaType', { required: '차 종류를 선택해주세요' })} className="input-base">
                <option value="">선택</option>
                {TEA_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
              {errors.teaType && <p className="text-red-500 text-xs mt-1">{errors.teaType.message as string}</p>}
            </div>
            {watchTeaType === '기타' && (
              <div>
                <label className="label-base">차 종류 직접 입력 *</label>
                <input {...register('teaTypeCustom', { required: watchTeaType === '기타' ? '차 종류를 직접 입력해주세요' : false })}
                  placeholder="예: 황차, 청차, 동방미인..." className="input-base" />
                {errors.teaTypeCustom && <p className="text-red-500 text-xs mt-1">{errors.teaTypeCustom.message as string}</p>}
              </div>
            )}
          </div>

          <label className="flex items-start sm:items-center gap-3 p-3 bg-amber-50 border border-amber-200 rounded-xl cursor-pointer hover:bg-amber-100 transition-colors">
            <input type="checkbox" {...register('isSignature')} value="true"
              className="w-4 h-4 mt-0.5 sm:mt-0 accent-amber-500 shrink-0" />
            <div>
              <p className="text-sm font-semibold text-amber-800 flex items-center gap-1.5">
                <Star size={14} className="fill-amber-400 text-amber-400" /> 시그니처 메뉴로 설정
              </p>
              <p className="text-xs text-amber-600 mt-0.5">스토어 대표 상품으로 상단에 표시됩니다</p>
            </div>
          </label>
        </section>

        {/* ── 이미지 ── */}
        <section className="card space-y-4">
          <h2 className="font-semibold text-gray-900 text-sm sm:text-base">상품 이미지</h2>
          <div>
            <label className="label-base">대표 이미지</label>
            <div onClick={() => thumbnailRef.current?.click()}
              className="border-2 border-dashed rounded-xl p-5 text-center cursor-pointer transition-all hover:border-tea-300 hover:bg-tea-50">
              {thumbnailPreview ? (
                <div className="relative inline-block">
                  <img src={thumbnailPreview} alt="" className="h-36 w-36 object-cover rounded-lg mx-auto" />
                  <button type="button" onClick={(e) => { e.stopPropagation(); setThumbnail(null); setThumbnailPreview(''); }}
                    className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center"><X size={12} /></button>
                </div>
              ) : (
                <div><Upload size={28} className="mx-auto text-gray-300 mb-2" /><p className="text-sm text-gray-500">클릭하여 새 이미지 업로드</p></div>
              )}
            </div>
            <input ref={thumbnailRef} type="file" accept="image/*" className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) { setThumbnail(f); setThumbnailPreview(URL.createObjectURL(f)); } }} />
          </div>
          <div>
            <label className="label-base">추가 이미지 (최대 9개)</label>
            <div className="grid grid-cols-4 sm:grid-cols-5 gap-2 sm:gap-3">
              {existingImages.map((url, i) => (
                <div key={`e-${i}`} className="relative aspect-square">
                  <img src={imgUrl(url)} alt="" className="w-full h-full object-cover rounded-lg" />
                  <button type="button" onClick={() => setExistingImages((p) => p.filter((_, idx) => idx !== i))}
                    className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center"><X size={10} /></button>
                </div>
              ))}
              {newImagePreviews.map((p, i) => (
                <div key={`n-${i}`} className="relative aspect-square">
                  <img src={p} alt="" className="w-full h-full object-cover rounded-lg" />
                  <button type="button" onClick={() => { setNewImages((prev) => prev.filter((_, idx) => idx !== i)); setNewImagePreviews((prev) => prev.filter((_, idx) => idx !== i)); }}
                    className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center"><X size={10} /></button>
                </div>
              ))}
              {(existingImages.length + newImagePreviews.length) < 9 && (
                <button type="button" onClick={() => imagesRef.current?.click()}
                  className="aspect-square border-2 border-dashed border-gray-200 rounded-lg flex flex-col items-center justify-center text-gray-400 hover:border-tea-300 transition-colors">
                  <Plus size={18} /><span className="text-xs mt-1">추가</span>
                </button>
              )}
            </div>
            <input ref={imagesRef} type="file" accept="image/*" multiple className="hidden"
              onChange={(e) => {
                const files = Array.from(e.target.files || []);
                if (existingImages.length + newImages.length + files.length > 9) { toast.error('최대 9개'); return; }
                setNewImages((p) => [...p, ...files]);
                setNewImagePreviews((p) => [...p, ...files.map((f) => URL.createObjectURL(f))]);
              }} />
          </div>
        </section>

        {/* ── 가격 & 재고 ── */}
        <section className="card space-y-4">
          <h2 className="font-semibold text-gray-900 text-sm sm:text-base">가격 및 재고</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
            <div>
              <label className="label-base">판매가 * <span className="text-gray-400 font-normal text-xs">(원)</span></label>
              <input {...register('price', { required: '판매가를 입력해주세요' })} type="number" min="0" className="input-base" />
              {errors.price && <p className="text-red-500 text-xs mt-1">{errors.price.message as string}</p>}
            </div>
            <div>
              <label className="label-base">정가 <span className="text-gray-400 font-normal text-xs">(할인 전)</span></label>
              <input {...register('originalPrice')} type="number" min="0" className="input-base" placeholder="0" />
            </div>
            <div>
              <label className="label-base">재고 수량 *</label>
              <input {...register('stock', { required: '재고를 입력해주세요' })} type="number" min="0" className="input-base" />
              {errors.stock && <p className="text-red-500 text-xs mt-1">{errors.stock.message as string}</p>}
            </div>
            <div>
              <label className="label-base">단위</label>
              <select {...register('unit')} className="input-base">
                {['개', 'g', 'kg', 'ml', 'L', '박스', '세트', '봉'].map((u) => <option key={u}>{u}</option>)}
              </select>
            </div>
          </div>

          {discountRate !== null && (
            <div className="flex items-center gap-3 p-3 bg-red-50 border border-red-200 rounded-xl">
              <Percent size={18} className="text-red-500 shrink-0" />
              <div>
                <p className="text-sm font-bold text-red-600">{discountRate}% 할인</p>
                <p className="text-xs text-red-400">
                  정가 {parseInt(watchOriginal).toLocaleString()}원 → 판매가 {parseInt(watchPrice).toLocaleString()}원
                  (절감 {(parseInt(watchOriginal) - parseInt(watchPrice)).toLocaleString()}원)
                </p>
              </div>
            </div>
          )}

          {watchOriginal && parseFloat(watchOriginal) > 0 && (
            <div>
              <label className="label-base flex items-center gap-1.5">
                <Tag size={13} className="text-gray-400" /> 할인 기간 <span className="text-gray-400 font-normal text-xs">(선택)</span>
              </label>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-xs text-gray-400 mb-1">시작일</p>
                  <input {...register('discountStartAt')} type="datetime-local" className="input-base text-sm" />
                </div>
                <div>
                  <p className="text-xs text-gray-400 mb-1">종료일</p>
                  <input {...register('discountEndAt')} type="datetime-local" className="input-base text-sm" />
                </div>
              </div>
            </div>
          )}
        </section>

        {/* ── 차 기본 특성 (필수) ── */}
        <section className="card space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-gray-900 flex items-center gap-2 text-sm sm:text-base">
              <Leaf size={17} className="text-tea-600 shrink-0" /> 차 기본 특성
            </h2>
            <span className="text-xs text-red-500 font-medium bg-red-50 px-2 py-0.5 rounded-full">전체 필수</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="label-base">원산지 *</label>
              <input {...register('teaOrigin', { required: '원산지를 입력해주세요' })} placeholder="예: 전남 보성" className="input-base" />
              {errors.teaOrigin && <p className="text-red-500 text-xs mt-1">{errors.teaOrigin.message as string}</p>}
            </div>
            <div>
              <label className="label-base">수확 시기 *</label>
              <select {...register('harvestSeason', { required: true })} className="input-base">
                <option value="">선택</option>
                {HARVEST_SEASONS.map((h) => <option key={h} value={h}>{h}</option>)}
              </select>
              {errors.harvestSeason && <p className="text-red-500 text-xs mt-1">수확 시기를 선택해주세요</p>}
            </div>
            <div>
              <label className="label-base">가공 방법 *</label>
              <select {...register('processingMethod', { required: true })} className="input-base">
                <option value="">선택</option>
                {PROCESSING_METHODS.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
              {errors.processingMethod && <p className="text-red-500 text-xs mt-1">가공 방법을 선택해주세요</p>}
            </div>
            <div>
              <label className="label-base">카페인 함량 *</label>
              <select {...register('caffeineLevel', { required: true })} className="input-base">
                <option value="">선택</option>
                {CAFFEINE_LEVELS.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}
              </select>
              {errors.caffeineLevel && <p className="text-red-500 text-xs mt-1">카페인 함량을 선택해주세요</p>}
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="label-base">수색 (우린 찻물 색) *</label>
              <div className="grid grid-cols-3 gap-1.5">
                {LIQUID_COLORS.map((c) => (
                  <label key={c} className={clsx('flex items-center gap-1.5 px-2 py-2 rounded-lg border cursor-pointer text-xs transition-all',
                    watch('liquidColor') === c ? 'border-tea-500 bg-tea-50 text-tea-700 font-medium' : 'border-gray-200 text-gray-600 hover:border-tea-300')}>
                    <input type="radio" {...register('liquidColor', { required: true })} value={c} className="sr-only" />
                    {c}
                  </label>
                ))}
              </div>
            </div>
            <div>
              <label className="label-base">바디감 (농도감) *</label>
              <div className="space-y-2">
                {BODY_OPTIONS.map((b) => (
                  <label key={b.value} className={clsx('flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all',
                    watch('body') === b.value ? 'border-tea-500 bg-tea-50' : 'border-gray-200 hover:border-tea-300')}>
                    <input type="radio" {...register('body', { required: true })} value={b.value} className="sr-only" />
                    <div>
                      <p className={clsx('text-sm font-semibold', watch('body') === b.value ? 'text-tea-700' : 'text-gray-800')}>{b.label}</p>
                      <p className="text-xs text-gray-400">{b.desc}</p>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ── 맛·향 프로필 (필수) ── */}
        <section className="card space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-semibold text-gray-900 text-sm sm:text-base">맛 · 향 프로필</h2>
              <p className="text-xs text-gray-400 mt-0.5">강도를 0~5로 설정해주세요</p>
            </div>
            <span className="text-xs text-red-500 font-medium bg-red-50 px-2 py-0.5 rounded-full shrink-0">향 필수</span>
          </div>
          <div className="space-y-3">
            {FLAVOR_LABELS.map((f) => (
              <div key={f.key} className="flex items-center gap-3">
                <span className="text-xs font-medium text-gray-600 w-16 sm:w-20 shrink-0">{f.label}</span>
                <input type="range" min={0} max={5} step={1}
                  value={(flavors as any)[f.key]}
                  onChange={(e) => setFlavors((p) => ({ ...p, [f.key]: Number(e.target.value) }))}
                  className="flex-1 accent-tea-600 h-2" />
                <div className="flex gap-0.5 shrink-0">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className={clsx('w-3 h-3 rounded-sm', i < (flavors as any)[f.key] ? f.color : 'bg-gray-100')} />
                  ))}
                </div>
                <span className="text-xs text-gray-500 w-4 shrink-0">{(flavors as any)[f.key]}</span>
              </div>
            ))}
          </div>
          <div>
            <label className="label-base">향 특성 (필수 — 복수 선택)</label>
            <div className="flex flex-wrap gap-2">
              {AROMA_OPTIONS.map((a) => (
                <button key={a} type="button" onClick={() => toggleAroma(a)}
                  className={clsx('px-3 py-1.5 rounded-full text-xs font-medium border transition-all',
                    selectedAromas.includes(a) ? 'bg-tea-600 text-white border-tea-600' : 'bg-white text-gray-600 border-gray-200 hover:border-tea-400')}>
                  {a}
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* ── 우리기 가이드 (필수) ── */}
        <section className="card space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-gray-900 flex items-center gap-2 text-sm sm:text-base">
              <Thermometer size={17} className="text-tea-600 shrink-0" /> 우리기 가이드
            </h2>
            <span className="text-xs text-red-500 font-medium bg-red-50 px-2 py-0.5 rounded-full">전체 필수</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="label-base">권장 물 온도 *</label>
              <input {...register('brewingTemp', { required: true })} placeholder="예: 70~80°C" className="input-base" />
              {errors.brewingTemp && <p className="text-red-500 text-xs mt-1">권장 물 온도를 입력해주세요</p>}
            </div>
            <div>
              <label className="label-base">우리는 시간 *</label>
              <input {...register('brewingTime', { required: true })} placeholder="예: 2~3분" className="input-base" />
              {errors.brewingTime && <p className="text-red-500 text-xs mt-1">우리는 시간을 입력해주세요</p>}
            </div>
          </div>
          <div>
            <label className="label-base">추천 음용 상황 (복수 선택)</label>
            <div className="flex flex-wrap gap-2">
              {RECOMMENDED_TIMES.map((t) => (
                <button key={t} type="button" onClick={() => toggleTime(t)}
                  className={clsx('px-3 py-1.5 rounded-full text-xs font-medium border transition-all',
                    selectedTimes.includes(t) ? 'bg-tea-600 text-white border-tea-600' : 'bg-white text-gray-600 border-gray-200 hover:border-tea-400')}>
                  {t}
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* ── 태그 ── */}
        <section className="card space-y-3">
          <h2 className="font-semibold text-gray-900 text-sm sm:text-base">태그</h2>
          <div className="flex gap-2">
            <input value={tagInput} onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); const t = tagInput.trim().replace(/^#/, ''); if (t && !tags.includes(t) && tags.length < 10) { setTags((p) => [...p, t]); setTagInput(''); } } }}
              placeholder="태그 입력 후 Enter" className="input-base flex-1" />
            <button type="button" onClick={() => { const t = tagInput.trim().replace(/^#/, ''); if (t && !tags.includes(t) && tags.length < 10) { setTags((p) => [...p, t]); setTagInput(''); } }} className="btn-secondary shrink-0">
              <Plus size={15} />추가
            </button>
          </div>
          {tags.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {tags.map((t) => (
                <span key={t} className="flex items-center gap-1 bg-tea-50 text-tea-700 px-3 py-1 rounded-full text-xs">
                  #{t}<button type="button" onClick={() => setTags((p) => p.filter((x) => x !== t))}><X size={10} /></button>
                </span>
              ))}
            </div>
          )}
        </section>

        {/* ── 게시 설정 ── */}
        <section className="card space-y-4">
          <h2 className="font-semibold text-gray-900 text-sm sm:text-base">게시 설정</h2>
          <div className="flex flex-col sm:flex-row gap-3">
            {[{ value: 'true', label: '판매 중', desc: '소비자에게 노출됨' }, { value: 'false', label: '비공개', desc: '노출 중단' }].map((o) => (
              <label key={o.value} className={clsx('flex items-center gap-3 flex-1 p-3 rounded-xl border-2 cursor-pointer transition-all',
                watch('isActive') === o.value ? 'border-tea-500 bg-tea-50' : 'border-gray-200 hover:border-tea-300')}>
                <input type="radio" {...register('isActive')} value={o.value} className="text-tea-600" />
                <div><p className="text-sm font-medium text-gray-800">{o.label}</p><p className="text-xs text-gray-400">{o.desc}</p></div>
              </label>
            ))}
          </div>

          <div>
            <label className="label-base">신상품 배지 표시 기간</label>
            <p className="text-xs text-gray-400 mb-2">등록일 기준으로 선택한 기간 동안 "신상품" 뱃지가 표시됩니다</p>
            <div className="flex flex-wrap gap-2">
              {[{ value: '0', label: '사용 안함' }, { value: '3', label: '3일' }, { value: '7', label: '7일' }, { value: '14', label: '14일' }, { value: '30', label: '30일' }].map((o) => (
                <label key={o.value} className={clsx('flex items-center gap-2 px-4 py-2 rounded-xl border-2 cursor-pointer transition-all text-sm font-medium',
                  watch('newBadgeDays') === o.value ? 'border-tea-500 bg-tea-50 text-tea-700' : 'border-gray-200 text-gray-600 hover:border-tea-300')}>
                  <input type="radio" {...register('newBadgeDays')} value={o.value} className="sr-only" />
                  {o.label}
                </label>
              ))}
            </div>
          </div>
        </section>

        <div className="flex flex-col sm:flex-row gap-3">
          <Link href={`/dashboard/products/${id}`} className="btn-secondary flex-1 py-3 text-center">취소</Link>
          <button type="submit" disabled={updateMutation.isPending} className="btn-primary flex-1 py-3">
            {updateMutation.isPending ? <Loader2 size={17} className="animate-spin" /> : null}
            {updateMutation.isPending ? '저장 중...' : '변경사항 저장'}
          </button>
        </div>
      </form>
    </div>
  );
}
