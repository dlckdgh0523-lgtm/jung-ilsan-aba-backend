import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TagsService } from '../tags/tags.service';

export interface SeoIssue {
  where: string;
  message: string;
}

export interface SeoHealthReport {
  checkedAt: string;
  totals: {
    published: number;
    drafts: number;
    tagsIndexable: number;
    tagsThin: number;
    errors: number;
    warnings: number;
  };
  errors: SeoIssue[];
  warnings: SeoIssue[];
  info: string[];
}

const MIN_CONTENT_CHARS = 200;

/**
 * Internal content-quality audit for the admin page (지시서 §15).
 * NOT a search-engine score — it only flags things we know hurt indexing or
 * snippet quality: missing descriptions, thin bodies, duplicate titles,
 * imageless posts, alt-less images, posts with no internal links.
 */
@Injectable()
export class SeoHealthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tags: TagsService,
  ) {}

  async report(): Promise<SeoHealthReport> {
    const errors: SeoIssue[] = [];
    const warnings: SeoIssue[] = [];
    const info: string[] = [];

    const [published, draftCount, indexableTags, allTags, faqCount] = await Promise.all([
      this.prisma.article.findMany({
        where: { deletedAt: null, visible: true, status: 'published' },
        select: {
          slug: true,
          title: true,
          seoTitle: true,
          seoDescription: true,
          excerpt: true,
          thumbnail: true,
          content: true,
          categoryId: true,
          relatedLocations: true,
          tags: { select: { tagId: true } },
        },
        take: 2000,
      }),
      this.prisma.article.count({ where: { deletedAt: null, status: 'draft' } }),
      this.tags.indexableTags(),
      this.prisma.tag.count(),
      this.prisma.faqItem.count({ where: { deletedAt: null, visible: true } }),
    ]);

    const titleSeen = new Map<string, string>();
    for (const a of published) {
      const where = `/blog/${a.slug}`;
      const title = (a.seoTitle || a.title || '').trim();
      const text = stripHtml(a.content || '');

      if (!a.seoDescription && !a.excerpt) {
        errors.push({ where, message: 'Meta Description(요약/SEO 설명) 누락' });
      }
      if (text.length < MIN_CONTENT_CHARS) {
        errors.push({ where, message: `본문이 너무 짧음 (${text.length}자) — 얇은 콘텐츠` });
      }
      const dup = titleSeen.get(title);
      if (dup) errors.push({ where, message: `중복 제목 ("${title}") — ${dup}와 동일` });
      else titleSeen.set(title, where);

      if (!a.thumbnail) warnings.push({ where, message: '대표 이미지 없음' });
      else if (!/^https?:\/\//i.test(a.thumbnail) && !a.thumbnail.startsWith('/')) {
        warnings.push({ where, message: '대표 이미지 URL 형식 확인 필요' });
      }
      if (title.length > 60)
        warnings.push({ where, message: `제목이 김 (${title.length}자, 60자 권장)` });
      const desc = (a.seoDescription || a.excerpt || '').trim();
      if (desc.length > 160)
        warnings.push({ where, message: `설명이 김 (${desc.length}자, 160자 권장)` });
      if (!a.categoryId) warnings.push({ where, message: '카테고리 미지정' });
      if (a.tags.length === 0) warnings.push({ where, message: '태그 없음' });

      const imgsWithoutAlt = countImgsWithoutAlt(a.content || '');
      if (imgsWithoutAlt > 0) {
        warnings.push({ where, message: `alt 없는 이미지 ${imgsWithoutAlt}개` });
      }
      if (!/href=/.test(a.content || '')) {
        warnings.push({ where, message: '내부/외부 링크가 하나도 없음' });
      }
      const locations = Array.isArray(a.relatedLocations) ? a.relatedLocations : [];
      if (
        locations.length === 0 &&
        /일산|고양|파주|운정|김포/.test(`${title}${text.slice(0, 400)}`)
      ) {
        warnings.push({ where, message: '지역을 다루는 글인데 관련 지역이 연결되지 않음' });
      }
    }

    if (faqCount === 0) {
      warnings.push({ where: '/#faq', message: '공개된 FAQ가 없음 — FAQ 콘텐츠 등록 권장' });
    }
    if (draftCount > 0) info.push(`검수 대기 초안 ${draftCount}건 (sitemap에는 포함되지 않음)`);
    const thin = allTags - indexableTags.length;
    info.push(
      `태그 ${allTags}개 중 색인 대상 ${indexableTags.length}개 — 발행 글 3건 미만 태그 ${thin}개는 자동으로 sitemap 제외`,
    );

    return {
      checkedAt: new Date().toISOString(),
      totals: {
        published: published.length,
        drafts: draftCount,
        tagsIndexable: indexableTags.length,
        tagsThin: thin,
        errors: errors.length,
        warnings: warnings.length,
      },
      errors,
      warnings,
      info,
    };
  }
}

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;|&#160;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Exported for tests. */
export function countImgsWithoutAlt(html: string): number {
  const imgs = html.match(/<img\b[^>]*>/gi) ?? [];
  return imgs.filter((tag) => !/\balt\s*=\s*("[^"]+"|'[^']+')/i.test(tag)).length;
}
