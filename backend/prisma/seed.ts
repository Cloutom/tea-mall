import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🍵 차 쇼핑몰 시드 데이터 생성 중...');

  // 카테고리 생성
  const categories = [
    {
      name: '녹차',
      nameEn: 'Green Tea',
      icon: '🍵',
      order: 1,
      children: ['한국 녹차', '일본 녹차', '말차', '중국 녹차'],
    },
    {
      name: '홍차',
      nameEn: 'Black Tea',
      icon: '🫖',
      order: 2,
      children: ['다르질링', '아쌈', '얼그레이', '잉글리시 브렉퍼스트'],
    },
    {
      name: '백차',
      nameEn: 'White Tea',
      icon: '☁️',
      order: 3,
      children: ['백호은침', '백모단', '공미'],
    },
    {
      name: '우롱차',
      nameEn: 'Oolong Tea',
      icon: '🌿',
      order: 4,
      children: ['철관음', '동방미인', '대만 우롱'],
    },
    {
      name: '보이차',
      nameEn: 'Pu-erh Tea',
      icon: '🍂',
      order: 5,
      children: ['생차', '숙차'],
    },
    {
      name: '허브차',
      nameEn: 'Herbal Tea',
      icon: '🌸',
      order: 6,
      children: ['캐모마일', '라벤더', '페퍼민트', '히비스커스'],
    },
    {
      name: '블렌딩차',
      nameEn: 'Blending Tea',
      icon: '✨',
      order: 7,
      children: ['과일 블렌딩', '플라워 블렌딩'],
    },
    {
      name: '다기/용품',
      nameEn: 'Tea Accessories',
      icon: '🫖',
      order: 8,
      children: ['다관', '찻잔', '다구 세트', '티포트'],
    },
  ];

  for (const cat of categories) {
    const parent = await prisma.category.upsert({
      where: { id: `cat-${cat.nameEn.toLowerCase().replace(/\s/g, '-')}` },
      update: {},
      create: {
        id: `cat-${cat.nameEn.toLowerCase().replace(/\s/g, '-')}`,
        name: cat.name,
        nameEn: cat.nameEn,
        icon: cat.icon,
        order: cat.order,
        isActive: true,
      },
    });

    for (let i = 0; i < cat.children.length; i++) {
      const childId = `cat-${cat.nameEn.toLowerCase().replace(/\s/g, '-')}-${i}`;
      await prisma.category.upsert({
        where: { id: childId },
        update: {},
        create: {
          id: childId,
          name: cat.children[i],
          order: i,
          parentId: parent.id,
          isActive: true,
        },
      });
    }
  }

  console.log('✅ 카테고리 생성 완료!');
  console.log('🎉 시드 데이터 생성 완료!');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
