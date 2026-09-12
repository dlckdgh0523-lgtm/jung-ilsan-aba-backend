import { PrismaClient } from '@prisma/client';

/**
 * Content-platform seed (categories / tags / FAQ) — SAFE TO RUN ON PRODUCTION,
 * including automatically at container boot (see Dockerfile CMD):
 * each table is seeded ONLY while completely empty, so admin edits and even
 * deletions are never overwritten or resurrected by later runs.
 *
 *   npm run db:seed:content
 */
export async function seedContent(prisma: PrismaClient): Promise<void> {
  const [categoryCount, tagCount] = await Promise.all([
    prisma.articleCategory.count(),
    prisma.tag.count(),
  ]);

  const articleCategories = [
    { slug: 'news', name: '센터 소식', description: '정지은일산ABA의 소식과 일정 안내입니다.' },
    {
      slug: 'aba-info',
      name: 'ABA 전문 정보',
      description: '응용행동분석(ABA)에 대한 전문 정보를 제공합니다.',
    },
    {
      slug: 'parent-edu',
      name: '부모교육 콘텐츠',
      description: '가정에서 활용할 수 있는 부모교육 콘텐츠입니다.',
    },
    {
      slug: 'program-guide',
      name: '프로그램 안내',
      description: '센터 프로그램에 대한 안내입니다.',
    },
  ];
  if (categoryCount === 0) {
    for (const [i, c] of articleCategories.entries()) {
      await prisma.articleCategory.upsert({
        where: { slug: c.slug },
        update: {},
        create: { ...c, order: i },
      });
    }
  }

  const seedTags = [
    {
      slug: 'goyang-aba',
      name: '고양시 ABA',
      tagType: 'LOCATION',
      description: '고양시 지역의 ABA 행동분석 및 행동발달 관련 정보를 제공합니다.',
      seoTitle: '고양시 ABA 정보 | 정지은일산ABA 행동발달센터',
      seoDescription:
        '고양시와 일산 지역 ABA 행동분석 및 행동치료 관련 정보, 부모교육, 프로그램 안내를 제공합니다.',
    },
    {
      slug: 'ilsan-aba',
      name: '일산 ABA',
      tagType: 'LOCATION',
      description: '일산 지역 ABA 치료와 행동발달 지원에 관심 있는 부모님을 위한 정보입니다.',
      seoTitle: '일산 ABA 정보 | 정지은일산ABA 행동발달센터',
      seoDescription:
        '일산 지역 ABA 행동치료, 조기교실, 사회성 프로그램, 부모교육 관련 전문 정보를 제공합니다.',
    },
    {
      slug: 'ilsanseo-aba',
      name: '일산서구 ABA',
      tagType: 'LOCATION',
      description: '일산서구 지역의 ABA 관련 정보입니다.',
    },
    {
      slug: 'autism-spectrum',
      name: '자폐스펙트럼',
      tagType: 'CONDITION',
      description: '자폐스펙트럼장애 아동의 발달과 행동 지원에 대한 정보입니다.',
    },
    {
      slug: 'developmental-delay',
      name: '발달지연',
      tagType: 'CONDITION',
      description: '발달지연 아동을 위한 행동발달 지원 정보입니다.',
    },
    {
      slug: 'behavior-therapy',
      name: '행동치료',
      tagType: 'SERVICE',
      description: 'ABA 기반 행동치료에 대한 정보입니다.',
    },
    {
      slug: 'parent-education',
      name: 'ABA 부모교육',
      tagType: 'SERVICE',
      description: '가정 일반화를 위한 부모교육 관련 콘텐츠입니다.',
    },
    {
      slug: 'social-skills',
      name: '사회성 프로그램',
      tagType: 'SERVICE',
      description: '또래 관계와 사회적 기술 향상을 위한 프로그램 정보입니다.',
    },
    {
      slug: 'communication-training',
      name: '의사소통 훈련',
      tagType: 'TOPIC',
      description: '의사소통이 어려운 아동을 위한 언어행동·의사소통 훈련 정보입니다.',
    },
    {
      slug: 'behavior-intervention',
      name: '문제행동 중재',
      tagType: 'TOPIC',
      description: '문제행동의 기능을 분석하고 대체행동을 가르치는 중재 정보입니다.',
    },
  ];
  if (tagCount === 0) {
    for (const t of seedTags) {
      await prisma.tag.upsert({ where: { slug: t.slug }, update: {}, create: t });
    }
  }

  // Public FAQ — mirrors the FAQPage JSON-LD in the frontend <head>. Seed once, never overwrite.
  const faqCount = await prisma.faqItem.count();
  if (faqCount === 0) {
    await prisma.faqItem.createMany({
      data: [
        {
          question: 'ABA 치료란 무엇인가요?',
          answer:
            'ABA(응용행동분석)는 행동의 원리를 바탕으로 아이의 행동을 관찰·분석하고, 바람직한 행동은 늘리고 어려움은 줄여가는 과학적 근거 기반의 중재 방법입니다. 정지은일산ABA는 아동별 개별화교육계획(IEP)을 수립해 1:1 맞춤 중재를 제공합니다.',
        },
        {
          question: '어떤 아이가 ABA 치료 대상인가요?',
          answer:
            '자폐스펙트럼장애, 발달지연, 의사소통의 어려움, 문제행동, 사회성의 어려움이 있는 아동이 주요 대상입니다. 진단 여부와 관계없이 아이의 발달이 궁금하시다면 초기상담으로 편하게 문의하실 수 있습니다.',
        },
        {
          question: '치료는 몇 살부터 시작할 수 있나요?',
          answer:
            '조기 개입이 빠를수록 효과적이라고 알려져 있습니다. 정지은일산ABA의 조기교실은 만 3–5세 아동의 첫 학습 환경 적응을 돕고, 연령과 발달 수준에 따라 개별 ABA 등 적합한 프로그램을 안내해 드립니다.',
        },
        {
          question: '상담과 치료는 어떤 순서로 진행되나요?',
          answer:
            '초기상담 → 발달평가 → 개별화교육계획(IEP) 수립 → 프로그램 진행(개별 ABA, 조기교실, 사회성 프로그램 등) → 분기 성취도 상담 순으로 진행되며, 필요한 경우 의료기관 및 관련 전문기관과 연계합니다.',
        },
        {
          question: '부모도 함께 참여하나요?',
          answer:
            '네. 센터에서 배운 것이 가정에서도 이어지도록 부모상담·부모교육을 제공하며, 아이의 진행 상황을 부모님과 정기적으로 공유합니다.',
        },
        {
          question: '선생님들은 어떤 자격을 갖추고 있나요?',
          answer:
            '박사 센터장(BCBA-D, QBA, KBA)과 석사 전문 선생님들이 함께하며, 정기적인 슈퍼비전 체계 아래 데이터에 기반한 행동중재를 운영합니다.',
        },
        {
          question: '센터는 어디에 있나요?',
          answer:
            '경기도 고양시 일산서구 주엽로 150 자유프라자 606호(주엽동)에 있습니다. 지하철 3호선 주엽역 인근이며, 운영시간은 평일 09:00–21:00입니다.',
        },
        {
          question: '상담 예약은 어떻게 하나요?',
          answer:
            '홈페이지의 상담 신청, 전화(031-977-2575), 카카오톡 채널을 통해 예약하실 수 있습니다. 비용과 시간 등 자세한 내용은 상담을 통해 안내해 드립니다.',
        },
      ].map((f, i) => ({ ...f, order: i })),
    });
  }

  console.log('Content seed complete: categories/tags upserted, FAQ seeded when empty.');
}

// Standalone runner: npm run db:seed:content
if (require.main === module) {
  const prisma = new PrismaClient();
  seedContent(prisma)
    .catch((err) => {
      console.error(err);
      process.exit(1);
    })
    .finally(() => {
      void prisma.$disconnect();
    });
}
