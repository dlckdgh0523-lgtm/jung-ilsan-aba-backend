import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ArticlesService, PUBLISHED_WHERE, type ArticleView } from '../articles/articles.service';
import { TagsService } from '../tags/tags.service';
import { escapeHtml, escapeXml, sanitizeRichHtml, seoPageShell } from './render.util';

const ORG_ID = 'https://www.chungaba.com/#organization';

/** 조직 JSON-LD(프론트 index.html)의 areaServed와 동일하게 유지한다. */
const AREA_SERVED = ['고양시', '일산서구', '일산동구', '일산', '파주시', '운정신도시', '김포시'];

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
      { loc: `${base}/about`, priority: '0.9' },
      { loc: `${base}/programs`, priority: '0.9' },
      { loc: `${base}/team`, priority: '0.8' },
      { loc: `${base}/faq`, priority: '0.8' },
      { loc: `${base}/contact`, priority: '0.8' },
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
<ul class="cards">${items || '<li>아직 등록된 게시글이 없습니다.</li>'}</ul>${pager}
<div class="cta-box"><strong>정지은일산ABA</strong> — 고양시 일산 지역 ABA 전문기관<br><a href="${base}/programs">치료 프로그램 보기</a> · <a href="${base}/contact">상담 안내 보기</a></div>`,
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
<div class="cta-box"><strong>아이의 발달이 궁금하신가요?</strong><br>초기상담으로 편하게 문의해 주세요.<br><a href="${base}/contact">상담 안내 보기</a></div>`,
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
<div class="cta-box"><strong>정지은일산ABA</strong> — 고양시 일산 지역 ABA 행동발달센터<br><a href="${base}/contact">상담 안내 보기</a></div>`,
    });
  }
  // ── 독립 정적 페이지 (해시 라우트의 SSR 대응: /about /programs /faq /contact) ──
  // 콘텐츠는 전부 DB(관리자페이지에서 편집하는 실데이터)에서 렌더 — 홈 복제 아님.

  private async brand(): Promise<Record<string, unknown>> {
    const site = await this.prisma.siteSetting.findUnique({ where: { id: 'singleton' } });
    return ((site?.brand as Record<string, unknown>) ?? {}) as Record<string, unknown>;
  }

  private strList(v: unknown): string[] {
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string' && !!x) : [];
  }

  /** 자격 목록 — 관리자 저장 형식은 {code, desc} 객체 배열(과거 문자열도 허용). */
  private certList(v: unknown): { code: string; desc?: string }[] {
    if (!Array.isArray(v)) return [];
    return v
      .map((x) => {
        if (typeof x === 'string' && x) return { code: x };
        if (x && typeof x === 'object') {
          const o = x as { code?: unknown; name?: unknown; desc?: unknown };
          const code =
            typeof o.code === 'string' ? o.code : typeof o.name === 'string' ? o.name : '';
          if (code) return { code, desc: typeof o.desc === 'string' ? o.desc : undefined };
        }
        return null;
      })
      .filter((x): x is { code: string; desc?: string } => !!x);
  }

  /** 경력 목록 — {period: 현|전, text, kind?: 'lecture'} 객체 배열(과거 문자열도 허용). */
  private careerList(v: unknown): { period?: string; text: string; kind?: string }[] {
    if (!Array.isArray(v)) return [];
    return v
      .map((x) => {
        if (typeof x === 'string' && x) return { text: x };
        if (x && typeof x === 'object') {
          const o = x as { period?: unknown; text?: unknown; kind?: unknown };
          if (typeof o.text === 'string' && o.text)
            return {
              text: o.text,
              period: typeof o.period === 'string' ? o.period : undefined,
              kind: typeof o.kind === 'string' ? o.kind : undefined,
            };
        }
        return null;
      })
      .filter((x): x is { period?: string; text: string; kind?: string } => !!x);
  }

  /** 정적 페이지 공통 breadcrumb — 화면의 "홈 · …" 라인과 1:1 대응. */
  private breadcrumbLd(name: string, path: string): object {
    const base = this.frontBase;
    return {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: '홈', item: `${base}/` },
        { '@type': 'ListItem', position: 2, name, item: `${base}${path}` },
      ],
    };
  }

  async aboutHtml(): Promise<string> {
    const base = this.frontBase;
    const [about, director, brand] = await Promise.all([
      this.prisma.about.findUnique({ where: { id: 'singleton' } }),
      this.prisma.director.findUnique({ where: { id: 'singleton' } }),
      this.brand(),
    ]);
    const body = this.strList(about?.body);
    const values = (Array.isArray(about?.values) ? about?.values : []) as {
      ko?: string;
      en?: string;
      desc?: string;
    }[];
    const certs = this.certList(director?.certifications);
    const education = this.strList(director?.education);
    const allCareer = this.careerList(director?.career);
    const career = allCareer.filter((c) => c.kind !== 'lecture');
    const lectures = allCareer.filter((c) => c.kind === 'lecture');
    const organizations = this.strList(director?.organizations);
    const awards = this.strList(director?.awards);
    const training = this.strList(director?.training);
    const papers = (Array.isArray(director?.papers) ? director?.papers : []) as {
      year?: string;
      title?: string;
    }[];
    const validPapers = papers.filter((p) => p && p.title);
    const dName = String(director?.name || '정지은');
    const address = String(brand.address || '경기도 고양시 일산서구 주엽로 150 자유프라자 606호');
    const phone = String(brand.phone || '031-977-2575');
    const hours = String(brand.hours || '평일 09:00 — 21:00');

    // 화면에 렌더되는 내용만 반영한 Person 노드 — 홈의 #director 그래프와 같은 @id로 연결.
    const personLd: Record<string, unknown> = {
      '@context': 'https://schema.org',
      '@type': 'Person',
      '@id': 'https://www.chungaba.com/#director',
      name: dName,
      jobTitle: '센터장',
      worksFor: { '@id': ORG_ID },
    };
    if (certs.length) {
      personLd.hasCredential = certs.map((c) => ({
        '@type': 'EducationalOccupationalCredential',
        name: c.desc ? `${c.code} (${c.desc})` : c.code,
      }));
    }

    return seoPageShell({
      title: '센터 소개 | 정지은일산ABA',
      description:
        '정지은일산ABA는 고양시 일산서구 주엽동의 응용행동분석(ABA) 전문기관입니다. 센터의 치료 철학, 운영 방식, 박사 센터장(BCBA-D)의 학력·자격·경력을 소개합니다.',
      canonical: `${base}/about`,
      frontBase: base,
      jsonLd: [
        {
          '@context': 'https://schema.org',
          '@type': 'AboutPage',
          name: '센터 소개 | 정지은일산ABA',
          url: `${base}/about`,
          mainEntity: { '@id': ORG_ID },
        },
        personLd,
        this.breadcrumbLd('센터 소개', '/about'),
      ],
      bodyHtml: `<h1>센터 소개</h1>
