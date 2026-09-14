import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ArticlesService, PUBLISHED_WHERE, type ArticleView } from '../articles/articles.service';
import { TagsService } from '../tags/tags.service';
import { escapeHtml, escapeXml, sanitizeRichHtml, seoPageShell } from './render.util';

const ORG_ID = 'https://www.chungaba.com/#organization';

function fmtDate(d?: Date | string | null): string {
  if (!d) return '';
  const date = new Date(d);
  return `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, '0')}.${String(date.getDate()).padStart(2, '0')}`;
}

@Injectable()
export class SeoService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly articles: ArticlesService,
    private readonly tags: TagsService,
  ) {}

  private get frontBase(): string {
    return (process.env.FRONT_BASE_URL || 'https://www.chungaba.com').replace(/\/$/, '');
  }

  /**
   * og:image / JSON-LD image must be absolute. Local-driver uploads store
   * relative "/uploads/…" URLs — resolve them against the API's public origin
   * (that's where the files are actually served from).
   */
  private absoluteImage(url?: string | null): string | undefined {
    if (!url) return undefined;
    if (/^https?:\/\//i.test(url)) return url;
    const apiBase = (process.env.API_PUBLIC_BASE || '').replace(/\/$/, '');
    return apiBase ? `${apiBase}${url.startsWith('/') ? '' : '/'}${url}` : url;
  }

  // ── sitemap.xml ────────────────────────────────────────────────────────────
  async sitemapXml(): Promise<string> {
    const base = this.frontBase;
    const urls: { loc: string; lastmod?: string; priority?: string }[] = [
      { loc: `${base}/`, priority: '1.0' },
      { loc: `${base}/blog`, priority: '0.8' },
    ];
    const [articles, tags] = await Promise.all([
      this.prisma.article.findMany({
        where: PUBLISHED_WHERE,
        select: { slug: true, updatedAt: true },
        orderBy: { publishedAt: 'desc' },
        take: 5000,
      }),
      this.tags.indexableTags(),
    ]);
    for (const a of articles)
      urls.push({
        loc: `${base}/blog/${encodeURIComponent(a.slug)}`,
        lastmod: a.updatedAt.toISOString(),
        priority: '0.7',
      });
    for (const t of tags)
      urls.push({
        loc: `${base}/tags/${encodeURIComponent(t.slug)}`,
        lastmod: t.updatedAt.toISOString(),
        priority: '0.5',
      });

    const body = urls
      .map(
        (u) =>
          `  <url><loc>${escapeXml(u.loc)}</loc>${u.lastmod ? `<lastmod>${u.lastmod}</lastmod>` : ''}${u.priority ? `<priority>${u.priority}</priority>` : ''}</url>`,
      )
      .join('\n');
    return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`;
  }

  // ── /blog (index) ──────────────────────────────────────────────────────────
  async blogIndexHtml(page = 1): Promise<string> {
    const base = this.frontBase;
    const pageSize = 20;
    const list = await this.articles.list(
      { page, pageSize, sort: 'publishedAt:desc' } as never,
      false,
    );
    const items = list.items
      .map(
        (a) => `<li><a href="${base}/blog/${encodeURIComponent(a.slug)}">${escapeHtml(a.title)}</a>
<p>${escapeHtml(a.excerpt || '')}</p><p>${fmtDate(a.publishedAt)}${a.category ? ' · ' + escapeHtml(a.category.name) : ''}</p></li>`,
      )
      .join('\n');
    const totalPages = Math.max(1, Math.ceil(list.total / pageSize));
    const pager =
      totalPages > 1
        ? `<p class="meta">${Array.from({ length: totalPages }, (_, i) => (i + 1 === page ? `<strong>${i + 1}</strong>` : `<a href="${base}/blog?page=${i + 1}">${i + 1}</a>`)).join(' · ')}</p>`
        : '';
    return seoPageShell({
      title: '소식·블로그 | 정지은일산ABA',
      description:
        '정지은일산ABA의 센터 소식, ABA 전문 정보, 부모교육 콘텐츠, 프로그램 안내를 확인하세요. 고양시 일산 지역 자폐스펙트럼·발달지연 아동을 위한 응용행동분석 정보를 제공합니다.',
      canonical: `${base}/blog${page > 1 ? `?page=${page}` : ''}`,
      frontBase: base,
      jsonLd: [
        {
          '@context': 'https://schema.org',
          '@type': 'Blog',
          name: '정지은일산ABA 소식·블로그',
          url: `${base}/blog`,
          publisher: { '@id': ORG_ID },
        },
      ],
      bodyHtml: `<h1>소식·블로그</h1>
<p class="meta">정지은일산ABA — 일산 ABA 행동발달센터의 소식과 전문 정보</p>
<ul class="cards">${items || '<li>아직 등록된 게시글이 없습니다.</li>'}</ul>${pager}`,
    });
  }

  // ── /blog/:slug (article) ─────────────────────────────────────────────────
  async articleHtml(slug: string): Promise<string | null> {
    const base = this.frontBase;
    let article: ArticleView;
    try {
      article = await this.articles.findOne(slug, {});
    } catch {
      return null;
    }
    const related = await this.articles.related(article.id, 6).catch(() => [] as ArticleView[]);
    // Multi-value first (relatedPrograms Json string[]); legacy single as fallback.
    const programIds = [
      ...new Set(
        [
          ...(Array.isArray(article.relatedPrograms) ? (article.relatedPrograms as string[]) : []),
          article.relatedProgram ?? '',
        ].filter((id): id is string => typeof id === 'string' && id !== ''),
      ),
    ];
    const programs = programIds.length
      ? await this.prisma.program
          .findMany({ where: { id: { in: programIds }, deletedAt: null } })
          .catch(() => [])
      : [];
    const locations = Array.isArray(article.relatedLocations)
      ? (article.relatedLocations as string[]).filter((l) => typeof l === 'string' && l)
      : article.relatedLocation
        ? [article.relatedLocation]
        : [];

    const canonical = article.canonicalUrl || `${base}/blog/${encodeURIComponent(article.slug)}`;
    const faqs = (Array.isArray(article.faqItems) ? article.faqItems : []) as {
      q?: string;
      a?: string;
    }[];
    const validFaqs = faqs.filter((f) => f && f.q && f.a);

    const jsonLd: object[] = [
      {
        '@context': 'https://schema.org',
        '@type': 'Article',
        headline: article.title,
        description: article.seoDescription || article.excerpt || '',
        datePublished: article.publishedAt || article.createdAt,
        dateModified: article.updatedAt,
        mainEntityOfPage: canonical,
        ...(article.thumbnail ? { image: this.absoluteImage(article.thumbnail) } : {}),
        ...(locations.length > 0
          ? { contentLocation: locations.map((name) => ({ '@type': 'Place', name })) }
          : {}),
        author: { '@type': 'Organization', name: '정지은일산ABA', '@id': ORG_ID },
        publisher: { '@id': ORG_ID },
      },
      {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: '홈', item: `${base}/` },
          { '@type': 'ListItem', position: 2, name: '소식·블로그', item: `${base}/blog` },
          { '@type': 'ListItem', position: 3, name: article.title, item: canonical },
        ],
      },
    ];
    if (validFaqs.length) {
      jsonLd.push({
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        mainEntity: validFaqs.map((f) => ({
          '@type': 'Question',
          name: f.q,
          acceptedAnswer: { '@type': 'Answer', text: f.a },
        })),
      });
    }

    const tagsHtml = article.tags.length
      ? `<div class="tags">${article.tags.map((t) => `<a href="${base}/tags/${encodeURIComponent(t.slug)}">#${escapeHtml(t.name)}</a>`).join('')}</div>`
      : '';
    const faqHtml = validFaqs.length
      ? `<h2 class="section-h">자주 묻는 질문</h2>` +
        validFaqs
          .map(
            (f) => `<div class="faq"><h3>Q. ${escapeHtml(f.q)}</h3><p>${escapeHtml(f.a)}</p></div>`,
          )
          .join('')
      : '';
    const relatedHtml = related.length
      ? `<h2 class="section-h">관련 글</h2><ul class="cards">${related
          .map(
            (r) =>
              `<li><a href="${base}/blog/${encodeURIComponent(r.slug)}">${escapeHtml(r.title)}</a><p>${escapeHtml(r.excerpt || '')}</p></li>`,
          )
          .join('')}</ul>`
      : '';
    const programHtml =
      programs.length > 0
        ? `<h2 class="section-h">관련 프로그램</h2><ul class="cards">${programs
            .map(
              (p) =>
                `<li><a href="${base}/#program-${escapeHtml(p.id)}">${escapeHtml(p.title)}</a><p>${escapeHtml(p.desc || '')}</p></li>`,
            )
            .join('')}</ul>`
        : '';

    return seoPageShell({
      title: `${article.seoTitle || article.title} | 정지은일산ABA`.replace(
        /\| 정지은일산ABA \| 정지은일산ABA$/,
        '| 정지은일산ABA',
      ),
      description: article.seoDescription || article.excerpt || '',
      canonical,
      frontBase: base,
      ogImage: this.absoluteImage(article.thumbnail),
      jsonLd,
      bodyHtml: `<p class="meta"><a href="${base}/blog">소식·블로그</a>${article.category ? ` · ${escapeHtml(article.category.name)}` : ''}</p>
<h1>${escapeHtml(article.title)}</h1>
<p class="meta">${fmtDate(article.publishedAt || article.createdAt)} · 정지은일산ABA</p>
${article.thumbnail ? `<p><img src="${escapeHtml(this.absoluteImage(article.thumbnail) ?? '')}" alt="${escapeHtml(article.title)}"></p>` : ''}
<article>${sanitizeRichHtml(article.content || '')}</article>
${tagsHtml}
${faqHtml}
${programHtml}
${relatedHtml}
<div class="cta-box"><strong>아이의 발달이 궁금하신가요?</strong><br>초기상담으로 편하게 문의해 주세요.<br><a href="${base}/#contact">상담 신청하기</a></div>`,
    });
  }

  // ── /tags/:slug (tag page) ────────────────────────────────────────────────
  async tagHtml(slug: string, page = 1): Promise<string | null> {
    const base = this.frontBase;
    let tag;
    try {
      tag = await this.tags.findOne(slug);
    } catch {
      return null;
    }
    const pageSize = 20;
    const where: Prisma.ArticleWhereInput = {
      ...PUBLISHED_WHERE,
      tags: { some: { tagId: tag.id } },
    };
    const [rows, total] = await Promise.all([
      this.prisma.article.findMany({
        where,
        orderBy: { publishedAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: { slug: true, title: true, excerpt: true, publishedAt: true },
      }),
      this.prisma.article.count({ where }),
    ]);
    const items = rows
      .map(
        (a) =>
          `<li><a href="${base}/blog/${encodeURIComponent(a.slug)}">${escapeHtml(a.title)}</a><p>${escapeHtml(a.excerpt || '')}</p><p>${fmtDate(a.publishedAt)}</p></li>`,
      )
      .join('\n');
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const pager =
      totalPages > 1
        ? `<p class="meta">${Array.from({ length: totalPages }, (_, i) => (i + 1 === page ? `<strong>${i + 1}</strong>` : `<a href="${base}/tags/${encodeURIComponent(tag.slug)}?page=${i + 1}">${i + 1}</a>`)).join(' · ')}</p>`
        : '';

    return seoPageShell({
      title: tag.seoTitle || `${tag.name} 관련 정보 | 정지은일산ABA`,
      description:
        tag.seoDescription ||
        tag.description ||
        `정지은일산ABA의 ${tag.name} 관련 게시글 모음입니다.`,
      canonical: `${base}/tags/${encodeURIComponent(tag.slug)}`,
      frontBase: base,
      // Thin-content guard (spec §9): only index tag pages with enough posts.
      robots: tag.indexable ? undefined : 'noindex,follow',
      jsonLd: [
        {
          '@context': 'https://schema.org',
          '@type': 'CollectionPage',
          name: tag.seoTitle || `${tag.name} 관련 정보`,
          url: `${base}/tags/${encodeURIComponent(tag.slug)}`,
          about: tag.name,
          publisher: { '@id': ORG_ID },
        },
      ],
      bodyHtml: `<p class="meta"><a href="${base}/blog">소식·블로그</a> · 태그</p>
<h1>${escapeHtml(tag.name)}</h1>
${tag.description ? `<p>${escapeHtml(tag.description)}</p>` : ''}
<ul class="cards">${items || '<li>이 태그의 게시글이 아직 없습니다.</li>'}</ul>${pager}
<div class="cta-box"><strong>정지은일산ABA</strong> — 고양시 일산 지역 ABA 행동발달센터<br><a href="${base}/#contact">상담 신청하기</a></div>`,
    });
  }
}
