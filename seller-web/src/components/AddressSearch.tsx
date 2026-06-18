'use client';

import { useEffect } from 'react';
import { Search } from 'lucide-react';

declare global {
  interface Window {
    daum: any;
  }
}

interface Props {
  onSelect: (result: { zipCode: string; address: string }) => void;
  label?: string;
  className?: string;
}

export default function AddressSearch({ onSelect, label = '주소 검색', className = '' }: Props) {
  useEffect(() => {
    if (document.getElementById('daum-postcode-script')) return;
    const script = document.createElement('script');
    script.id = 'daum-postcode-script';
    script.src = 'https://t1.daumcdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js';
    script.async = true;
    document.body.appendChild(script);
  }, []);

  const openSearch = () => {
    if (typeof window === 'undefined' || !window.daum?.Postcode) {
      alert('주소 검색 서비스를 불러오는 중입니다. 잠시 후 다시 시도해주세요.');
      return;
    }
    new window.daum.Postcode({
      oncomplete: (data: any) => {
        let address = data.address;
        if (data.bname && /[동|로|가]$/.test(data.bname)) address += ` (${data.bname})`;
        if (data.buildingName && data.apartment === 'Y') address += ` ${data.buildingName}`;
        onSelect({ zipCode: data.zonecode, address });
      },
      theme: { bgColor: '#2D6A4F', titleColor: '#ffffff' },
    }).open();
  };

  return (
    <button
      type="button"
      onClick={openSearch}
      className={`flex items-center gap-2 px-4 py-2.5 bg-tea-50 border border-tea-200 text-tea-700 rounded-xl text-sm font-medium hover:bg-tea-100 transition-colors ${className}`}
    >
      <Search size={15} />
      {label}
    </button>
  );
}
