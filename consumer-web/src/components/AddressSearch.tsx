'use client';
import { useEffect } from 'react';
import { MapPin } from 'lucide-react';

declare global { interface Window { daum: any } }

interface Props {
  onSelect: (result: { zipCode: string; address: string }) => void;
  className?: string;
}

export default function AddressSearch({ onSelect, className }: Props) {
  useEffect(() => {
    if (document.getElementById('daum-postcode-script')) return;
    const s = document.createElement('script');
    s.id = 'daum-postcode-script';
    s.src = 'https://t1.daumcdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js';
    document.head.appendChild(s);
  }, []);

  const open = () => {
    new window.daum.Postcode({
      oncomplete: (data: any) => {
        onSelect({ zipCode: data.zonecode, address: data.roadAddress || data.jibunAddress });
      },
    }).open();
  };

  return (
    <button type="button" onClick={open}
      className={`flex items-center gap-1.5 px-4 py-2.5 bg-tea-600 text-white text-sm font-medium rounded-xl hover:bg-tea-700 transition-colors ${className}`}>
      <MapPin size={14} /> 주소 검색
    </button>
  );
}
