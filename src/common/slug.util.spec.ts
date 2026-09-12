import { slugify } from './slug.util';

describe('slugify', () => {
  it('keeps hangul and lowercases latin', () => {
    expect(slugify('고양시 ABA')).toBe('고양시-aba');
    expect(slugify('Ilsan ABA Center')).toBe('ilsan-aba-center');
  });

  it('collapses separators and strips specials', () => {
    expect(slugify('부모상담 · 부모교육')).toBe('부모상담-부모교육');
    expect(slugify('  ABA란?  무엇인가!! ')).toBe('aba란-무엇인가');
    expect(slugify('a___b   c')).toBe('a-b-c');
  });

  it('trims leading/trailing dashes and caps length', () => {
    expect(slugify('---tag---')).toBe('tag');
    expect(slugify('가'.repeat(300)).length).toBeLessThanOrEqual(120);
  });

  it('returns empty string for unusable input', () => {
    expect(slugify('!!!')).toBe('');
  });
});
