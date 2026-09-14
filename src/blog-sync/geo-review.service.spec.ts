import { countNumericSentences, GeoReviewService, hasSourceMention } from './geo-review.service';

function makeService(llmRaw: string | Error, enabled = true, apiKey = 'k') {
  const config = {
    get: jest.fn((key: string) => (key === 'geoReview' ? { enabled } : { apiKey })),
  };
  const prisma = { article: { update: jest.fn().mockResolvedValue({}) } };
  const llm = {
    completeJson: jest.fn(() =>
      llmRaw instanceof Error ? Promise.reject(llmRaw) : Promise.resolve(llmRaw),
    ),
  };
  const service = new GeoReviewService(config as never, prisma as never, llm as never);
  return { service, prisma, llm };
}

describe('countNumericSentences / hasSourceMention', () => {
  it('숫자 포함 문장을 센다', () => {
    expect(
      countNumericSentences(
        '조기교실은 만 3세부터 시작합니다. 상담은 전화로 받습니다. 9월에 시작해요.',
      ),
    ).toBe(2);
  });
  it('출처 패턴을 감지한다', () => {
    expect(hasSourceMention('KCI 등재 학술지 논문에 따르면 효과가 보고되었습니다')).toBe(true);
    expect(hasSourceMention('오늘 소풍을 다녀왔어요')).toBe(false);
  });
});

describe('GeoReviewService.analyze', () => {
  it('글에 있는 내용의 Q&A는 통과, 원문에 없는 숫자가 든 Q&A는 폐기한다', async () => {
    const { service } = makeService(
      JSON.stringify({
        missingFacts: ['대상 연령', '신청 방법'],
        qas: [
          { q: '부모교육은 어떻게 진행되나요?', a: '가정에서의 지도방법을 함께 다룹니다.' },
          { q: '비용은 얼마인가요?', a: '회당 50000원입니다.' }, // 원문에 없는 숫자 → 폐기
        ],
      }),
    );
    const r = await service.analyze(
      '부모교육 안내',
      '<p>부모교육에서는 가정에서의 지도방법을 함께 다룹니다.</p>',
    );
    expect(r.missingFacts).toEqual(['대상 연령', '신청 방법']);
    expect(r.qas).toHaveLength(1);
    expect(r.qas[0].q).toContain('부모교육');
    expect(r.faqJsonLdDraft).toBeTruthy();
  });

  it('LLM 실패 시에도 로컬 지표는 채우고 error를 남긴다', async () => {
    const { service } = makeService(new Error('boom'));
    const r = await service.analyze('제목', '<p>9월 30일까지 신청받습니다.</p>');
    expect(r.numericSentenceCount).toBe(1);
    expect(r.error).toContain('LLM 분석 실패');
    expect(r.qas).toEqual([]);
  });

  it('비활성(GEO_REVIEW_ENABLED=false)일 때 analyzeAndStore는 아무것도 하지 않는다', async () => {
    const { service, prisma, llm } = makeService('{}', false);
    await service.analyzeAndStore('id1', '제목', '본문');
    expect(llm.completeJson).not.toHaveBeenCalled();
    expect(prisma.article.update).not.toHaveBeenCalled();
  });

  it('활성일 때 analyzeAndStore는 결과를 저장한다', async () => {
    const { service, prisma } = makeService(JSON.stringify({ missingFacts: [], qas: [] }));
    await service.analyzeAndStore('id1', '제목', '<p>본문입니다.</p>');
    expect(prisma.article.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'id1' } }),
    );
  });
});