<p class="meta"><a href="${base}/">홈</a> · 정지은일산ABA — 고양시 일산서구 주엽동 ABA 전문기관</p>
<article>
<p>정지은일산ABA는 고양시 일산서구 주엽동에 자리한 응용행동분석(ABA) 전문기관으로, 자폐스펙트럼장애·발달지연 등 발달과 행동 영역의 지원이 필요한 아동에게 평가에 근거한 개별화 중재를 제공합니다. 박사 센터장이 아동별 중재계획과 치료사 슈퍼비전을 직접 총괄합니다.</p>
<h2>기관 개요</h2>
<ul>
<li>기관명: 정지은일산ABA</li>
<li>센터장: ${escapeHtml(dName)}</li>
<li>위치: ${escapeHtml(address)}</li>
<li>전화: ${escapeHtml(phone)} · 운영시간: ${escapeHtml(hours)}</li>
<li>주요 이용 지역: 일산·고양을 중심으로 파주·운정·김포에서도 방문</li>
</ul>
${about?.title ? `<h2>${escapeHtml(about.title)}</h2>` : ''}
${body.map((t) => `<p>${escapeHtml(t)}</p>`).join('\n')}
${values.length ? `<h2>센터가 지키는 가치</h2><ul>${values.map((v) => `<li><strong>${escapeHtml(v.ko || '')}${v.en ? ` (${escapeHtml(v.en)})` : ''}</strong> — ${escapeHtml(v.desc || '')}</li>`).join('')}</ul>` : ''}
<h2>센터장 — ${escapeHtml(dName)} ${escapeHtml(director?.sub || '')}</h2>
${certs.length ? `<h3>자격 및 인증</h3><ul>${certs.map((c) => `<li><strong>${escapeHtml(c.code)}</strong>${c.desc ? ` — ${escapeHtml(c.desc)}` : ''}</li>`).join('')}</ul>` : ''}
${education.length ? `<h3>학력</h3><ul>${education.map((e) => `<li>${escapeHtml(e)}</li>`).join('')}</ul>` : ''}
${career.length ? `<h3>근무 경력</h3><ul>${career.map((c) => `<li>${c.period ? `[${escapeHtml(c.period)}] ` : ''}${escapeHtml(c.text)}</li>`).join('')}</ul>` : ''}
${lectures.length ? `<h3>강의 경력</h3><ul>${lectures.map((c) => `<li>${c.period ? `[${escapeHtml(c.period)}] ` : ''}${escapeHtml(c.text)}</li>`).join('')}</ul>` : ''}
${organizations.length ? `<h3>학회·협회 활동</h3><ul>${organizations.map((o) => `<li>${escapeHtml(o)}</li>`).join('')}</ul>` : ''}
${awards.length ? `<h3>수상</h3><ul>${awards.map((a) => `<li>${escapeHtml(a)}</li>`).join('')}</ul>` : ''}
${training.length ? `<h3>추가 수련 및 자격증</h3><ul>${training.map((t) => `<li>${escapeHtml(t)}</li>`).join('')}</ul>` : ''}
${
  validPapers.length
    ? `<h2>연구·논문</h2>
<p>센터장 ${escapeHtml(dName)} 박사가 발표한 학위논문과 학술지 논문입니다. 초록 전문은 <a href="${base}/#papers">센터장 논문</a>에서 볼 수 있습니다.</p>
<ul>${validPapers.map((p) => `<li>${p.year ? `(${escapeHtml(p.year)}) ` : ''}${escapeHtml(p.title || '')}</li>`).join('')}</ul>`
    : ''
}
<p>치료진 구성은 <a href="${base}/team">치료사 소개</a>에서, 프로그램 안내는 <a href="${base}/programs">치료 프로그램</a>에서, 자주 묻는 내용은 <a href="${base}/faq">FAQ</a>에서 볼 수 있습니다.</p>
</article>
<div class="cta-box"><strong>정지은일산ABA</strong> — 고양시 일산 지역 ABA 전문기관<br><a href="${base}/contact">상담 안내 보기</a></div>`,
    });
  }

  async programsHtml(): Promise<string> {
    const base = this.frontBase;
    const programs = await this.prisma.program.findMany({
      where: { deletedAt: null, visible: true },
      orderBy: { order: 'asc' },
    });
    const sections = programs
      .map((pr) => {
        const detail = (pr.detail ?? {}) as {
          intro?: string;
          sections?: { heading?: string; body?: string }[];
        };
        const subs = Array.isArray(detail.sections) ? detail.sections : [];
        return `<h2>${escapeHtml(pr.title)}${pr.ageRange ? ` <small>(${escapeHtml(pr.ageRange)})</small>` : ''}</h2>
