'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import axios from 'axios';
import Link from 'next/link';
import { Shield, ArrowLeft, Gift, Save, Bell, Phone } from 'lucide-react';


export default function AdminSettingsPage() {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [setting, setSetting] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [adminPhone, setAdminPhone] = useState('');
  const [phoneSaving, setPhoneSaving] = useState(false);
  const [phoneSaved, setPhoneSaved] = useState(false);

  useEffect(() => {
    const t = localStorage.getItem('admin-token');
    if (!t) { router.replace('/admin/login'); return; }
    setToken(t);
  }, [router]);

  useEffect(() => {
    if (!token) return;
    axios.get(`/api/admin/point-setting`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => setSetting(r.data.data))
      .catch(() => setSetting({ minOrderAmount: 10000, earnRate: 1, maxEarnAmount: 5000, minUseAmount: 1000 }));
    axios.get(`/api/admin/profile`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => setAdminPhone(r.data.data?.phone || ''))
      .catch(() => {});
  }, [token]);

  const handlePhoneSave = async () => {
    if (!token) return;
    setPhoneSaving(true); setPhoneSaved(false);
    try {
      await axios.put(`/api/admin/profile/phone`, { phone: adminPhone }, { headers: { Authorization: `Bearer ${token}` } });
      setPhoneSaved(true);
      setTimeout(() => setPhoneSaved(false), 3000);
    } catch {} finally { setPhoneSaving(false); }
  };

  const handleSave = async () => {
    if (!token || !setting) return;
    setSaving(true); setSaved(false);
    try {
      const res = await axios.put(`/api/admin/point-setting`, setting, { headers: { Authorization: `Bearer ${token}` } });
      setSetting(res.data.data); setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch {} finally { setSaving(false); }
  };

  if (!token) return null;

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <header className="bg-gray-800 border-b border-gray-700 px-6 py-4 flex items-center gap-3">
        <Link href="/admin" className="text-gray-400 hover:text-white"><ArrowLeft size={20} /></Link>
        <Shield size={22} className="text-amber-400" />
        <span className="font-bold text-lg">관리자 설정</span>
      </header>

      <main className="max-w-2xl mx-auto px-6 py-8 space-y-6">
        {/* 관리자 알림 설정 */}
        <div className="bg-gray-800 rounded-xl border border-gray-700 p-6 space-y-4">
          <div className="flex items-center gap-2">
            <Bell size={20} className="text-amber-400" />
            <h2 className="font-semibold text-lg">관리자 알림 설정</h2>
          </div>
          <p className="text-xs text-gray-400">아래 이벤트 발생 시 등록된 번호로 SMS가 발송됩니다.<br/>
            - 신규 판매자 가입 승인 요청<br/>
            - 신고 접수<br/>
            - 폐업 신청<br/>
            - 1:1 문의 접수
          </p>
          <div>
            <label className="text-sm text-gray-400 block mb-1">알림 수신 전화번호</label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Phone size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input type="tel" value={adminPhone}
                  onChange={e => setAdminPhone(e.target.value)}
                  placeholder="010-0000-0000"
                  className="w-full bg-gray-700 border border-gray-600 rounded-lg pl-9 pr-3 py-2.5 text-sm text-white placeholder-gray-500" />
              </div>
              <button onClick={handlePhoneSave} disabled={phoneSaving}
                className="px-4 py-2.5 bg-amber-600 hover:bg-amber-700 text-white text-sm font-medium rounded-lg flex items-center gap-1.5 disabled:opacity-50 shrink-0">
                <Save size={14} /> {phoneSaving ? '저장 중...' : '저장'}
              </button>
            </div>
            {phoneSaved && <p className="text-xs text-green-400 mt-1">저장되었습니다.</p>}
            {!adminPhone && <p className="text-xs text-gray-500 mt-1">번호를 입력하지 않으면 알림이 발송되지 않습니다.</p>}
          </div>
        </div>

        {!setting ? (
          <div className="text-center py-16 text-gray-500">로딩 중...</div>
        ) : (
          <div className="bg-gray-800 rounded-xl border border-gray-700 p-6 space-y-5">
            <div className="flex items-center gap-2 mb-2">
              <Gift size={20} className="text-amber-400" />
              <h2 className="font-semibold text-lg">포인트 적립 정책</h2>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm text-gray-400 block mb-1">적립률 (%)</label>
                <input type="number" step="0.1" min="0" max="100" value={setting.earnRate}
                  onChange={e => setSetting({...setting, earnRate: parseFloat(e.target.value) || 0})}
                  className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2.5 text-sm" />
                <p className="text-xs text-gray-500 mt-1">주문 금액의 {setting.earnRate}% 적립</p>
              </div>
              <div>
                <label className="text-sm text-gray-400 block mb-1">최대 적립 포인트</label>
                <input type="number" min="0" value={setting.maxEarnAmount}
                  onChange={e => setSetting({...setting, maxEarnAmount: parseInt(e.target.value) || 0})}
                  className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2.5 text-sm" />
                <p className="text-xs text-gray-500 mt-1">1회 최대 {setting.maxEarnAmount.toLocaleString()}P</p>
              </div>
              <div>
                <label className="text-sm text-gray-400 block mb-1">최소 주문 금액 (적립 조건)</label>
                <input type="number" min="0" value={setting.minOrderAmount}
                  onChange={e => setSetting({...setting, minOrderAmount: parseInt(e.target.value) || 0})}
                  className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2.5 text-sm" />
                <p className="text-xs text-gray-500 mt-1">{setting.minOrderAmount.toLocaleString()}원 이상 주문 시 적립</p>
              </div>
              <div>
                <label className="text-sm text-gray-400 block mb-1">최소 사용 포인트</label>
                <input type="number" min="0" value={setting.minUseAmount}
                  onChange={e => setSetting({...setting, minUseAmount: parseInt(e.target.value) || 0})}
                  className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2.5 text-sm" />
                <p className="text-xs text-gray-500 mt-1">{setting.minUseAmount.toLocaleString()}P 이상부터 사용 가능</p>
              </div>
            </div>

            <div className="bg-gray-700/50 rounded-lg p-4 text-sm text-gray-400">
              <p className="font-medium text-gray-300 mb-1">적용 예시</p>
              <p>30,000원 주문 시 &rarr; {Math.min(Math.round(30000 * setting.earnRate / 100), setting.maxEarnAmount).toLocaleString()}P 적립</p>
              <p>100,000원 주문 시 &rarr; {Math.min(Math.round(100000 * setting.earnRate / 100), setting.maxEarnAmount).toLocaleString()}P 적립</p>
            </div>

            {/* 리뷰 포인트 설정 */}
            <div className="border-t border-gray-700 pt-5 mt-5">
              <div className="flex items-center gap-2 mb-4">
                <Gift size={20} className="text-pink-400" />
                <h2 className="font-semibold text-lg">리뷰 포인트 설정</h2>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="text-sm text-gray-400 block mb-2">적립 방식</label>
                  <div className="flex gap-3">
                    <button onClick={() => setSetting({...setting, reviewPointType: 'fixed'})}
                      className={`flex-1 py-2.5 rounded-lg text-sm font-medium border ${setting.reviewPointType === 'fixed' ? 'bg-amber-600 border-amber-600 text-white' : 'bg-gray-700 border-gray-600 text-gray-400'}`}>
                      고정 금액
                    </button>
                    <button onClick={() => setSetting({...setting, reviewPointType: 'percent'})}
                      className={`flex-1 py-2.5 rounded-lg text-sm font-medium border ${setting.reviewPointType === 'percent' ? 'bg-amber-600 border-amber-600 text-white' : 'bg-gray-700 border-gray-600 text-gray-400'}`}>
                      구매가 대비 %
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  {setting.reviewPointType === 'fixed' ? (
                    <div>
                      <label className="text-sm text-gray-400 block mb-1">텍스트 리뷰 적립 (원)</label>
                      <input type="number" min="0" value={setting.reviewPointFixed ?? 0}
                        onChange={e => setSetting({...setting, reviewPointFixed: parseInt(e.target.value) || 0})}
                        className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2.5 text-sm" />
                      <p className="text-xs text-gray-500 mt-1">리뷰 작성 시 {(setting.reviewPointFixed || 0).toLocaleString()}P 적립</p>
                    </div>
                  ) : (
                    <div>
                      <label className="text-sm text-gray-400 block mb-1">구매가 대비 적립률 (%)</label>
                      <input type="number" step="0.1" min="0" max="100" value={setting.reviewPointRate ?? 0}
                        onChange={e => setSetting({...setting, reviewPointRate: parseFloat(e.target.value) || 0})}
                        className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2.5 text-sm" />
                      <p className="text-xs text-gray-500 mt-1">10,000원 상품 → {Math.round(10000 * (setting.reviewPointRate || 0) / 100).toLocaleString()}P 적립</p>
                    </div>
                  )}
                  <div>
                    <label className="text-sm text-gray-400 block mb-1">사진 리뷰 추가 보너스 (원)</label>
                    <input type="number" min="0" value={setting.reviewPhotoBonus ?? 10}
                      onChange={e => setSetting({...setting, reviewPhotoBonus: parseInt(e.target.value) || 0})}
                      className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2.5 text-sm" />
                    <p className="text-xs text-gray-500 mt-1">사진 첨부 시 추가 {(setting.reviewPhotoBonus ?? 10).toLocaleString()}P</p>
                  </div>
                </div>

                <div className="bg-gray-700/50 rounded-lg p-4 text-sm text-gray-400">
                  <p className="font-medium text-gray-300 mb-1">적립 예시 (10,000원 상품)</p>
                  {setting.reviewPointType === 'fixed' ? (
                    <>
                      <p>텍스트 리뷰: {(setting.reviewPointFixed || 0).toLocaleString()}P</p>
                      <p>사진 리뷰: {((setting.reviewPointFixed || 0) + (setting.reviewPhotoBonus ?? 10)).toLocaleString()}P</p>
                    </>
                  ) : (
                    <>
                      <p>텍스트 리뷰: {Math.round(10000 * (setting.reviewPointRate || 0) / 100).toLocaleString()}P</p>
                      <p>사진 리뷰: {(Math.round(10000 * (setting.reviewPointRate || 0) / 100) + (setting.reviewPhotoBonus ?? 10)).toLocaleString()}P</p>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* 정산 안내 */}
            <div className="border-t border-gray-700 pt-5 mt-5">
              <div className="flex items-center gap-2 mb-4">
                <Gift size={20} className="text-green-400" />
                <h2 className="font-semibold text-lg">정산 안내 문구</h2>
              </div>
              <div>
                <label className="text-sm text-gray-400 block mb-1">판매자 정산 페이지에 표시되는 안내 문구</label>
                <textarea value={setting.settlementNotice || ''} rows={4}
                  onChange={e => setSetting({...setting, settlementNotice: e.target.value})}
                  placeholder="정산은 매월 말일 기준으로 익월 10일에 지급됩니다.&#10;플랫폼 수수료: 3.5% | 결제 수수료: 2%&#10;정산 문의: 고객센터 1588-0000 (평일 9:00~18:00)"
                  className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2.5 text-sm resize-none" />
                <p className="text-xs text-gray-500 mt-1">비워두면 기본 안내 문구가 표시됩니다</p>
              </div>
            </div>

            {/* 수수료 설정 */}
            <div className="border-t border-gray-700 pt-5 mt-5">
              <div className="flex items-center gap-2 mb-4">
                <Gift size={20} className="text-blue-400" />
                <h2 className="font-semibold text-lg">수수료 설정 (전체 기본값)</h2>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm text-gray-400 block mb-1">플랫폼 수수료 (%)</label>
                  <input type="number" step="0.1" min="0" max="50" value={setting.platformFeeRate ?? 3.5}
                    onChange={e => setSetting({...setting, platformFeeRate: parseFloat(e.target.value) || 0})}
                    className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2.5 text-sm" />
                  <p className="text-xs text-gray-500 mt-1">모든 스토어에 적용되는 기본 수수료</p>
                </div>
                <div>
                  <label className="text-sm text-gray-400 block mb-1">결제 수수료 (%)</label>
                  <input type="number" step="0.1" min="0" max="50" value={setting.paymentFeeRate ?? 2.0}
                    onChange={e => setSetting({...setting, paymentFeeRate: parseFloat(e.target.value) || 0})}
                    className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2.5 text-sm" />
                  <p className="text-xs text-gray-500 mt-1">PG사 결제 수수료</p>
                </div>
              </div>
              <div className="bg-gray-700/50 rounded-lg p-4 text-sm text-gray-400 mt-3">
                <p className="font-medium text-gray-300 mb-1">정산 예시 (100,000원 주문)</p>
                <p>플랫폼 수수료: -{Math.round(100000 * (setting.platformFeeRate ?? 3.5) / 100).toLocaleString()}원</p>
                <p>결제 수수료: -{Math.round(100000 * (setting.paymentFeeRate ?? 2) / 100).toLocaleString()}원</p>
                <p className="font-medium text-gray-300 mt-1">판매자 정산: {(100000 - Math.round(100000 * (setting.platformFeeRate ?? 3.5) / 100) - Math.round(100000 * (setting.paymentFeeRate ?? 2) / 100)).toLocaleString()}원</p>
              </div>
              <p className="text-xs text-gray-500 mt-2">* 가게별 개별 수수료는 판매자 관리 페이지에서 설정할 수 있습니다.</p>
            </div>

            <div className="flex items-center gap-3 mt-5">
              <button onClick={handleSave} disabled={saving}
                className="px-5 py-2.5 bg-amber-600 hover:bg-amber-700 text-white font-medium rounded-lg flex items-center gap-2 disabled:opacity-50">
                <Save size={16} /> {saving ? '저장 중...' : '전체 저장'}
              </button>
              {saved && <span className="text-sm text-green-400">저장되었습니다</span>}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

