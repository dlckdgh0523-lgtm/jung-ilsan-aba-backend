/* eslint-disable no-console */
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

// ── Seed content mirrors ui_kits/website/data.js (the real frontend contract) ──

const brand = {
  nameKo: '정지은 일산 ABA',
  nameEn: 'CHUNG ji eun applied behavior analysis',
  tagline: '한 아이의 속도로, 한 걸음씩.',
  address: '경기도 고양시 일산서구 주엽동 18번지 자유프라자 606호',
  phone: '031-977-2575',
  fax: '031-977-2575',
  kakaoId: '@jungjieun_aba',
  hours: '평일 09:00 — 21:00',
  coords: { lat: 37.6707, lng: 126.7547 },
  kakaoMapUrl: 'https://map.kakao.com/?q=경기 고양시 일산서구 주엽로 150',
  naverMapUrl: 'https://map.naver.com/p/search/경기 고양시 일산서구 주엽로 150 606호',
};

const sections = {
  hero: true,
  about: true,
  programs: true,
  therapists: true,
  notices: true,
  gallery: true,
  homemap: true,
  contact: true,
};

const nav = [
  { id: 'about', label: '센터 소개' },
  { id: 'programs', label: '프로그램' },
  { id: 'therapists', label: '치료사 소개' },
  { id: 'notices', label: '공지사항' },
  { id: 'gallery', label: '갤러리' },
  { id: 'contact', label: '상담 문의' },
];

const about = {
  eyebrow: 'ABOUT US',
  title: '정지은 일산 ABA 에서는…',
  lead: ['편안한 마음으로 상담해보세요.', '아이에게 필요한 방향을 함께 고민하겠습니다.'],
  body: [
    '정지은 일산 ABA는 아이의 행동을 단순한 문제로 보지 않습니다.',
    '아이가 왜 그렇게 행동하는지, 무엇을 표현하고 싶은지, 어떤 도움이 필요한지를 분석하고 아이에게 맞는 개별화된 중재를 제공합니다.',
    '본 센터는 박사 센터장과 석사 전문 선생님들이 함께 아동의 발달, 행동, 의사소통, 사회성을 체계적으로 지원합니다.',
    '초기상담과 발달평가를 바탕으로 아동별 개별화교육계획을 수립하고, 정기적인 분기 성취도 상담을 통해 부모님과 함께 아이의 변화를 점검합니다.',
    '필요한 경우 의료기관 및 관련 전문기관과 연계하여 아이의 발달을 보다 종합적으로 이해하고 지원합니다.',
    '정지은 일산 ABA는 센터장, 전문 선생님, 부모님이 한 팀이 되어 아이의 성장을 함께 만들어가는 곳입니다.',
  ],
  values: [
    { ko: '관찰', en: 'Observe', desc: '충분한 관찰에서 모든 중재가 시작됩니다.' },
    { ko: '동행', en: 'Walk with', desc: '부모님이 함께 이해할 수 있도록 매주 공유합니다.' },
    { ko: '근거', en: 'Evidence', desc: 'ABA의 과학적 근거에 기반한 개별 프로그램.' },
  ],
};