${pr.desc ? `<p>${escapeHtml(pr.desc)}</p>` : ''}
${detail.intro ? `<p>${escapeHtml(detail.intro)}</p>` : ''}
${subs.map((sc) => `<h3>${escapeHtml(sc.heading || '')}</h3><p>${escapeHtml(sc.body || '')}</p>`).join('\n')}`;
      })
      .join('\n');

    return seoPageShell({
      title: '치료 프로그램 | 정지은일산ABA',
      description:
        '정지은일산ABA의 프로그램 안내 — 초기상담, 발달평가, ABA 조기교실, 1:1 개별 ABA, 사회성 프로그램, 부모상담·부모교육. 고양시 일산 지역 자폐스펙트럼·발달지연 아동을 위한 응용행동분석 프로그램입니다.',
      canonical: `${base}/programs`,
      frontBase: base,
      jsonLd: [
        {
          '@context': 'https://schema.org',
          '@type': 'ItemList',
          name: '정지은일산ABA 치료 프로그램',
          itemListElement: programs.map((pr, i) => ({
            '@type': 'ListItem',
            position: i + 1,
            item: {
              '@type': 'Service',
              name: pr.title,
              description: pr.desc || undefined,
              provider: { '@id': ORG_ID },
              areaServed: AREA_SERVED,
            },
          })),
        },
        this.breadcrumbLd('치료 프로그램', '/programs'),
      ],
      bodyHtml: `<h1>치료 프로그램</h1>
