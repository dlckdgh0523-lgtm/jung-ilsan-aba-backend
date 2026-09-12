import { Injectable } from '@nestjs/common';
import { Article, ArticleCategory, Prisma, Tag } from '@prisma/client';
import { AppException } from '../common/exceptions/app.exception';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import {
  listResult,
  parseSort,
  skipTake,
  trashedWhere,
  visibleWhere,
  type ListResult,
} from '../common/pagination/paginate.util';
import { PrismaService } from '../prisma/prisma.service';
import { slugify } from '../common/slug.util';
import { ARTICLE_MAX_TAGS } from './dto/create-article.dto';

export type ArticleView = Article & {
  category: ArticleCategory | null;
  tags: Tag[];
};

export interface ArticleListQuery extends PaginationQueryDto {
  /** Category id or slug. */
  category?: string;
  /** Tag id or slug. */
  tag?: string;
  /** draft | published | all (non-admins are clamped to published). */
  status?: string;
  featured?: string;
}

const INCLUDE = {
  category: true,
  tags: { include: { tag: true } },
} satisfies Prisma.ArticleInclude;

type ArticleRow = Prisma.ArticleGetPayload<{ include: typeof INCLUDE }>;

function toView(row: ArticleRow): ArticleView {
  const { tags, ...rest } = row;
  return { ...rest, tags: tags.map((t) => t.tag) };
}

export const PUBLISHED_WHERE: Prisma.ArticleWhereInput = {
  deletedAt: null,
  visible: true,
  status: 'published',
};

@Injectable()
export class ArticlesService {
  constructor(private readonly prisma: PrismaService) {}

  private async buildWhere(
    query: ArticleListQuery,
    isAdmin: boolean,
  ): Promise<Prisma.ArticleWhereInput> {
    const where: Prisma.ArticleWhereInput = {
      ...trashedWhere(isAdmin ? query.trashed : 'none'),
      ...(isAdmin ? visibleWhere(query.visible) : { visible: true }),
    };
    const status = isAdmin ? query.status : 'published';
    if (status && status !== 'all') where.status = status;
    if (query.q) {
      where.OR = [
        { title: { contains: query.q, mode: 'insensitive' } },
        { excerpt: { contains: query.q, mode: 'insensitive' } },
        { content: { contains: query.q, mode: 'insensitive' } },
      ];
    }
    if (query.featured === 'true') where.isFeatured = true;
    if (query.category) {
      where.category = { OR: [{ id: query.category }, { slug: query.category }] };
    }
    if (query.tag) {
      where.tags = { some: { tag: { OR: [{ id: query.tag }, { slug: query.tag }] } } };
    }
    return where;
  }

  async list(query: ArticleListQuery, isAdmin: boolean): Promise<ListResult<ArticleView>> {
    const where = await this.buildWhere(query, isAdmin);
    const orderBy = parseSort(
      query.sort,
      ['publishedAt', 'createdAt', 'updatedAt', 'title', 'views', 'order'],
      { publishedAt: 'desc' },
    );
    const { skip, take } = skipTake(query.page, query.pageSize);
    const [rows, total] = await Promise.all([
      this.prisma.article.findMany({
        where,
        // Secondary key keeps drafts (null publishedAt) in a stable, recent-first order.
        orderBy: [orderBy, { createdAt: 'desc' }],
        skip,
        take,
        include: INCLUDE,
      }),
      this.prisma.article.count({ where }),
    ]);
    return listResult(rows.map(toView), total, query.page, query.pageSize);
  }

  async findOne(
    idOrSlug: string,
    opts: { isAdmin?: boolean; countView?: boolean } = {},
  ): Promise<ArticleView> {
    const where: Prisma.ArticleWhereInput = {
      OR: [{ id: idOrSlug }, { slug: idOrSlug }],
      ...(opts.isAdmin ? {} : PUBLISHED_WHERE),
    };
    const row = await this.prisma.article.findFirst({ where, include: INCLUDE });
    if (!row) throw AppException.notFound('게시글을 찾을 수 없습니다');
    if (opts.countView && !opts.isAdmin) {
      // Fire-and-forget view counter; never fails the read.
      void this.prisma.article
        .update({ where: { id: row.id }, data: { views: { increment: 1 } } })
        .catch(() => undefined);
      row.views += 1;
    }
    return toView(row);
  }

  private async assertSlugFree(slug: string, exceptId?: string): Promise<void> {
    const dupe = await this.prisma.article.findFirst({
      where: { slug, ...(exceptId ? { id: { not: exceptId } } : {}) },
    });
    if (dupe) throw AppException.conflict('이미 사용 중인 슬러그입니다', 'SLUG_TAKEN');
  }

  private async validateTagIds(tagIds: string[]): Promise<void> {
    if (tagIds.length > ARTICLE_MAX_TAGS)
      throw AppException.badRequest(`태그는 게시글당 최대 ${ARTICLE_MAX_TAGS}개까지입니다`);
    if (tagIds.length === 0) return;
    const found = await this.prisma.tag.count({ where: { id: { in: tagIds } } });
    if (found !== new Set(tagIds).size)
      throw AppException.badRequest('존재하지 않는 태그가 포함되어 있습니다');
  }