// data.js uses `societies`; stored in the `organizations` column, exposed as both by the API.
const director = {
  name: '정지은',
  role: '원장 · BCBA',
  sub: 'QABA 지속교육기관 승인 프로바이더 인증',
  photo: '',
  certifications: [
    { code: 'BCBA', desc: 'Board Certified Behavior Analyst · 국제공인행동분석가' },
    { code: 'QABA®', desc: 'Qualified Applied Behavior Analysis Credentialing Board · 지속교육기관 승인 프로바이더' },
    { code: 'QBA', desc: 'Qualified Behavior Analyst · 국제공인행동분석가' },
    { code: 'KBA', desc: '한국행동분석가 자격취득' },
    { code: 'QBA Board Provider', desc: '본센터 운영기관' },
  ],
  education: ['백석대학교 대학원 응용행동분석 박사수료', '백석대학교 대학원 응용행동분석 석사 졸업', '특수교육학과 학사 졸업'],
  organizations: ['PPOC 한국행동분석학회 정회원', '한국정서행동장애학회 정회원', '발달장애학회 정회원'],
  career: [
    { period: '현', text: 'GDP(Global Doctor’s Prescription) 글로벌 의료 네트워크 — 베네닥터 신경정신과 (ABA분과) 자문위원' },
    { period: '전', text: '넥슨 푸르메 어린이재활병원 ABA행동치료실 치료사' },
    { period: '전', text: '2020 PBS 안성시 긍정적 행동지원 위원단' },
    { period: '전', text: '성남시 한마음복지관 ABA치료실 치료사' },
  ],
  awards: ['백석대학교 총장 공로상 수여'],
  papers: [
    { year: '2020', title: '개별시도교수 중재 시 과제 선택하기 기법이 자폐스펙트럼장애 아동의 회피행동에 미치는 효과' },
    { year: '2023', title: '화살표 시각 단서를 활용한 개별시도교수가 자폐스펙트럼장애 아동의 반향어에 미치는 효과' },
    { year: '2024', title: '한 음절 카드를 활용한 다중반응교수법이 자폐스펙트럼장애 아동의 텍스츄얼 습득에 미치는 효과' },
    { year: '2024', title: '행동기술훈련이 자폐지원 전문가의 개별시도 교수 수행 및 자폐스펙트럼장애 아동의 과제수행에 미치는 효과' },
  ],
  training: [
    'K-Bayley-3 영유아 발달검사 전문가 수련 수료',
    'ADOS-2 자폐스펙트럼 진단·해석 전문가 수련 수료 (한국정신건강심리학회)',
    'CBCL ASEBA 행동군검사 행동중재 프로그램 수료',
    'K-WISC 지능검사 전문가 수련 수료',
    'PECS Level 1 수료',
    'VB-MAPP module 수료 (ABAKOREA)',
    '하남시 수어교육 기본반 수료',
    '인지학습지도사 2급',
    '아동심리 상담사 1급',
    '가족심리 상담사 1급',
    '심리 상담사 1급',
    '부모교육 상담사 1급',
    '분노조절 상담지도사 1급',
    '병원 코디네이터 1급',
    '다문화 심리상담사 1급',
    '다문화가정 복지상담사 1급',
  ],
};

const centerInfo = {
  eyebrow: 'OUR CENTER',
  title: '센터 안내 & 상담 일정',
  sub: 'EIBI 전문 ABA 조기교실 및 개별치료 기관입니다.',
  highlights: [
    { icon: 'calendar', title: '2022년 3월 — 4층 2관 개관', desc: '두 개의 관으로 운영되며 충분한 중재 공간을 갖췄습니다.' },
    { icon: 'eye', title: 'BCBA Observation Room', desc: '일방경 특수유리를 갖춘 관찰실로 부모님과 함께 공유합니다.' },
    { icon: 'users', title: '슈퍼비전 룸 오픈', desc: '치료사의 임상 슈퍼비전 전용 공간을 별도로 운영합니다.' },
    { icon: 'map-pin', title: '1관 503호 · 2관 408호', desc: '상담은 1관 503호로 방문 부탁드립니다.' },
  ],
  earlyClasses: [
    { name: '1부 조기교실', time: '14:00 — 14:20', consult: '10분 상담 포함' },
    { name: '2부 조기교실', time: '16:40 — 19:00', consult: '10분 상담 포함' },
  ],
  individualSessions: [
    { name: '아동 중재', time: '40분', consult: '부모교육 10분' },
    { name: '아동 중재', time: '60분', consult: '부모교육 10분' },
    { name: '아동 중재', time: '90분', consult: '부모교육 10분' },
  ],
  closingNote: '우리 아이들의 발달과 발전을 위해 최선으로 연구하며 노력합니다. 부재 시에는 문자로 문의 주세요 — 중재 중일 수 있습니다.',
};

interface HeroSeed {
  eyebrow: string;
  title: string;
  subtitle: string;
  image: string;
  buttonText: string;
  buttonLink: string;
  buttonText2?: string;
  buttonLink2?: string;
}

