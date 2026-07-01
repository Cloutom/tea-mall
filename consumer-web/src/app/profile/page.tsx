'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '@/store/authStore';
import { consumerAuthApi } from '@/lib/api';
import NavBar from '@/components/NavBar';
import Link from 'next/link';
import { User, LogOut, MapPin, Fingerprint, Package, Heart, Leaf, Star, Gift, Bell, HelpCircle, ShoppingBag, ChevronRight, Lock as LockIcon, Flag, Edit2, CheckCircle, X } from 'lucide-react';
import toast from 'react-hot-toast';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? '';
const imgUrl = (p?: string | null) => p ? (p.startsWith('/') ? `${API_URL}${p}` : p) : null;

export default function ProfilePage() {
  const router = useRouter();
  const { consumer, accessToken, clearAuth, updateConsumer } = useAuthStore();

  // 닉네임 편집
  const [editNickname, setEditNickname] = useState(false);
  const [nickname, setNickname] = useState('');
  const [nicknameSaving, setNicknameSaving] = useState(false);

  // 전화번호 변경
  const [editPhone, setEditPhone] = useState(false);
  const [phoneStep, setPhoneStep] = useState<'input' | 'verify'>('input');
  const [newPhone, setNewPhone] = useState('');
  const [phoneCode, setPhoneCode] = useState('');
  const [phoneSending, setPhoneSending] = useState(false);
  const [phoneVerifying, setPhoneVerifying] = useState(false);
  const [phoneTimer, setPhoneTimer] = useState(0);

  useEffect(() => {
    if (consumer) setNickname(consumer.nickname || '');
  }, [consumer]);

  useEffect(() => { if (!consumer) router.replace('/auth/login?redirect=%2Fprofile'); }, [consumer, router]);
  if (!consumer) return null;

  const { data: pointData } = useQuery({
    queryKey: ['my-points'], queryFn: () => consumerAuthApi.getPoints(accessToken!).then(r => r.data.data), enabled: !!accessToken,
  });
  const { data: recentViews } = useQuery({
    queryKey: ['recent-views'], queryFn: () => consumerAuthApi.getRecentViews(accessToken!).then(r => r.data.data), enabled: !!accessToken,
  });
  const { data: wishlists } = useQuery({
    queryKey: ['my-wishlists'], queryFn: () => consumerAuthApi.getWishlists(accessToken!).then(r => r.data.data), enabled: !!accessToken,
  });
  const { data: orders } = useQuery({
    queryKey: ['my-orders'], queryFn: () => consumerAuthApi.getMyOrders(accessToken!).then(r => r.data.data), enabled: !!accessToken,
  });

  const handleNicknameSave = async () => {
    if (nickname.trim().length > 20) { toast.error('닉네임은 20자 이하로 입력해주세요.'); return; }
    setNicknameSaving(true);
    try {
      const res = await consumerAuthApi.updateProfile({ nickname: nickname.trim() }, accessToken!);
      updateConsumer({ ...consumer, nickname: res.data.data.nickname });
      toast.success('닉네임이 변경되었습니다.');
      setEditNickname(false);
    } catch (e: any) {
      toast.error(e?.response?.data?.error || '닉네임 변경 실패');
    } finally { setNicknameSaving(false); }
  };

  const handleSendPhoneCode = async () => {
    const formatted = newPhone.replace(/\D/g, '');
    if (formatted.length < 10) { toast.error('올바른 전화번호를 입력해주세요.'); return; }
    setPhoneSending(true);
    try {
      await consumerAuthApi.sendPhoneCode(newPhone);
      setPhoneStep('verify');
      setPhoneTimer(180);
      toast.success('인증번호가 발송되었습니다.');
      const interval = setInterval(() => {
        setPhoneTimer(t => { if (t <= 1) { clearInterval(interval); return 0; } return t - 1; });
      }, 1000);
    } catch (e: any) {
      toast.error(e?.response?.data?.error || '발송 실패');
    } finally { setPhoneSending(false); }
  };

  const handlePhoneVerify = async () => {
    if (!phoneCode || phoneCode.length !== 6) { toast.error('인증번호 6자리를 입력해주세요.'); return; }
    setPhoneVerifying(true);
    try {
      const res = await consumerAuthApi.updatePhone({ phone: newPhone, code: phoneCode }, accessToken!);
      updateConsumer({ ...consumer, phone: res.data.data.phone });
      toast.success('전화번호가 변경되었습니다.');
      setEditPhone(false); setPhoneStep('input'); setNewPhone(''); setPhoneCode('');
    } catch (e: any) {
      toast.error(e?.response?.data?.error || '인증 실패');
    } finally { setPhoneVerifying(false); }
  };

  const handleLogout = async () => {
    try { if (accessToken) await consumerAuthApi.logout(accessToken); } catch {}
    clearAuth(); router.push('/');
  };

  const displayName = consumer.nickname
    ? `${consumer.name} (${consumer.nickname})`
    : consumer.name;

  const recentItems: any[] = recentViews || [];

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <NavBar title="마이페이지" back={true} />

      <div className="max-w-lg mx-auto px-4 py-5 space-y-4">

        {/* 프로필 헤더 */}
        <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-full bg-tea-100 flex items-center justify-center shrink-0">
              <User size={24} className="text-tea-600" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-gray-900 text-lg">{displayName}</p>
              <p className="text-sm text-gray-400">{consumer.email}</p>
            </div>
          </div>

          {/* 이름 (읽기 전용) */}
          <div className="bg-gray-50 rounded-xl p-3 flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-400 mb-0.5">이름</p>
              <p className="text-sm font-medium text-gray-700">{consumer.name}</p>
            </div>
            <p className="text-xs text-gray-400">관리자 문의로만 변경 가능</p>
          </div>

          {/* 닉네임 수정 */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <p className="text-xs text-gray-500">닉네임 <span className="text-gray-400">(선택, 최대 20자)</span></p>
              {!editNickname && (
                <button onClick={() => setEditNickname(true)}
                  className="flex items-center gap-1 text-xs text-tea-600 hover:underline">
                  <Edit2 size={11} /> 변경
                </button>
              )}
            </div>
            {editNickname ? (
              <div className="flex gap-2">
                <input value={nickname} onChange={e => setNickname(e.target.value)}
                  placeholder="닉네임 입력 (비워두면 삭제)"
                  maxLength={20}
                  className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-tea-400" />
                <button onClick={handleNicknameSave} disabled={nicknameSaving}
                  className="px-3 py-2 bg-tea-600 text-white text-xs rounded-xl hover:bg-tea-700 disabled:opacity-50 flex items-center gap-1">
                  <CheckCircle size={13} /> 저장
                </button>
                <button onClick={() => { setEditNickname(false); setNickname(consumer.nickname || ''); }}
                  className="p-2 text-gray-400 hover:text-gray-600">
                  <X size={16} />
                </button>
              </div>
            ) : (
              <p className="text-sm text-gray-700 px-1">
                {consumer.nickname || <span className="text-gray-400">설정 안 함</span>}
              </p>
            )}
          </div>

          {/* 전화번호 변경 */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <p className="text-xs text-gray-500">전화번호</p>
              {!editPhone && (
                <button onClick={() => { setEditPhone(true); setPhoneStep('input'); setNewPhone(''); setPhoneCode(''); }}
                  className="flex items-center gap-1 text-xs text-tea-600 hover:underline">
                  <Edit2 size={11} /> 변경
                </button>
              )}
            </div>

            {!editPhone ? (
              <p className="text-sm text-gray-700 px-1">{consumer.phone || <span className="text-gray-400">등록 안 함</span>}</p>
            ) : (
              <div className="bg-gray-50 rounded-xl p-3 space-y-3">
                {phoneStep === 'input' ? (
                  <>
                    <p className="text-xs text-gray-500">새 전화번호를 입력하고 인증을 진행해주세요.</p>
                    <div className="flex gap-2">
                      <input value={newPhone} onChange={e => setNewPhone(e.target.value)}
                        placeholder="010-0000-0000" type="tel"
                        className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-tea-400" />
                      <button onClick={handleSendPhoneCode} disabled={phoneSending}
                        className="px-3 py-2 bg-tea-600 text-white text-xs rounded-xl hover:bg-tea-700 disabled:opacity-50 whitespace-nowrap">
                        {phoneSending ? '발송 중...' : '인증번호 발송'}
                      </button>
                    </div>
                    <button onClick={() => setEditPhone(false)} className="text-xs text-gray-400 hover:underline">취소</button>
                  </>
                ) : (
                  <>
                    <p className="text-xs text-gray-500">{newPhone}으로 발송된 6자리 인증번호를 입력해주세요.</p>
                    {phoneTimer > 0 && (
                      <p className="text-xs text-amber-600">남은 시간: {Math.floor(phoneTimer / 60)}:{String(phoneTimer % 60).padStart(2, '0')}</p>
                    )}
                    <div className="flex gap-2">
                      <input value={phoneCode} onChange={e => setPhoneCode(e.target.value.replace(/\D/g, ''))}
                        placeholder="인증번호 6자리" maxLength={6} type="text"
                        className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-tea-400 text-center tracking-widest font-mono" />
                      <button onClick={handlePhoneVerify} disabled={phoneVerifying || phoneCode.length !== 6}
                        className="px-3 py-2 bg-tea-600 text-white text-xs rounded-xl hover:bg-tea-700 disabled:opacity-50">
                        {phoneVerifying ? '확인 중...' : '확인'}
                      </button>
                    </div>
                    <div className="flex gap-3">
                      <button onClick={() => setPhoneStep('input')} className="text-xs text-gray-400 hover:underline">번호 재입력</button>
                      <button onClick={() => setEditPhone(false)} className="text-xs text-gray-400 hover:underline">취소</button>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </div>

        {/* 포인트 / 주문 / 찜 / 리뷰 */}
        <div className="grid grid-cols-4 gap-2">
          <Link href="/profile/points" className="bg-white rounded-xl border border-gray-100 p-3 text-center hover:bg-gray-50">
            <p className="text-lg font-bold text-tea-600">{(pointData?.balance || 0).toLocaleString()}</p>
            <p className="text-[10px] text-gray-400 mt-0.5">포인트</p>
          </Link>
          <Link href="/orders" className="bg-white rounded-xl border border-gray-100 p-3 text-center hover:bg-gray-50">
            <p className="text-lg font-bold text-gray-900">{(orders || []).length}</p>
            <p className="text-[10px] text-gray-400 mt-0.5">주문</p>
          </Link>
          <Link href="/profile/wishlists" className="bg-white rounded-xl border border-gray-100 p-3 text-center hover:bg-gray-50">
            <p className="text-lg font-bold text-gray-900">{(wishlists || []).length}</p>
            <p className="text-[10px] text-gray-400 mt-0.5">찜</p>
          </Link>
          <div className="bg-white rounded-xl border border-gray-100 p-3 text-center">
            <p className="text-lg font-bold text-gray-900">0</p>
            <p className="text-[10px] text-gray-400 mt-0.5">쿠폰</p>
          </div>
        </div>

        {/* 차 취향 */}
        <div className="bg-white rounded-2xl border border-gray-100 p-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold text-gray-800 flex items-center gap-1.5"><Leaf size={14} className="text-tea-600" /> 나의 차 취향</h3>
            <Link href="/tea-test" className="text-xs text-tea-600 hover:underline">{consumer.teaProfile ? '재검사' : '검사하기'}</Link>
          </div>
          {consumer.teaProfile ? (
            <div className="flex items-center gap-2">
              {consumer.teaProfile.split('-').map((c: string) => (
                <span key={c} className="text-xs font-bold bg-tea-100 text-tea-700 px-2 py-0.5 rounded-full">{c}</span>
              ))}
            </div>
          ) : (
            <p className="text-xs text-gray-400">취향 검사를 하면 맞춤 추천을 받을 수 있어요</p>
          )}
        </div>

        {/* 최근 본 상품 */}
        {recentItems.length > 0 && (
          <div className="bg-white rounded-2xl border border-gray-100 p-4">
            <h3 className="text-sm font-semibold text-gray-800 mb-3 flex items-center gap-1.5">
              <ShoppingBag size={14} className="text-gray-400" /> 최근 본 상품
            </h3>
            <div className="flex gap-2.5 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
              {recentItems.slice(0, 10).map((v: any) => (
                <Link key={v.id} href={`/store/${v.product.store.slug}/products/${v.product.id}`}
                  className="shrink-0 w-20">
                  <div className="w-20 h-20 rounded-xl overflow-hidden bg-gray-100 mb-1">
                    {imgUrl(v.product.thumbnail) ? <img src={imgUrl(v.product.thumbnail)!} alt="" className="w-full h-full object-cover" /> :
                      <div className="w-full h-full flex items-center justify-center"><ShoppingBag size={16} className="text-gray-300" /></div>}
                  </div>
                  <p className="text-[10px] text-gray-700 truncate">{v.product.name}</p>
                  <p className="text-[10px] font-bold text-gray-900">{v.product.price?.toLocaleString()}원</p>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* 메뉴 */}
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden divide-y divide-gray-50">
          {[
            { href: '/orders', icon: Package, color: 'bg-tea-50 text-tea-600', label: '주문 내역' },
            { href: '/profile/wishlists', icon: Heart, color: 'bg-red-50 text-red-500', label: '찜 목록' },
            { href: '/profile/notifications', icon: Bell, color: 'bg-sky-50 text-sky-500', label: '알림' },
            { href: '/profile/points', icon: Gift, color: 'bg-amber-50 text-amber-600', label: '포인트 내역' },
            { href: '/profile/addresses', icon: MapPin, color: 'bg-blue-50 text-blue-600', label: '배송지 관리' },
            { href: '/profile/billing', icon: Fingerprint, color: 'bg-purple-50 text-purple-600', label: '결제수단 / 지문인증' },
            { href: '/profile/reviews', icon: Star, color: 'bg-amber-50 text-amber-600', label: '내가 쓴 리뷰' },
            { href: '/profile/security', icon: LockIcon, color: 'bg-orange-50 text-orange-600', label: '보안 설정 (비밀번호 변경 / 탈퇴)' },
            { href: '/notices', icon: Bell, color: 'bg-green-50 text-green-600', label: '공지사항' },
            { href: '/profile/inquiries', icon: HelpCircle, color: 'bg-gray-100 text-gray-500', label: '1:1 문의' },
            { href: '/profile/reports', icon: Flag, color: 'bg-red-50 text-red-500', label: '신고 내역' },
          ].map((item) => (
            <Link key={item.label} href={item.href} className="flex items-center justify-between p-3.5 hover:bg-gray-50 transition-colors">
              <div className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${item.color}`}>
                  <item.icon size={15} />
                </div>
                <span className="text-sm font-medium text-gray-800">{item.label}</span>
              </div>
              <ChevronRight size={16} className="text-gray-300" />
            </Link>
          ))}
        </div>

        <button onClick={handleLogout}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl border border-red-100 text-red-500 hover:bg-red-50 transition-colors text-sm font-medium">
          <LogOut size={16} /> 로그아웃
        </button>
      </div>
    </div>
  );
}