  /** Default SEO values from title/content when the admin left them empty (spec §7). */
  private seoDefaults(data: Record<string, unknown>): Record<string, unknown> {
    const out = { ...data };
    if (!out.excerpt && typeof out.content === 'string') {
      const text = out.content
        .replace(/<[^>]+>/g, ' ')
        .replace(/&nbsp;/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
      if (text) out.excerpt = text.slice(0, 200);
    }
    if (!out.seoTitle && out.title) out.seoTitle = `${String(out.title)} | 정지은일산ABA`;
    if (!out.seoDescription && out.excerpt) out.seoDescription = String(out.excerpt).slice(0, 160);
    return out;
  }

  async create(data: Record<string, unknown>): Promise<ArticleView> {
    const { tagIds = [], ...rest } = data as { tagIds?: string[] } & Record<string, unknown>;
    const slug = slugify(String(rest.slug || rest.title || ''));
    if (!slug) throw AppException.badRequest('슬러그를 만들 수 없는 제목입니다');
    await this.assertSlugFree(slug);
    await this.validateTagIds(tagIds);
    const payload = this.seoDefaults({ ...rest, slug });
    if (payload.status === 'published' && !payload.publishedAt) payload.publishedAt = new Date();
    const created = await this.prisma.article.create({
      data: {
        ...(payload as Prisma.ArticleUncheckedCreateInput),
        tags: { create: tagIds.map((tagId) => ({ tagId })) },
      },
      include: INCLUDE,
    });
    return toView(created);
  }

  async update(id: string, data: Record<string, unknown>): Promise<ArticleView> {
    const current = await this.prisma.article.findUnique({ where: { id } });
    if (!current) throw AppException.notFound('게시글을 찾을 수 없습니다');
    const { tagIds, ...rest } = data as { tagIds?: string[] } & Record<string, unknown>;

    if (rest.slug !== undefined || rest.title !== undefined) {
      const slug = slugify(String(rest.slug ?? current.slug));
      if (!slug) throw AppException.badRequest('슬러그를 만들 수 없는 제목입니다');
      await this.assertSlugFree(slug, id);
      rest.slug = slug;
    }
    if (tagIds !== undefined) await this.validateTagIds(tagIds);

    const payload = this.seoDefaults({ ...rest, title: rest.title ?? current.title });
    delete payload.title;
    if (rest.title !== undefined) payload.title = rest.title;
    // First transition into "published" stamps publishedAt (kept on later edits).
    if (payload.status === 'published' && !current.publishedAt && !payload.publishedAt)
      payload.publishedAt = new Date();

    const updated = await this.prisma.article.update({
      where: { id },
      data: {
        ...(payload as Prisma.ArticleUncheckedUpdateInput),
        ...(tagIds !== undefined
          ? { tags: { deleteMany: {}, create: tagIds.map((tagId) => ({ tagId })) } }
          : {}),
      },
      include: INCLUDE,
    });
    return toView(updated);
  }

  async softDelete(id: string): Promise<void> {
    const { count } = await this.prisma.article.updateMany({
      where: { id, deletedAt: null },
      data: { deletedAt: new Date() },
    });
    if (count === 0) throw AppException.notFound('게시글을 찾을 수 없습니다');
  }

  async restore(id: string): Promise<ArticleView> {
    const { count } = await this.prisma.article.updateMany({
      where: { id, deletedAt: { not: null } },
      data: { deletedAt: null },
    });
    if (count === 0) throw AppException.notFound('게시글을 찾을 수 없거나 삭제 상태가 아닙니다');
    return this.findOne(id, { isAdmin: true });
  }

  async hardDelete(id: string): Promise<void> {
    try {
      await this.prisma.article.delete({ where: { id } });
    } catch {
      throw AppException.notFound('게시글을 찾을 수 없습니다');
    }
  }

  async setVisibility(id: string, visible: boolean): Promise<ArticleView> {
    await this.findOne(id, { isAdmin: true });
    await this.prisma.article.update({ where: { id }, data: { visible } });
    return this.findOne(id, { isAdmin: true });
  }

  /**
   * Related posts (spec §12): same tag → same category → same program →
   * same audience → latest. De-duplicated, published only, capped at `limit`.
   */
  async related(idOrSlug: string, limit = 6): Promise<ArticleView[]> {
    const base = await this.prisma.article.findFirst({
      where: { OR: [{ id: idOrSlug }, { slug: idOrSlug }] },
      include: { tags: true },
    });
    if (!base) throw AppException.notFound('게시글을 찾을 수 없습니다');
    const tagIds = base.tags.map((t) => t.tagId);
    const notSelf: Prisma.ArticleWhereInput = { id: { not: base.id }, ...PUBLISHED_WHERE };

    const buckets: Prisma.ArticleWhereInput[] = [];
    if (tagIds.length) buckets.push({ ...notSelf, tags: { some: { tagId: { in: tagIds } } } });
    if (base.categoryId) buckets.push({ ...notSelf, categoryId: base.categoryId });
    if (base.relatedProgram) buckets.push({ ...notSelf, relatedProgram: base.relatedProgram });
    if (base.targetAudience) buckets.push({ ...notSelf, targetAudience: base.targetAudience });
    buckets.push(notSelf); // latest fallback

    const seen = new Set<string>();
    const out: ArticleView[] = [];
    for (const where of buckets) {
      if (out.length >= limit) break;
      const rows = await this.prisma.article.findMany({
        where,
        orderBy: { publishedAt: 'desc' },
        take: limit,
        include: INCLUDE,
      });
      for (const row of rows) {
        if (out.length >= limit) break;
        if (seen.has(row.id)) continue;
        seen.add(row.id);
        out.push(toView(row));
      }
    }
    return out;
  }
}