const hero: HeroSeed[] = [
  {
    eyebrow: '정지은 일산 ABA',
    title: '아이의 행동을 이해하고,\n가정과 함께 변화를 만들어갑니다.',
    subtitle: '박사 센터장과 석사 전문 선생님들이 함께하는 ABA 전문기관 — 초기상담부터 의료 연계까지 체계적으로 지원합니다.',
    image: '../../assets/photo-reception.jpg',
    buttonText: '무료 상담 예약하기',
    buttonLink: 'contact',
  },
  {
    eyebrow: 'OUR SPACE',
    title: '따뜻한 공간에서\n시작되는 변화',
    subtitle: '아이가 편안함을 느낄 수 있도록, 공간의 결까지 섬세하게 설계했습니다.',
    image: '../../assets/photo-lounge.jpg',
    buttonText: '센터 소개',
    buttonLink: 'about',
    buttonText2: '센터 둘러보기',
    buttonLink2: 'gallery',
  },
  {
    eyebrow: 'PROGRAMS',
    title: '아이의 가능성을\n함께 키워갑니다',
    subtitle: '조기개입부터 사회성 그룹까지 — 아이에게 꼭 맞는 길을 찾아요.',
    image: '../../assets/photo-library.jpg',
    buttonText: '프로그램 보기',
    buttonLink: 'programs',
  },
  {
    eyebrow: '1:1 INTERVENTION',
    title: '전문가와 아이,\n그 사이의 신뢰',
    subtitle: 'BCBA 자격을 갖춘 원장이 직접 관찰하고 설계하는 개별중재 프로그램.',
    image: '../../assets/photo-corridor.jpg',
    buttonText: '치료사 소개',
    buttonLink: 'therapists',
  },
];

interface ProgramSeed {
  title: string;
  ageRange: string;
  photo: string;
  desc: string;
  icon: string;
  tone: string;
  tags: string[];
  meta: string;
  detail: { intro: string; sections: { heading: string; body: string }[] };
}

