'use client';

import { useState, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useQuery, useMutation } from '@tanstack/react-query';
import { publicApi, reviewApi } from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import NavBar from '@/components/NavBar';
import toast from 'react-hot-toast';
import { Star, Camera, X, Package, ImagePlus } from 'lucide-react';
import { clsx } from 'clsx';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? '';
const imgUrl = (p?: string | null) => p ? (p.startsWith('/') ? `${API_URL}${p}` : p) : null;

const RATING_TEXT = ['', '아쉬워요', '별로예요', '보통이에요', '만족해요', '최고예요!'];

function ReviewWriteContent() {
  const router = useRouter();
  const params = useSearchParams();
  const productId = params.get('productId') || '';
  const orderId = params.get('orderId') || '';
  const { accessToken } = useAuthStore();

  const [rating, setRating] = useState(0);
  const [content, setContent] = useState('');
  const [images, setImages] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  const { data: product } = useQuery({
    queryKey: ['product', productId],
    queryFn: () => publicApi.getProduct(productId).then(r => r.data.data),
    enabled: !!productId,
  });

  const handleImageAdd = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (images.length + files.length > 5) { toast.error('이미지는 최대 5장까지 가능합니다'); return; }
    setImages(prev => [...prev, ...files]);
    files.forEach(f => { const r = new FileReader(); r.onload = (ev) => setPreviews(prev => [...prev, ev.target?.result as string]); r.readAsDataURL(f); });
    e.target.value = '';
  };

  const removeImage = (idx: number) => {
    setImages(prev => prev.filter((_, i) => i !== idx));
    setPreviews(prev => prev.filter((_, i) => i !== idx));
  };

  const submitMutation = useMutation({
    mutationFn: (fd: FormData) => reviewApi.create(fd, accessToken!),
    onSuccess: (res) => {
      const pts = res.data.reviewPoints;
      toast.success(pts > 0 ? `리뷰가 등록되었습니다! ${pts}P 적립` : '리뷰가 등록되었습니다!');
      router.back();
    },
    onError: (err: any) => toast.error(err?.response?.data?.error || '리뷰 등록 실패'),
  });

  const handleSubmit = () => {
    if (!rating) { toast.error('별점을 선택해주세요'); return; }
    if (content.trim().length < 10) { toast.error('리뷰는 10자 이상 작성해주세요'); return; }
    const fd = new FormData();
    fd.append('productId', productId);
    fd.append('orderId', orderId);
    fd.append('rating', String(rating));
    fd.append('content', content.trim());
    images.forEach(f => fd.append('reviewImages', f));
    submitMutation.mutate(fd);
  };

  if (!accessToken) { router.replace('/auth/login'); return null; }

  const isValid = rating > 0 && content.trim().length >= 10;

  return (
    <div className="min-h-screen bg-gray-50">
      <NavBar title="리뷰 작성" back={true} />

      <div className="max-w-lg mx-auto px-4 py-5 space-y-4 pb-28">

        {/* 상품 정보 카드 */}
        {product && (
          <div className="bg-white rounded-2xl border border-gray-100 p-4 flex gap-3 items-center">
            <div className="w-16 h-16 rounded-xl overflow-hidden bg-gray-100 shrink-0">
              {imgUrl(product.thumbnail) ? (
                <img src={imgUrl(product.thumbnail)!} alt="" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center"><Package size={20} className="text-gray-300" /></div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[11px] text-gray-400">{product.store?.name}</p>
              <p className="text-sm font-semibold text-gray-900 truncate mt-0.5">{product.name}</p>
              <p className="text-sm font-bold text-tea-700 mt-0.5">{product.price?.toLocaleString()}원</p>
            </div>
          </div>
        )}

        {/* 별점 선택 */}
        <div className="bg-white rounded-2xl border border-gray-100 p-6">
          <p className="text-center text-sm font-semibold text-gray-800 mb-4">상품은 만족하셨나요?</p>
          <div className="flex items-center justify-center gap-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <button key={i} onClick={() => setRating(i + 1)}
                className="transition-transform hover:scale-110 active:scale-95">
                <Star size={40} className={clsx(
                  'transition-colors',
                  i < rating ? 'fill-amber-400 text-amber-400' : 'text-gray-200'
                )} />
              </button>
            ))}
          </div>
          {rating > 0 && (
            <p className="text-center text-sm font-medium text-amber-600 mt-3">{RATING_TEXT[rating]}</p>
          )}
          {!rating && <p className="text-center text-xs text-gray-400 mt-3">별을 눌러 평점을 매겨주세요</p>}
        </div>

        {/* 리뷰 내용 */}
        <div className="bg-white rounded-2xl border border-gray-100 p-5">
          <p className="text-sm font-semibold text-gray-800 mb-3">솔직한 리뷰를 남겨주세요</p>
          <textarea
            value={content}
            onChange={e => setContent(e.target.value)}
            placeholder="맛, 향, 포장 상태 등 구매하신 상품에 대해 자유롭게 작성해주세요."
            className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-tea-400 resize-none h-32 bg-gray-50 placeholder:text-gray-400"
          />
          <div className="flex items-center justify-between mt-2">
            <div className="flex items-center gap-1.5">
              <div className={clsx(
                'w-1.5 h-1.5 rounded-full',
                content.length >= 10 ? 'bg-green-500' : 'bg-gray-300'
              )} />
              <span className={clsx('text-xs', content.length >= 10 ? 'text-green-600' : 'text-gray-400')}>
                {content.length >= 10 ? '작성 완료' : `${Math.max(0, 10 - content.length)}자 더 필요`}
              </span>
            </div>
            <span className="text-xs text-gray-400">{content.length}자</span>
          </div>
        </div>

        {/* 사진 첨부 */}
        <div className="bg-white rounded-2xl border border-gray-100 p-5">
          <div className="flex items-center justify-between mb-1">
            <p className="text-sm font-semibold text-gray-800">사진 첨부</p>
            <span className="text-xs text-gray-400">선택 · {images.length}/5장</span>
          </div>
          <p className="text-xs text-tea-600 mb-3">사진을 첨부하면 10P가 추가 적립됩니다</p>

          {previews.length === 0 ? (
            <button onClick={() => fileRef.current?.click()}
              className="w-full py-8 border-2 border-dashed border-gray-200 rounded-xl flex flex-col items-center justify-center text-gray-400 hover:border-tea-400 hover:text-tea-600 hover:bg-tea-50/30 transition-all">
              <ImagePlus size={28} className="mb-2" />
              <p className="text-sm font-medium">사진을 추가해주세요</p>
              <p className="text-xs mt-0.5">상품 사진이 있으면 다른 분들께 도움이 됩니다</p>
            </button>
          ) : (
            <div className="flex gap-2.5 flex-wrap">
              {previews.map((src, i) => (
                <div key={i} className="relative w-[72px] h-[72px] rounded-xl overflow-hidden border border-gray-200 shadow-sm">
                  <img src={src} alt="" className="w-full h-full object-cover" />
                  <button onClick={() => removeImage(i)}
                    className="absolute top-1 right-1 w-5 h-5 bg-black/60 backdrop-blur-sm rounded-full flex items-center justify-center">
                    <X size={10} className="text-white" />
                  </button>
                </div>
              ))}
              {images.length < 5 && (
                <button onClick={() => fileRef.current?.click()}
                  className="w-[72px] h-[72px] rounded-xl border-2 border-dashed border-gray-200 flex flex-col items-center justify-center text-gray-400 hover:border-tea-400 hover:text-tea-600 transition-colors">
                  <Camera size={18} />
                  <span className="text-[10px] mt-0.5 font-medium">{images.length}/5</span>
                </button>
              )}
            </div>
          )}
          <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={handleImageAdd} />
        </div>

        {/* 안내 */}
        <div className="px-1">
          <p className="text-[11px] text-gray-400 leading-relaxed">
            작성된 리뷰는 다른 고객의 구매에 도움이 됩니다. 사진 리뷰 작성 시 추가 포인트가 적립됩니다.
            부적절한 내용(욕설, 비방, 광고 등)은 통보 없이 삭제될 수 있습니다.
          </p>
        </div>
      </div>

      {/* 하단 고정 버튼 */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 px-4 py-3 z-30">
        <div className="max-w-lg mx-auto">
          <button onClick={handleSubmit}
            disabled={submitMutation.isPending || !isValid}
            className={clsx(
              'w-full py-3.5 rounded-xl font-bold text-sm transition-all',
              isValid ? 'bg-tea-600 text-white hover:bg-tea-700 active:scale-[0.98]' : 'bg-gray-200 text-gray-400 cursor-not-allowed'
            )}>
            {submitMutation.isPending ? '등록 중...' : isValid ? '리뷰 등록하기' : '별점과 내용을 입력해주세요'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ReviewPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gray-50 flex items-center justify-center text-gray-400">로딩 중...</div>}>
      <ReviewWriteContent />
    </Suspense>
  );
}
