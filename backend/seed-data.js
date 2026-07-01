const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const p = new PrismaClient();

async function main() {
  const pw = await bcrypt.hash('test1234!', 12);
  const stores = {};

  const existing = await p.seller.findMany({ include: { store: true } });
  for (const s of existing) {
    if (s.store) stores[s.store.name] = s.store.id;
  }

  const newSellers = [
    { email: 'boseong@tea.com', name: '보성다원', storeName: '보성녹차다원', slug: 'boseong-tea', desc: '전남 보성 직영 유기농 녹차 전문점', theme: '#2D6A4F' },
    { email: 'jeju@tea.com', name: '제주티하우스', storeName: '제주 티하우스', slug: 'jeju-tea-house', desc: '제주도 자연에서 키운 프리미엄 차', theme: '#1B4332' },
    { email: 'hadong@tea.com', name: '하동야생차', storeName: '하동 야생차밭', slug: 'hadong-wild-tea', desc: '지리산 하동 야생차 전문', theme: '#4A7C59' },
    { email: 'seoul-tea@tea.com', name: '서울티컴퍼니', storeName: '서울 티 컴퍼니', slug: 'seoul-tea-co', desc: '도시인을 위한 모던 티 브랜드', theme: '#1a1a2e' },
    { email: 'damyang@tea.com', name: '담양죽로차', storeName: '담양 죽로차원', slug: 'damyang-bamboo', desc: '대나무 숲에서 자란 죽로차 전문', theme: '#2b5329' },
    { email: 'mungyeong@tea.com', name: '문경전통차', storeName: '문경 전통찻집', slug: 'mungyeong-tea', desc: '경북 문경 전통 발효차 전문', theme: '#5c3d2e' },
    { email: 'yangpyeong@tea.com', name: '양평허브팜', storeName: '양평 허브팜', slug: 'yangpyeong-herb', desc: '양평 유기농 허브티 전문 농장', theme: '#6b8e23' },
    { email: 'gyeongju@tea.com', name: '경주다례원', storeName: '경주 다례원', slug: 'gyeongju-darye', desc: '천년 고도 경주의 전통 다례 문화', theme: '#8b4513' },
    { email: 'wonju@tea.com', name: '원주치유차', storeName: '원주 치유의 차', slug: 'wonju-healing', desc: '건강과 힐링을 위한 약용차 전문', theme: '#2e8b57' },
    { email: 'jeonju@tea.com', name: '전주한옥차', storeName: '전주 한옥 찻집', slug: 'jeonju-hanok', desc: '한옥마을에서 시작한 전통차 브랜드', theme: '#8b0000' },
    { email: 'gangneung@tea.com', name: '강릉바다차', storeName: '강릉 바다차원', slug: 'gangneung-sea', desc: '동해 해풍을 맞고 자란 차 전문', theme: '#1e3a5f' },
    { email: 'namhae@tea.com', name: '남해보물차', storeName: '남해 보물차밭', slug: 'namhae-treasure', desc: '남해 청정 자연의 보물 같은 차', theme: '#355e3b' },
    { email: 'insadong@tea.com', name: '인사동차문화', storeName: '인사동 차 문화원', slug: 'insadong-tea', desc: '전통과 현대가 만나는 차 문화 공간', theme: '#4a0e4e' },
    { email: 'bukhansan@tea.com', name: '북한산차밭', storeName: '북한산 운무차원', slug: 'bukhansan-cloud', desc: '북한산 자락 운무 속에서 자란 차', theme: '#3a5a40' },
    { email: 'hallasan@tea.com', name: '한라산차밭', storeName: '한라산 차밭', slug: 'hallasan-tea', desc: '한라산 해발 600m 차밭의 프리미엄 차', theme: '#006400' },
    { email: 'suncheon@tea.com', name: '순천만차원', storeName: '순천만 차원', slug: 'suncheon-bay', desc: '순천만 갈대밭 옆 자연 그대로의 차', theme: '#556b2f' },
    { email: 'andong@tea.com', name: '안동전통차', storeName: '안동 전통 약차방', slug: 'andong-herbal', desc: '안동 하회마을 전통 약용차', theme: '#704214' },
    { email: 'yeosu@tea.com', name: '여수밤바다차', storeName: '여수 밤바다 티룸', slug: 'yeosu-night', desc: '여수 바다 향기를 담은 블렌딩 티', theme: '#191970' },
    { email: 'sokcho@tea.com', name: '속초설악차', storeName: '속초 설악 다원', slug: 'sokcho-seorak', desc: '설악산 깊은 산속 야생차', theme: '#2f4f4f' },
    { email: 'tongyeong@tea.com', name: '통영한려차', storeName: '통영 한려 차원', slug: 'tongyeong-tea', desc: '한려수도의 바람과 햇살로 키운 차', theme: '#008080' },
  ];

  for (const ns of newSellers) {
    if (stores[ns.storeName]) continue;
    const ex = await p.seller.findUnique({ where: { email: ns.email } });
    if (ex) {
      const st = await p.store.findFirst({ where: { sellerId: ex.id } });
      if (st) stores[ns.storeName] = st.id;
      continue;
    }
    const seller = await p.seller.create({
      data: { email: ns.email, password: pw, name: ns.name, status: 'APPROVED', approvedAt: new Date() }
    });
    const store = await p.store.create({
      data: { sellerId: seller.id, name: ns.storeName, slug: ns.slug, description: ns.desc, themeColor: ns.theme, isOpen: true, isPublished: true }
    });
    stores[ns.storeName] = store.id;
    console.log('Created store:', ns.storeName);
  }

  console.log('Stores:', Object.keys(stores).length);

  const products = [
    // 보성녹차다원
    { store: '보성녹차다원', name: '유기농 우전', price: 45000, teaType: '녹차', desc: '곡우 전 첫 순만 채취한 최고급 녹차. 감칠맛과 신선한 풀향', aroma: ['VEG','HON','MIN'], flavorSweet: 3, flavorSavory: 4, flavorFresh: 5 },
    { store: '보성녹차다원', name: '보성 세작', price: 22000, teaType: '녹차', desc: '부드럽고 깔끔한 맛의 보성 세작', aroma: ['VEG','FLA','CRE'], flavorSweet: 3, flavorFresh: 4, flavorFloral: 3 },
    { store: '보성녹차다원', name: '덖음 녹차', price: 15000, teaType: '녹차', desc: '전통 방식으로 덖어낸 구수한 녹차', aroma: ['ROA','VEG','MAL'], flavorSavory: 5, flavorNutty: 4 },
    // 제주 티하우스
    { store: '제주 티하우스', name: '제주 감귤홍차', price: 16000, teaType: '홍차', desc: '제주산 감귤 껍질을 블렌딩한 상큼한 홍차', aroma: ['CIT','FRU','SWE'], flavorSweet: 4, flavorFruity: 5, flavorFresh: 3 },
    { store: '제주 티하우스', name: '한라봉 녹차', price: 14000, teaType: '블렌딩', desc: '한라봉의 상큼함과 녹차의 청량감', aroma: ['CIT','VEG','FRU'], flavorFresh: 5, flavorFruity: 4 },
    { store: '제주 티하우스', name: '해풍 녹차', price: 25000, teaType: '녹차', desc: '제주 바다 바람을 맞고 자란 녹차', aroma: ['MAR','MIN','VEG'], flavorFresh: 4, flavorEarthy: 3 },
    // 하동 야생차밭
    { store: '하동 야생차밭', name: '지리산 야생 녹차', price: 35000, teaType: '녹차', desc: '지리산 자생 차나무에서 채취한 야생 녹차', aroma: ['EAR','MIN','COM'], flavorEarthy: 5, flavorBitter: 3 },
    { store: '하동 야생차밭', name: '숙성 보이차', price: 52000, teaType: '보이차', desc: '10년 숙성 운남 보이차. 깊은 복합미', aroma: ['EAR','WOO','COM'], flavorEarthy: 5, flavorSmoky: 3, flavorBitter: 4 },
    { store: '하동 야생차밭', name: '정산소종 훈연 홍차', price: 38000, teaType: '홍차', desc: '소나무 장작으로 훈연한 프리미엄 홍차', aroma: ['SMO','WOO','MAL'], flavorSmoky: 5, flavorBitter: 3, flavorNutty: 3 },
    // 서울 티 컴퍼니
    { store: '서울 티 컴퍼니', name: '얼그레이 시그니처', price: 18000, teaType: '홍차', desc: '베르가못 향이 은은한 시그니처 얼그레이', aroma: ['CIT','FLA','SWE'], flavorFloral: 4, flavorFruity: 3, flavorSweet: 3 },
    { store: '서울 티 컴퍼니', name: '카모마일 릴랙스', price: 13000, teaType: '허브차', desc: '숙면과 안정을 위한 카모마일 블렌드', aroma: ['FLA','SWE','CRE'], flavorFloral: 5, flavorSweet: 4, flavorCreamy: 2 },
    { store: '서울 티 컴퍼니', name: '페퍼민트 리프레시', price: 12000, teaType: '허브차', desc: '상쾌한 페퍼민트로 기분 전환', aroma: ['VEG','CIT','FRU'], flavorFresh: 5, flavorSweet: 1 },
    { store: '서울 티 컴퍼니', name: '루이보스 바닐라', price: 14000, teaType: '허브차', desc: '카페인 없는 루이보스에 바닐라를 더한 달콤한 차', aroma: ['SWE','CRE','HON'], flavorSweet: 5, flavorCreamy: 4 },
    // 담양 죽로차원
    { store: '담양 죽로차원', name: '죽로차 프리미엄', price: 40000, teaType: '녹차', desc: '대나무 이슬을 먹고 자란 죽로차', aroma: ['VEG','MIN','FLA'], flavorFresh: 5, flavorSavory: 3 },
    { store: '담양 죽로차원', name: '대나무잎 블렌드', price: 11000, teaType: '블렌딩', desc: '대나무잎과 녹차의 청량한 조합', aroma: ['VEG','FLA','CIT'], flavorFresh: 4, flavorFloral: 3 },
    // 문경 전통찻집
    { store: '문경 전통찻집', name: '문경 황차', price: 30000, teaType: '우롱차', desc: '전통 방식으로 만든 문경 황차. 꿀향이 특징', aroma: ['HON','FLA','COM'], flavorSweet: 4, flavorFloral: 4 },
    { store: '문경 전통찻집', name: '오미자 발효차', price: 20000, teaType: '블렌딩', desc: '오미자와 발효차의 새콤달콤한 조화', aroma: ['FRU','SWE','SPI'], flavorFruity: 5, flavorSweet: 3 },
    // 양평 허브팜
    { store: '양평 허브팜', name: '라벤더 드림', price: 15000, teaType: '허브차', desc: '양평산 라벤더로 만든 꽃향 가득한 허브티', aroma: ['FLA','SWE','CRE'], flavorFloral: 5, flavorSweet: 3 },
    { store: '양평 허브팜', name: '레몬밤 스트레스 릴리프', price: 13000, teaType: '허브차', desc: '레몬밤과 패션플라워의 안정 블렌드', aroma: ['CIT','FLA','VEG'], flavorFresh: 4, flavorFloral: 3 },
    { store: '양평 허브팜', name: '히비스커스 비타', price: 12000, teaType: '허브차', desc: '새콤한 히비스커스와 로즈힙의 비타민 블렌드', aroma: ['FRU','CIT','SWE'], flavorFruity: 5, flavorSweet: 2, flavorFresh: 4 },
    // 경주 다례원
    { store: '경주 다례원', name: '동방미인 우롱', price: 48000, teaType: '우롱차', desc: '매미가 물어 만든 천연 꿀향의 동방미인', aroma: ['FLA','HON','COM'], flavorFloral: 5, flavorSweet: 4 },
    { store: '경주 다례원', name: '철관음 전통', price: 35000, teaType: '우롱차', desc: '전통 방식의 철관음. 난초향과 광물향', aroma: ['FLA','MIN','COM'], flavorFloral: 5, flavorEarthy: 3, flavorBitter: 2 },
    // 원주 치유의 차
    { store: '원주 치유의 차', name: '생강 대추차', price: 11000, teaType: '블렌딩', desc: '몸을 따뜻하게 하는 생강과 대추의 조합', aroma: ['SPI','SWE','ROA'], flavorSweet: 4, flavorNutty: 3 },
    { store: '원주 치유의 차', name: '쑥차 디톡스', price: 10000, teaType: '허브차', desc: '해독과 건강을 위한 국산 쑥차', aroma: ['VEG','EAR','SPI'], flavorEarthy: 4, flavorBitter: 3 },
    { store: '원주 치유의 차', name: '도라지 배차', price: 13000, teaType: '블렌딩', desc: '목 건강을 위한 도라지와 배의 달콤한 조합', aroma: ['SWE','HON','CRE'], flavorSweet: 5, flavorCreamy: 3 },
    // 전주 한옥 찻집
    { store: '전주 한옥 찻집', name: '매실 녹차', price: 16000, teaType: '블렌딩', desc: '전주산 매실과 녹차의 상큼한 블렌딩', aroma: ['FRU','CIT','VEG'], flavorFruity: 4, flavorFresh: 4 },
    { store: '전주 한옥 찻집', name: '한방 팔보차', price: 18000, teaType: '블렌딩', desc: '8가지 한방 재료의 건강 블렌드', aroma: ['SPI','SWE','ROA'], flavorNutty: 4, flavorSweet: 3, flavorSavory: 3 },
    // 강릉 바다차원
    { store: '강릉 바다차원', name: '동해 해풍 말차', price: 28000, teaType: '말차', desc: '동해 해풍을 맞고 자란 프리미엄 말차', aroma: ['MAR','VEG','CRE'], flavorSavory: 4, flavorCreamy: 3 },
    { store: '강릉 바다차원', name: '솔잎 녹차', price: 15000, teaType: '블렌딩', desc: '소나무 향과 녹차의 청아한 만남', aroma: ['WOO','VEG','MIN'], flavorFresh: 4, flavorEarthy: 3 },
    // 남해 보물차밭
    { store: '남해 보물차밭', name: '남해 홍차 골드', price: 32000, teaType: '홍차', desc: '남해 청정 자연에서 만든 프리미엄 홍차', aroma: ['MAL','HON','FRU'], flavorSweet: 3, flavorNutty: 4 },
    { store: '남해 보물차밭', name: '유자 홍차', price: 17000, teaType: '블렌딩', desc: '남해산 유자와 홍차의 향긋한 블렌딩', aroma: ['CIT','FRU','SWE'], flavorFruity: 5, flavorSweet: 4 },
    // 인사동 차 문화원
    { store: '인사동 차 문화원', name: '대홍포 프리미엄', price: 65000, teaType: '우롱차', desc: '무이산 대홍포. 깊은 암운향과 복합미', aroma: ['MIN','WOO','COM'], flavorEarthy: 5, flavorBitter: 3, flavorSmoky: 2 },
    { store: '인사동 차 문화원', name: '백호은침', price: 55000, teaType: '백차', desc: '최고급 백차. 섬세한 꽃향과 꿀같은 단맛', aroma: ['FLA','HON','SWE'], flavorFloral: 5, flavorSweet: 4 },
    // 북한산 운무차원
    { store: '북한산 운무차원', name: '운무 녹차', price: 30000, teaType: '녹차', desc: '구름 속에서 자란 녹차. 부드러운 감칠맛', aroma: ['VEG','MIN','CRE'], flavorSavory: 4, flavorCreamy: 3 },
    { store: '북한산 운무차원', name: '산야초 블렌드', price: 14000, teaType: '허브차', desc: '북한산 야생 산야초 7종 블렌드', aroma: ['VEG','FLA','EAR'], flavorFresh: 4, flavorFloral: 2 },
    // 한라산 차밭
    { store: '한라산 차밭', name: '한라산 우롱', price: 38000, teaType: '우롱차', desc: '해발 600m에서 재배한 한라산 우롱차', aroma: ['FLA','HON','MIN'], flavorFloral: 4, flavorSweet: 3 },
    { store: '한라산 차밭', name: '감귤피 보이차', price: 42000, teaType: '보이차', desc: '제주 감귤피에 숙성한 보이차', aroma: ['CIT','EAR','COM'], flavorEarthy: 4, flavorFruity: 3, flavorBitter: 3 },
    // 순천만 차원
    { store: '순천만 차원', name: '순천만 발효차', price: 25000, teaType: '홍차', desc: '순천만 자연에서 발효시킨 깊은 맛의 홍차', aroma: ['MAL','EAR','HON'], flavorSavory: 4, flavorSweet: 3 },
    { store: '순천만 차원', name: '갈대차 블렌드', price: 10000, teaType: '허브차', desc: '순천만 갈대와 허브의 자연스러운 블렌드', aroma: ['VEG','MAR','FLA'], flavorFresh: 4, flavorFloral: 2 },
    // 안동 전통 약차방
    { store: '안동 전통 약차방', name: '안동 국화차', price: 14000, teaType: '허브차', desc: '안동 국화꽃으로 만든 향긋한 차', aroma: ['FLA','SWE','VEG'], flavorFloral: 5, flavorSweet: 3 },
    { store: '안동 전통 약차방', name: '마살라 차이', price: 16000, teaType: '블렌딩', desc: '계피, 카다몬, 생강의 매콤한 차이', aroma: ['SPI','SWE','ROA'], flavorSweet: 3, flavorNutty: 3, flavorBitter: 2 },
    // 여수 밤바다 티룸
    { store: '여수 밤바다 티룸', name: '밤바다 블렌드', price: 19000, teaType: '블렌딩', desc: '여수 바다소금과 캐러멜 향의 특별한 홍차', aroma: ['SWE','MAR','CRE'], flavorSweet: 4, flavorCreamy: 4 },
    { store: '여수 밤바다 티룸', name: '동백꽃 홍차', price: 22000, teaType: '홍차', desc: '여수 동백꽃을 더한 우아한 홍차', aroma: ['FLA','HON','MAL'], flavorFloral: 5, flavorSweet: 3 },
    // 속초 설악 다원
    { store: '속초 설악 다원', name: '설악산 야생차', price: 40000, teaType: '녹차', desc: '설악산 깊은 곳에서 채취한 야생 녹차', aroma: ['EAR','MIN','VEG'], flavorEarthy: 4, flavorFresh: 3, flavorBitter: 3 },
    { store: '속초 설악 다원', name: '호지차 로스팅', price: 12000, teaType: '블렌딩', desc: '깊게 볶아낸 고소한 호지차', aroma: ['ROA','MAL','CRE'], flavorNutty: 5, flavorSavory: 4, flavorCreamy: 3 },
    // 통영 한려 차원
    { store: '통영 한려 차원', name: '한려수도 녹차', price: 26000, teaType: '녹차', desc: '한려수도 바람과 햇살로 키운 녹차', aroma: ['MAR','VEG','MIN'], flavorFresh: 4, flavorSavory: 3 },
    { store: '통영 한려 차원', name: '통영 밀크우롱', price: 20000, teaType: '우롱차', desc: '우유같이 부드러운 밀크 우롱차', aroma: ['CRE','HON','FLA'], flavorCreamy: 5, flavorSweet: 4, flavorFloral: 3 },
  ];

  let created = 0;
  for (const prod of products) {
    const storeId = stores[prod.store];
    if (!storeId) { console.log('SKIP - store not found:', prod.store); continue; }
    const ex = await p.product.findFirst({ where: { name: prod.name, storeId } });
    if (ex) { console.log('SKIP - exists:', prod.name); continue; }
    await p.product.create({
      data: {
        storeId, name: prod.name, price: prod.price, teaType: prod.teaType,
        description: prod.desc, aromaProfile: prod.aroma, isActive: true,
        stock: 100, unit: '50g',
        flavorBitter: prod.flavorBitter || null, flavorSweet: prod.flavorSweet || null,
        flavorAstringent: prod.flavorAstringent || null, flavorSavory: prod.flavorSavory || null,
        flavorFloral: prod.flavorFloral || null, flavorFruity: prod.flavorFruity || null,
        flavorNutty: prod.flavorNutty || null, flavorSmoky: prod.flavorSmoky || null,
        flavorEarthy: prod.flavorEarthy || null, flavorFresh: prod.flavorFresh || null,
        flavorCreamy: prod.flavorCreamy || null,
      }
    });
    created++;
    console.log('Created:', prod.name);
  }
  console.log('Total created:', created);
  await p.$disconnect();
}
main().catch(console.error);