const programs: ProgramSeed[] = [
  {
    title: '초기상담',
    ageRange: '전 연령',
    photo: '',
    desc: '아이의 발달, 의사소통, 행동 특성, 가정과 기관에서의 어려움을 함께 살펴보고 필요한 중재 방향을 안내합니다.',
    icon: 'message-square',
    tone: 'orange',
    tags: ['첫방문', '센터장 1:1'],
    meta: '센터장 · 1:1 · 약 60분',
    detail: {
      intro: '처음 만나는 자리에서 아이의 발달과 가정에서의 어려움을 함께 살펴보고, 어떤 도움이 필요한지를 정리합니다.',
      sections: [
        { heading: '프로그램 목적', body: '아이의 현재 상태와 가정에서 느끼시는 어려움을 함께 정리하고, 어떤 도움이 필요한지를 명확히 파악합니다.' },
        { heading: '운영 방식', body: '박사 센터장이 부모님과 약 60분간 1:1로 상담합니다. 발달력, 일상 패턴, 관심사, 관찰된 행동을 차근차근 나눕니다.' },
        { heading: '이후 흐름', body: '초기상담 결과를 바탕으로 발달평가와 개별화교육계획(IEP) 수립으로 자연스럽게 이어집니다.' },
      ],
    },
  },
  {
    title: '발달평가',
    ageRange: '전 연령',
    photo: '',
    desc: '아동의 강점과 어려움을 분석하여 개별화교육계획 수립의 기초 자료로 활용합니다.',
    icon: 'clipboard-check',
    tone: 'green',
    tags: ['표준화검사', '행동관찰'],
    meta: '1–2회기 · 종합 결과지 제공',
    detail: {
      intro: '표준화 도구와 직접 관찰을 함께 사용하여 아이의 강점과 어려움을 입체적으로 분석합니다.',
      sections: [
        { heading: '프로그램 목적', body: '아이의 인지, 언어, 사회성, 적응행동, 문제행동 영역별 현재 수준을 객관적으로 파악합니다.' },
        { heading: '운영 방식', body: '1–2회기에 걸쳐 표준화 검사, 행동 관찰, 부모 면담을 조합해 진행하며, 종합 결과지를 제공합니다.' },
        { heading: '활용', body: '이 결과는 개별화교육계획(IEP) 수립의 기초 자료이자 분기 성취도 상담의 비교 기준으로 활용됩니다.' },
      ],
    },
  },
  {
    title: '조기교실',
    ageRange: 'AGES 3–5',
    photo: '../../assets/program-1.png',
    desc: '착석, 지시 따르기, 기다리기, 전환하기, 또래와 함께하기 등 기관 생활에 필요한 기초 기술을 연습합니다.',
    icon: 'sparkles',
    tone: 'orange',
    tags: ['개별중재', '조기개입'],
    meta: '1:1 또는 소그룹 · 주 2–3회 · 각 50분',
    detail: {
      intro: '만 3–5세 아이들이 첫 학습 환경에 부드럽게 적응할 수 있도록 돕는 프로그램입니다.',
      sections: [
        { heading: '프로그램 목적', body: '착석, 지시 따르기, 차례 기다리기, 활동 전환 같은 기관 생활의 기초를 자연스럽게 익힙니다.' },
        { heading: '운영 방식', body: '1:1 또는 소그룹으로 주 2–3회 진행하며, 놀이와 상호작용 안에서 학습 기술을 단계적으로 배웁니다.' },
        { heading: '기대 효과', body: '유치원·어린이집 적응 시기에 또래 안에서 자신감 있게 머무를 수 있는 토대가 자리 잡습니다.' },
      ],
    },
  },
  {
    title: '개별 ABA',
    ageRange: 'AGES 5–9',
    photo: '../../assets/program-2.png',
    desc: '아동의 수준과 목표에 맞춰 의사소통, 학습 준비, 적응행동, 문제행동 대체기술을 체계적으로 지도합니다.',
    icon: 'users',
    tone: 'green',
    tags: ['개별중재', '1:1'],
    meta: '1:1 · 주 1–2회 · 40 / 60 / 90분',
    detail: {
      intro: '치료사와 아이가 1:1로 만나, 개별화 목표에 따라 차근차근 나아갑니다.',
      sections: [
        { heading: '프로그램 목적', body: '아이의 수준과 목표에 맞춘 1:1 중재로 의사소통, 학습 준비, 적응행동, 문제행동의 대체 기술을 다집니다.' },
        { heading: '운영 방식', body: '주 1–2회, 회기당 40·60·90분 중 아이의 집중도에 맞춰 운영하며, 매 회기 데이터 수집과 부모님 공유가 이어집니다.' },
        { heading: '기대 효과', body: '행동의 이유를 함께 이해하고, 가정과 기관에서 일관된 방향으로 변화를 만들어갈 수 있습니다.' },
      ],
    },
  },
  {
    title: '사회성 프로그램',
    ageRange: 'AGES 3–9',
    photo: '../../assets/program-3.png',
    desc: '또래와의 놀이, 차례 지키기, 감정 이해, 사회적 규칙, 조망수용의 기초를 실제 상호작용 안에서 배웁니다.',
    icon: 'message-circle',
    tone: 'yellow',
    tags: ['사회성', '그룹중재'],
    meta: '2–4명 · 주 1회 · 60분',
    detail: {
      intro: '또래와 함께 마음을 나누고, 서로의 속도를 존중하는 연습을 합니다.',
      sections: [
        { heading: '프로그램 목적', body: '또래와 함께 놀이하고, 차례 지키고, 감정을 이해하며, 사회적 규칙과 조망수용의 기초를 익힙니다.' },
        { heading: '운영 방식', body: '2–4명 그룹으로 주 1회 60분, 실제 상호작용 장면을 활용해 자연스럽게 연습합니다.' },
        { heading: '기대 효과', body: '혼자 잘하는 기술을 함께 잘하는 기술로 옮겨 가며, 또래 안에서의 자기 자리를 확인합니다.' },
      ],
    },
  },
  {
    title: '부모상담 · 부모교육',
    ageRange: 'PARENTS',
    photo: '../../assets/program-4.png',
    desc: '부모님과 함께 아이의 변화를 점검하고, 가정에서도 적용 가능한 지도 방법을 안내합니다.',
    icon: 'heart',
    tone: 'green-soft',
    tags: ['부모교육', '주말과정'],
    meta: '월 1회 · 토요일 · 90분',
    detail: {
      intro: '집에서도 이어갈 수 있도록, 부모님의 손에 작은 도구를 쥐어드립니다.',
      sections: [
        { heading: '프로그램 목적', body: '부모님과 함께 아이의 변화를 점검하고, 가정에서 적용 가능한 지도 방법을 안내합니다.' },
        { heading: '운영 방식', body: '월 1회 토요일 90분 진행, 분기 성취도 상담과 연동되어 다음 목표를 함께 결정합니다.' },
        { heading: '기대 효과', body: '센터에서의 변화가 가정에서도 이어지며, 부모님은 관찰자가 아닌 변화의 팀원이 됩니다.' },
      ],
    },
  },
];

