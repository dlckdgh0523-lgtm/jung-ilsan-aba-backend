// One-off: 센터장 논문 목록을 GEO 공식 원고 기준으로 DB에 시드한다.
// 관리자페이지 저장과 동일하게 Director(singleton).papers Json을 교체한다 — 코드 하드코딩 아님.
// 실행(Render Shell):  node prisma/seed-director-papers.js
// 기존 papers는 실행 로그에 백업으로 출력된다.
const { PrismaClient } = require('@prisma/client');

const link = (url, label) =>
  `<p><a href="${url}" target="_blank" rel="noopener noreferrer">${label}</a></p>`;

const PAPERS = [
  {
    year: '2026',
    title: '예비 행동분석가를 위한 사회적 조망수용 중심의 행동기술훈련 프로그램 개발 및 적용',
    image: '',
    body:
      '<p>예비 행동분석가가 아동의 시선·정서·의도·지식상태 등 사회적 단서를 보다 정확하게 이해하고 적절한 교수행동을 수행할 수 있도록 행동기술훈련(BST) 프로그램을 개발·적용한 연구입니다. 행동분석 전문가의 사회적 관찰과 판단, 교수 수행 능력을 체계적으로 향상시키는 데 초점을 두었습니다.</p>' +
      '<p>박사학위논문 · 백석대학교 기독교전문대학원 · 2026.06</p>' +
      link('http://www.dcollection.net/handler/bu/200001014735', '원문 보기 (dCollection)'),
  },
  {
    year: '2024',
    title: '행동기술훈련이 자폐 지원 전문가의 개별시도교수 수행 및 자폐스펙트럼장애 아동의 과제 수행에 미치는 효과',
    image: '',
    body:
      '<p>설명, 시범, 역할연습, 수행 피드백으로 구성된 행동기술훈련(BST)이 자폐 지원 전문가의 개별시도교수(DTT) 수행 정확도를 높이고, 아동의 과제 수행 향상으로 이어지는지를 확인한 연구입니다. 전문가를 체계적으로 훈련하는 것이 중재의 질과 아동의 학습성과에 중요함을 보여주었습니다.</p>' +
      '<p>발달장애연구 제28권 제2호, pp. 393–413 · 한국발달장애학회 · KCI 등재 · 2024.06</p>' +
      link('https://doi.org/10.34262/kadd.2024.28.2.19', 'DOI 원문 보기'),
  },
  {
    year: '2024',
    title: '한 음절 카드를 활용한 다중반응교수법이 자폐스펙트럼장애 아동의 텍스츄얼 습득에 미치는 효과',
    image: '',
    body:
      '<p>한 음절 카드를 활용한 체계적인 교수절차를 통해 자폐스펙트럼장애 아동의 문자 읽기와 텍스츄얼 언어행동 습득을 지원한 연구입니다. 반복적인 반응 기회와 촉구, 강화, 오류수정을 활용하여 초기 읽기 학습을 효과적으로 지도하는 방법을 탐색했습니다.</p>' +
      '<p>특수교육연구 제31권 제1호, pp. 56–85 · 국립특수교육원 · KCI 등재 · 2024.04</p>' +
      link('https://doi.org/10.34249/jse.2024.31.1.56', 'DOI 원문 보기'),
  },
  {
    year: '2023',
    title: '화살표 시각 단서를 활용한 개별시도교수가 자폐스펙트럼장애 아동의 반향어에 미치는 효과',
    image: '',
    body:
      '<p>자폐스펙트럼장애 아동에게 화살표 시각 단서와 개별시도교수(DTT)를 적용하여 반향어를 보다 기능적인 언어반응으로 변화시키는 효과를 살펴본 연구입니다. 시각적 단서가 아동의 주의와 적절한 언어반응을 돕는 교수전략으로 활용될 가능성을 제시했습니다.</p>' +
      '<p>행동분석·지원연구 제10권 제2호, pp. 29–47 · 한국행동분석학회 · KCI 등재 · 2023.08</p>' +
      link('https://doi.org/10.22874/kaba.2023.10.2.29', 'DOI 원문 보기'),
  },
  {
    year: '2021',
    title: '개별시도교수 중재 시 과제 선택하기 기법이 자폐스펙트럼장애 아동의 과제 회피행동에 미치는 효과',
    image: '',
    body:
      '<p>개별시도교수 과정에서 아동에게 과제를 선택할 수 있는 기회를 제공했을 때 과제 회피행동과 학습 참여에 어떠한 변화가 나타나는지를 살펴본 연구입니다. 아동의 선택권을 중재에 반영하는 것이 학습 참여와 행동지원에 중요할 수 있음을 다루었습니다.</p>' +
      '<p>행동분석·지원연구 제8권 제2호, pp. 23–45 · 한국행동분석학회 · KCI 등재 · 2021</p>' +
      link('https://doi.org/10.22874/kaba.2021.8.2.23', 'DOI 원문 보기'),
  },
];

async function main() {
  const prisma = new PrismaClient();
  try {
    const current = await prisma.director.findUnique({ where: { id: 'singleton' } });
    if (!current) {
      console.error('실패: director(singleton) 행이 없습니다. 기본 시드가 먼저 필요합니다.');
      process.exitCode = 1;
      return;
    }
    console.log('백업(기존 papers):');
    console.log(JSON.stringify(current.papers));
    await prisma.director.update({
      where: { id: 'singleton' },
      data: { papers: PAPERS },
    });
    console.log(`성공: 센터장 논문 ${PAPERS.length}편으로 교체했습니다 (연도·게재지·DOI 링크 포함).`);
    console.log('홈페이지 새로고침 후 "센터장 논문" 페이지에서 확인하세요.');
  } catch (e) {
    console.error('실패:', e instanceof Error ? e.message : e);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

main();