<p class="meta"><a href="${base}/">홈</a> · 아이의 발달수준과 행동 기능에 맞춘 개별화 ABA 프로그램</p>
<article>
${sections || '<p>프로그램 정보를 준비 중입니다.</p>'}
<h2>프로그램 선택이 어려우신가요?</h2>
<p>초기상담에서 아이의 현재 발달과 주 호소를 살펴보고 알맞은 프로그램을 안내드립니다. <a href="${base}/contact">상담 안내</a>를 확인하시거나, ABA가 처음이라면 <a href="${base}/faq">자주 묻는 질문</a>과 <a href="${base}/blog">소식·블로그</a>의 전문 정보를 먼저 읽어보세요. 모든 프로그램은 <a href="${base}/about">센터 소개</a>의 운영 철학과 <a href="${base}/team">치료사 소개</a>의 슈퍼비전 체계 안에서 진행됩니다.</p>
</article>
<div class="cta-box"><strong>정지은일산ABA</strong> — 고양시 일산 지역 ABA 전문기관<br><a href="${base}/contact">상담 안내 보기</a></div>`,
    });
  }

  async faqHtml(): Promise<string> {
    const base = this.frontBase;
    const faqs = await this.prisma.faqItem.findMany({
      where: { deletedAt: null, visible: true },
      orderBy: { order: 'asc' },
    });
    return seoPageShell({
      title: '자주 묻는 질문 | 정지은일산ABA',
      description:
        'ABA 치료가 처음인 부모님들이 자주 묻는 질문 — ABA란 무엇인지, 어떤 아이가 대상인지, 상담·평가·치료가 어떤 순서로 진행되는지, 부모 참여는 어떻게 이루어지는지 답해드립니다.',
      canonical: `${base}/faq`,
      frontBase: base,
      jsonLd: faqs.length
        ? [
            {
              '@context': 'https://schema.org',
              '@type': 'FAQPage',
              url: `${base}/faq`,
              // 화면에 실제 표시되는 질문·답변만 그대로 반영
              mainEntity: faqs.map((f) => ({
                '@type': 'Question',
                name: f.question,
                acceptedAnswer: { '@type': 'Answer', text: f.answer },
              })),
            },
            this.breadcrumbLd('자주 묻는 질문', '/faq'),
          ]
        : [this.breadcrumbLd('자주 묻는 질문', '/faq')],
      bodyHtml: `<h1>자주 묻는 질문</h1>
<p class="meta"><a href="${base}/">홈</a> · ABA가 처음인 부모님을 위한 안내</p>
<article>
${faqs.map((f) => `<h2>Q. ${escapeHtml(f.question)}</h2><p>${escapeHtml(f.answer)}</p>`).join('\n') || '<p>등록된 질문이 없습니다.</p>'}
<p>더 궁금한 점은 <a href="${base}/contact">상담 안내</a>에서 문의 방법을 확인하세요. 프로그램별 자세한 내용은 <a href="${base}/programs">치료 프로그램</a>에, 치료진의 자격과 슈퍼비전 체계는 <a href="${base}/team">치료사 소개</a>에 있습니다.</p>
</article>
<div class="cta-box"><strong>정지은일산ABA</strong> — 고양시 일산 지역 ABA 전문기관<br><a href="${base}/contact">상담 안내 보기</a></div>`,
    });
  }

  async contactHtml(): Promise<string> {
    const base = this.frontBase;
    const brand = await this.brand();
    const address = String(brand.address || '경기도 고양시 일산서구 주엽로 150 자유프라자 606호');
    const phone = String(brand.phone || '031-977-2575');
    const fax = String(brand.fax || '031-976-2575');
    const hours = String(brand.hours || '평일 09:00 — 21:00');
    const kakaoId = String(brand.kakaoId || '@jungjieun_aba');

    return seoPageShell({
      title: '상담 안내 · 오시는 길 | 정지은일산ABA',
      description: `정지은일산ABA 상담 신청 방법과 오시는 길 — ${address}, 전화 ${phone}, ${hours}. 지하철 3호선 주엽역 인근으로 일산·고양은 물론 파주·운정에서도 방문하기 좋습니다.`,
      canonical: `${base}/contact`,
      frontBase: base,
      jsonLd: [
        {
          '@context': 'https://schema.org',
          '@type': 'ContactPage',
          name: '상담 안내 · 오시는 길 | 정지은일산ABA',
          url: `${base}/contact`,
          mainEntity: { '@id': ORG_ID },
        },
        this.breadcrumbLd('상담 안내', '/contact'),
      ],
      bodyHtml: `<h1>상담 안내 · 오시는 길</h1>