interface TherapistSeed {
  name: string;
  role: string;
  photo: string;
  tone: string;
  summary: string;
  education: string[];
  teaching?: string[];
  career: { period: string; text: string }[];
  certifications: string[];
  completion: string;
}

const therapists: TherapistSeed[] = [
  {
    name: '강OO',
    role: '치료사',
    photo: '../../assets/therapist-1.png',
    tone: 'blue',
    summary: '정지은 일산 ABA 개별치료 치료사 · QBA 자격증',
    education: [
      '백석대학교 대학원 응용분석 ABA 석사',
      '대구사이버대학교 미술치료학과 학사',
      'PECS Level 1 Training 수료',
      'BeDevel 걸음마기 아동 행동 발달 선별 척도 workshop 수료',
      'VBMC 101 한글판 VB-MAPP 모듈 과정 이수',
    ],
    teaching: ["동탄 유치원 교직원 및 부모 장애인식개선 교육 '사례를 통한 ABA'"],
    career: [
      { period: '현', text: '정지은 일산 ABA 개별치료 치료사' },
      { period: '현', text: '김포 OO어린이집 PBIS(긍정적행동지원) 담당' },
      { period: '현', text: '경기도 김포 교육지원청 특수교육 대상 행동중재 전문가 (26년 3월~)' },
      { period: '전', text: '이든 ABA 치료센터 조기교실, 개별교실' },
      { period: '전', text: '더힘찬 아동발달 센터 ABA 개별치료, 미술 인지 치료' },
      { period: '전', text: '하늘정원장애전담어린이집 교사' },
    ],
    certifications: [
      'QBA 자격증',
      '사회복지사 자격증 2급 (한국 보육진흥원)',
      '심리상담사 자격증 2급 (한국 심성교육개별원)',
      '한국애니어그램 일반강사 (한국애니어그램연구소)',
      '발달재활 미술재활 제공인력 (한국장애인 개발원)',
      'PCM Practitioner 1 Level (PCMA협회)',
      '장애전담 어린이집 원장 (한국보육진흥원)',
    ],
    completion: '정지은 일산 ABA 프로그램 CA 과정 이수 (Curriculum Academy)',
  },
  {
    name: '김OO',
    role: '치료사',
    photo: '../../assets/therapist-2.png',
    tone: 'blue',
    summary: '정지은 일산 ABA 조기교실 치료사 · 국제 행동분석가 자격(QBA) 과정',
    education: [
      '백석대학교 대학원 응용행동분석 석사',
      '위스콘신대학 대학원 직업재활상담학 석사',
      '위스콘신대학 직업재활상담학 졸업',
      '국제고등학교 졸업',
      '국제 행동분석가 자격 취득(QBA) 과정',
    ],
    career: [
      { period: '현', text: '정지은 일산 ABA 조기교실 치료사' },
      { period: '전', text: 'ABABEARS 치료사' },
      { period: '전', text: 'AURORA COMMUNITY CENER 재활사' },
    ],
    certifications: [
      '레크레이션 지도자 1급 (한국청소년활동진흥원)',
      '청소년 학습 코칭 3급 (한국 코칭심리협회)',
      '아동상담전문과 기초과정 수료',
    ],
    completion: '정지은 일산 ABA 프로그램 CA 과정 이수 (Curriculum Academy)',
  },
  {
    name: '강OO',
    role: '치료사',
    photo: '../../assets/therapist-3.png',
    tone: 'blue',
    summary: '정지은 일산 ABA 조기교실 치료사 · QASP-S 과정 중',
    education: ['대구사이버대학교 행동치료학과 재학', '사회복지과 전문학사', 'QASP-S 과정 중'],
    career: [
      { period: '현', text: '정지은 일산 ABA 조기교실 치료사' },
      { period: '전', text: 'ABABEARS 치료사' },
      { period: '전', text: '예사랑어린이집 교사' },
      { period: '전', text: '화정세빛어린이집 교사' },
      { period: '전', text: '해달별 어린이집 교사' },
      { period: '전', text: '예일 몬테소리 어린이집 교사' },
    ],
    certifications: ['사회복지사 2급 자격증 (보건복지부)', '보육교사 2급 자격증 (보건복지부)', '요양보호사 자격증'],
    completion: '정지은 일산 ABA 프로그램 CA 과정 이수 (Curriculum Academy)',
  },
  {
    name: '김OO',
    role: '치료사',
    photo: '../../assets/therapist-4.png',
    tone: 'blue',
    summary: '정지은 일산 ABA 조기교실 치료사 · 국제 행동분석가 자격(QBA) 과정',
    education: ['중부대학교 중등특수교육학과', '중부대학교 휴먼택대학원 심리행동치료학과 석사', '국제 행동분석가 자격 취득(QBA) 과정'],
    career: [
      { period: '현', text: '정지은 일산 ABA 조기교실 치료사' },
      { period: '전', text: '새얼학교 진로와 직업 / 공예과목 담당 교사' },
      { period: '전', text: '명현학교 ‘특수교육연구회’ "울어?웃어?이건뭐지?" 그림작가' },
    ],
    certifications: [
      '특수학교 중등 종교사 2급 일반사회 (교육부장관)',
      '미술심리상담지도사 1급 (한국직업평가진흥협회)',
      '방과후돌봄교실지도사 1급 (한국직업평가진흥협회)',
      '애니어그램분석사 1급 (한국심리교육협회)',
    ],
    completion: '정지은 일산 ABA 프로그램 CA 과정 이수 (Curriculum Academy)',
  },
  {
    name: '이OO',
    role: '치료사',
    photo: '../../assets/therapist-5.png',
    tone: 'blue',
    summary: '정지은 일산 ABA 개별치료 치료사 · 어린이집·유치원 순회 체육교사',
    education: [
      '건양사이버대학교 심리운동치료학과 졸업',
      '건양사이버대학교 행동발달치료학과 졸업',
      '영문학 학사 취득',
      'QASP-S 과정 중',
    ],
    career: [
      { period: '현', text: '정지은 일산 ABA 개별치료 치료사' },
      { period: '현', text: '어린이집 순회 체육교사' },
      { period: '현', text: '유치원 순회 체육교사' },
    ],
    certifications: ['심리체육발달 재활서비스 제공인력 자격증 (보건복지부)', '행동발달재활서비스 제공인력 자격증 (보건복지부)'],
    completion: '정지은 일산 ABA 프로그램 CA 과정 이수 (Curriculum Academy)',
  },
];

