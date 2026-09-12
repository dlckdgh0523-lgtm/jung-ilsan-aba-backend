import { Injectable } from '@nestjs/common';
import { Prisma, Tag } from '@prisma/client';
import { AppException } from '../common/exceptions/app.exception';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import {
  listResult,
  parseSort,
  skipTake,
  type ListResult,
} from '../common/pagination/paginate.util';
import { PrismaService } from '../prisma/prisma.service';
import { slugify } from '../common/slug.util';

/** Tag pages become sitemap/index targets at this many published posts (spec §9). */
export const TAG_INDEX_MIN_ARTICLES = 3;

export type TagView = Tag & { articleCount: number; indexable: boolean };

const PUBLISHED_ARTICLE_WHERE: Prisma.ArticleWhereInput = {
  deletedAt: null,
  visible: true,
  status: 'published',
};

@Injectable()
export class TagsService {
  constructor(private readonly prisma: PrismaService) {}

  private toView(tag: Tag & { _count?: { articles: number } }, publishedCount: number): TagView {
    const { _count, ...rest } = tag;
    void _count;
    return {
      ...rest,
      articleCount: publishedCount,
      indexable: tag.seoIndexed || publishedCount >= TAG_INDEX_MIN_ARTICLES,
    };
  }

  private async publishedCounts(tagIds: string[]): Promise<Map<string, number>> {
    if (tagIds.length === 0) return new Map();
    const rows = await this.prisma.articleTag.groupBy({
      by: ['tagId'],
      where: { tagId: { in: tagIds }, article: PUBLISHED_ARTICLE_WHERE },
      _count: { tagId: true },
    });
    return new Map(rows.map((r) => [r.tagId, r._count.tagId]));
  }

  async list(query: PaginationQueryDto): Promise<ListResult<TagView>> {
    const where: Prisma.TagWhereInput = query.q
      ? {
          OR: [
            { name: { contains: query.q, mode: 'insensitive' } },
            { slug: { contains: query.q, mode: 'insensitive' } },
          ],
        }
      : {};
    const orderBy = parseSort(query.sort, ['name', 'createdAt', 'updatedAt', 'tagType'], {
      name: 'asc',
    });
    const { skip, take } = skipTake(query.page, query.pageSize);
    const [tags, total] = await Promise.all([
      this.prisma.tag.findMany({ where, orderBy, skip, take }),
      this.prisma.tag.count({ where }),
    ]);
    const counts = await this.publishedCounts(tags.map((t) => t.id));
    return listResult(
      tags.map((t) => this.toView(t, counts.get(t.id) ?? 0)),
      total,
      query.page,
      query.pageSize,
    );
  }

  async findOne(idOrSlug: string): Promise<TagView> {
    const tag = await this.prisma.tag.findFirst({
      where: { OR: [{ id: idOrSlug }, { slug: idOrSlug }] },
    });
    if (!tag) throw AppException.notFound('태그를 찾을 수 없습니다');
    const counts = await this.publishedCounts([tag.id]);
    return this.toView(tag, counts.get(tag.id) ?? 0);
  }

  private async assertUnique(name: string, slug: string, exceptId?: string): Promise<void> {
    const dupe = await this.prisma.tag.findFirst({
      where: {
        OR: [{ name }, { slug }],
        ...(exceptId ? { id: { not: exceptId } } : {}),
      },
    });
    if (dupe)
      throw AppException.conflict('이미 존재하는 태그(이름 또는 슬러그)입니다', 'TAG_TAKEN');
  }

  async create(data: {
    name: string;
    slug?: string;
    description?: string;
    seoTitle?: string;
    seoDescription?: string;
    tagType?: string;
    seoIndexed?: boolean;
  }): Promise<TagView> {
    const name = data.name.trim();
    const slug = slugify(data.slug || name);
    if (!name || !slug) throw AppException.badRequest('태그 이름이 올바르지 않습니다');
    await this.assertUnique(name, slug);
    const tag = await this.prisma.tag.create({ data: { ...data, name, slug } });
    return this.toView(tag, 0);
  }

  async update(id: string, data: Record<string, unknown>): Promise<TagView> {
    const current = await this.prisma.tag.findUnique({ where: { id } });
    if (!current) throw AppException.notFound('태그를 찾을 수 없습니다');
    const name = data.name !== undefined ? String(data.name).trim() : current.name;
    const slug =
      data.slug !== undefined || data.name !== undefined
        ? slugify(String(data.slug ?? current.slug) || name)
        : current.slug;
    if (!name || !slug) throw AppException.badRequest('태그 이름이 올바르지 않습니다');
    await this.assertUnique(name, slug, id);
    const tag = await this.prisma.tag.update({ where: { id }, data: { ...data, name, slug } });
    const counts = await this.publishedCounts([id]);
    return this.toView(tag, counts.get(id) ?? 0);
  }

  /** Hard delete — ArticleTag rows cascade, so no dangling links remain on posts. */
  async remove(id: string): Promise<void> {
    try {
      await this.prisma.tag.delete({ where: { id } });
    } catch {
      throw AppException.notFound('태그를 찾을 수 없습니다');
    }
  }

  /** Tags whose pages belong in the sitemap (>=3 published posts, or admin-forced). */
  async indexableTags(): Promise<TagView[]> {
    const tags = await this.prisma.tag.findMany({ orderBy: { name: 'asc' } });
    const counts = await this.publishedCounts(tags.map((t) => t.id));
    return tags
      .map((t) => this.toView(t, counts.get(t.id) ?? 0))
      .filter((t) => t.indexable && t.articleCount > 0);
  }
}