<p class="meta"><a href="${base}/">홈</a> · 처음 오시는 부모님을 위한 안내</p>
<article>
<h2>상담 신청 방법</h2>
<ul>
<li>전화: ${escapeHtml(phone)} (${escapeHtml(hours)})</li>
<li>카카오톡 채널: ${escapeHtml(kakaoId)}</li>
<li>홈페이지 <a href="${base}/#contact">상담 신청 폼</a></li>
</ul>
<h2>상담은 이렇게 진행됩니다</h2>
<p>초기상담에서 아이의 발달 상태와 주 호소를 함께 살펴보고, 필요 시 발달평가를 거쳐 아이에게 맞는 프로그램과 목표를 안내드립니다. 프로그램별 안내는 <a href="${base}/programs">치료 프로그램</a>, 자주 묻는 내용은 <a href="${base}/faq">FAQ</a>에서 미리 확인하실 수 있습니다. 센터의 운영 철학과 치료진이 궁금하시면 <a href="${base}/about">센터 소개</a>와 <a href="${base}/team">치료사 소개</a>를 먼저 읽어보세요.</p>
<h2>오시는 길</h2>
<p><strong>${escapeHtml(address)}</strong></p>
<ul>
<li>지하철: 3호선 주엽역 인근 (자유프라자 건물 6층)</li>
<li>일산서구 주엽동 중심 상권에 위치해 일산동구·파주·운정·김포에서도 이동이 편리합니다.</li>
<li>전화: ${escapeHtml(phone)} · 팩스: ${escapeHtml(fax)}</li>
<li>운영시간: ${escapeHtml(hours)}</li>
</ul>
</article>
<div class="cta-box"><strong>정지은일산ABA</strong> — ${escapeHtml(address)}<br>전화 ${escapeHtml(phone)} · ${escapeHtml(hours)}</div>`,
    });
  }
  async teamHtml(): Promise<string> {
    const base = this.frontBase;
    const [therapists, director] = await Promise.all([
      this.prisma.therapist.findMany({
        where: { deletedAt: null, visible: true },
        orderBy: { order: 'asc' },
      }),
      this.prisma.director.findUnique({ where: { id: 'singleton' } }),
    ]);
    const dCerts = this.certList(director?.certifications).map((c) => c.code);

    const cards = therapists
      .map((t) => {
        const certs = this.strList(t.certifications);
        const education = this.strList(t.education);
        const teaching = this.strList(t.teaching);
        return `<article>
<h2>${escapeHtml(t.name)}${t.role ? ` <small>· ${escapeHtml(t.role)}</small>` : ''}</h2>
${t.summary ? `<p>${escapeHtml(t.summary)}</p>` : ''}
${certs.length ? `<h3>자격</h3><ul>${certs.map((c) => `<li>${escapeHtml(c)}</li>`).join('')}</ul>` : ''}
${education.length ? `<h3>학력·교육</h3><ul>${education.map((e) => `<li>${escapeHtml(e)}</li>`).join('')}</ul>` : ''}
${teaching.length ? `<h3>주요 지도 분야</h3><ul>${teaching.map((x) => `<li>${escapeHtml(x)}</li>`).join('')}</ul>` : ''}
${t.completion ? `<p>${escapeHtml(t.completion)}</p>` : ''}
</article>`;
      })
      .join('\n');

    return seoPageShell({
      title: '치료사 소개 | 정지은일산ABA',
      description:
        '정지은일산ABA의 치료진 소개 — 박사 센터장(BCBA-D)의 정기 슈퍼비전 아래, 행동분석 자격과 임상 경험을 갖춘 치료사들이 아동별 개별 ABA 중재를 담당합니다.',
      canonical: `${base}/team`,
      frontBase: base,
      jsonLd: [
        {
          '@context': 'https://schema.org',
          '@type': 'WebPage',
          name: '치료사 소개 | 정지은일산ABA',
          url: `${base}/team`,
          about: { '@id': ORG_ID },
        },
        this.breadcrumbLd('치료사 소개', '/team'),
      ],
      bodyHtml: `<h1>치료사 소개</h1>
<p class="meta"><a href="${base}/">홈</a> · 박사 센터장 슈퍼비전 체계로 운영되는 치료진</p>
<article>
<h2>센터장 — ${escapeHtml(director?.name || '정지은')}${dCerts.length ? ` <small>(${escapeHtml(dCerts.slice(0, 3).join(', '))})</small>` : ''}</h2>
<p>센터장이 아동의 평가, 중재계획, 프로그램 운영과 치료사 슈퍼비전을 총괄합니다. 학력·경력·연구는 <a href="${base}/about">센터 소개</a>에서 자세히 볼 수 있습니다.</p>
</article>
${cards || '<p>치료진 정보를 준비 중입니다.</p>'}
<h2>치료진 운영 방식</h2>
<p>모든 치료사는 정기 슈퍼비전과 사례회의를 통해 아동별 개별화 목표와 중재 절차를 점검하며, 회기 자료에 근거해 프로그램을 조정합니다. 프로그램 안내는 <a href="${base}/programs">치료 프로그램</a>, 문의는 <a href="${base}/contact">상담 안내</a>를 확인하세요.</p>
<div class="cta-box"><strong>정지은일산ABA</strong> — 고양시 일산 지역 ABA 전문기관<br><a href="${base}/contact">상담 안내 보기</a></div>`,
    });
  }
}