const notices = [
  {
    pinned: true,
    title: '2026년 봄학기 신규 상담 안내',
    date: '2026.05.18',
    views: 412,
    body: '2026년 봄학기 신규 상담을 시작합니다.\n\n조기교실(만 3–5세) · 개별치료 · 사회성 짝치료 모두 모집 중이며, 상담 신청 후 2영업일 내 회신 드립니다. 문의는 카카오톡 또는 전화로 부탁드립니다.',
  },
  {
    pinned: false,
    title: '5월 부모교육 워크숍 일정',
    date: '2026.05.12',
    views: 188,
    body: "5월 부모교육 워크숍이 토요일 오후 2시–3시 30분에 진행됩니다. 주제는 '가정에서 이어가는 ABA 강화 전략'입니다. 부모님 1인 참여 무료, 사전 예약 부탁드립니다.",
  },
  {
    pinned: false,
    title: '정지은 BCBA 학회 발표 후기',
    date: '2026.04.28',
    views: 264,
    body: "정지은 원장이 한국행동분석학회 춘계학술대회에서 'EIBI 환경 설계와 부모 참여'를 주제로 발표했습니다. 발표 자료는 부모님 요청 시 PDF로 공유 가능합니다.",
  },
  {
    pinned: false,
    title: '어린이날 — 기관 휴무 안내',
    date: '2026.04.20',
    views: 96,
    body: '5월 5일(어린이날) 정기 휴무로 모든 회기가 운영되지 않습니다. 이후 회기는 정상 진행되며, 일정 변경이 필요하신 분은 미리 연락 부탁드립니다.',
  },
  {
    pinned: false,
    title: '2026 봄학기 그룹 모집 마감',
    date: '2026.04.10',
    views: 322,
    body: '2026 봄학기 사회성 짝치료 그룹 모집이 마감되었습니다. 다음 학기(여름) 모집은 6월 중순부터 시작되며, 사전 대기 등록은 언제든 가능합니다.',
  },
];

const gallery = [
  { src: '../../assets/photo-reception.jpg', title: '리셉션', span: 2 },
  { src: '../../assets/photo-lounge.jpg', title: '부모 라운지', span: 1 },
  { src: '../../assets/photo-library.jpg', title: '도서 코너', span: 1 },
  { src: '../../assets/photo-corridor.jpg', title: '복도 · 중재실 입구', span: 2 },
  { src: '../../assets/photo-lounge.jpg', title: '오픈 플레이', span: 1 },
  { src: '../../assets/photo-library.jpg', title: '독서 시간', span: 1 },
];

const popups = [
  {
    title: '2026 봄학기 신규 상담 안내',
    content: '조기교실·개별치료·사회성 짝치료 신규 상담을 받고 있습니다.\n카카오톡 채널 또는 전화로 편하게 문의해 주세요.',
    imageUrl: '../../assets/photo-reception.jpg',
    linkUrl: '#contact',
    startAt: '2026-05-01',
    endAt: '2026-12-31',
    isActive: true,
    allowHideToday: true,
  },
];

const today = new Date().toISOString().slice(0, 10);

const privacyPolicy = `# 개인정보처리방침\n\n정지은 일산 ABA(이하 “센터”)는 「개인정보 보호법」을 준수하며, 정보주체의 개인정보를 보호하기 위해 다음과 같이 처리방침을 둡니다.\n\n## 1. 수집하는 개인정보 항목\n- 필수: 보호자 성명, 연락처, 상담 내용\n- 선택: 이메일, 아동 연령·진단 정보\n\n## 2. 수집 및 이용 목적\n- 상담 신청 접수 및 회신\n- 발달평가 및 개별화교육계획 수립\n\n## 3. 보유 및 이용 기간\n- 상담 종료 후 3년간 보관 후 파기\n\n## 4. 제3자 제공\n- 원칙적으로 제3자에게 제공하지 않으며, 의료기관 연계 시 사전 동의를 받습니다.\n\n## 5. 정보주체의 권리\n- 열람·정정·삭제·처리정지 요구 가능\n\n> [관리자 페이지에서 센터의 실제 방침으로 교체하세요.]`;

const privacyConsent = `# 개인정보 수집·이용 동의서\n\n정지은 일산 ABA는 상담 신청 처리를 위해 아래와 같이 개인정보를 수집·이용합니다.\n\n- 수집 항목: 보호자 성명, 연락처, (선택) 이메일·아동 정보·상담 내용\n- 이용 목적: 상담 접수 및 회신, 발달 지원 안내\n- 보유 기간: 상담 종료 후 3년\n\n위 내용을 확인하였으며 개인정보 수집·이용에 동의합니다.\n\n> [관리자 페이지에서 센터의 실제 동의서로 교체하세요.]`;

async function main(): Promise<void> {
  // Admin user (create if absent; never overwrite a changed password)
  const username = process.env.ADMIN_DEFAULT_USERNAME ?? 'admin';
  const password = process.env.ADMIN_DEFAULT_PASSWORD ?? 'aba1234';
  const passwordHash = await bcrypt.hash(password, 10);
  await prisma.adminUser.upsert({
    where: { username },
    update: {},
    create: { username, passwordHash, role: 'admin' },
  });

  // Singletons
  await prisma.siteSetting.upsert({
    where: { id: 'singleton' },
    update: { brand, sections },
    create: { id: 'singleton', brand, sections },
  });
  await prisma.about.upsert({ where: { id: 'singleton' }, update: about, create: { id: 'singleton', ...about } });
  await prisma.director.upsert({ where: { id: 'singleton' }, update: director, create: { id: 'singleton', ...director } });
  await prisma.centerInfo.upsert({ where: { id: 'singleton' }, update: centerInfo, create: { id: 'singleton', ...centerInfo } });

  // Nav (reset to seed order)
  await prisma.navItem.deleteMany({});
  await prisma.navItem.createMany({ data: nav.map((n, i) => ({ id: n.id, label: n.label, order: i, visible: true })) });

  // Ordered collections (reset to seed)
  await prisma.heroSlide.deleteMany({});
  await prisma.heroSlide.createMany({
    data: hero.map((h, i) => ({
      eyebrow: h.eyebrow,
      title: h.title,
      subtitle: h.subtitle,
      image: h.image,
      buttonText: h.buttonText,
      buttonLink: h.buttonLink,
      buttonText2: h.buttonText2 ?? null,
      buttonLink2: h.buttonLink2 ?? null,
      order: i,
    })),
  });

  await prisma.program.deleteMany({});
  await prisma.program.createMany({
    data: programs.map((p, i) => ({
      title: p.title,
      ageRange: p.ageRange,
      photo: p.photo,
      desc: p.desc,
      icon: p.icon,
      tone: p.tone,
      tags: p.tags,
      meta: p.meta,
      detail: p.detail,
      order: i,
    })),
  });

  await prisma.therapist.deleteMany({});
  await prisma.therapist.createMany({
    data: therapists.map((t, i) => ({
      name: t.name,
      role: t.role,
      photo: t.photo,
      tone: t.tone,
      summary: t.summary,
      education: t.education,
      teaching: t.teaching ?? [],
      career: t.career,
      certifications: t.certifications,
      completion: t.completion,
      order: i,
    })),
  });

  await prisma.notice.deleteMany({});
  await prisma.notice.createMany({
    data: notices.map((n, i) => ({
      title: n.title,
      body: n.body,
      date: n.date,
      pinned: n.pinned,
      views: n.views,
      order: i,
    })),
  });

  await prisma.galleryItem.deleteMany({});
  await prisma.galleryItem.createMany({
    data: gallery.map((g, i) => ({ src: g.src, title: g.title, span: g.span, order: i })),
  });

  await prisma.popup.deleteMany({});
  await prisma.popup.createMany({
    data: popups.map((p, i) => ({
      title: p.title,
      content: p.content,
      imageUrl: p.imageUrl,
      linkUrl: p.linkUrl,
      startAt: p.startAt,
      endAt: p.endAt,
      isActive: p.isActive,
      allowHideToday: p.allowHideToday,
      order: i,
    })),
  });

  // Privacy docs
  await prisma.privacyDoc.upsert({
    where: { kind: 'policy' },
    update: {},
    create: { kind: 'policy', version: today, body: privacyPolicy },
  });
  await prisma.privacyDoc.upsert({
    where: { kind: 'consent' },
    update: {},
    create: { kind: 'consent', version: today, body: privacyConsent },
  });

  console.log('Seed complete:', {
    admin: username,
    nav: nav.length,
    hero: hero.length,
    programs: programs.length,
    therapists: therapists.length,
    notices: notices.length,
    gallery: gallery.length,
    popups: popups.length,
  });
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => {
    void prisma.$disconnect();
  });
