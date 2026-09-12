import { Injectable } from '@nestjs/common';
import { ArticleCategory } from '@prisma/client';
import { BaseCrudService, CrudDelegate } from '../common/services/base-crud.service';
import { AppException } from '../common/exceptions/app.exception';
import { PrismaService } from '../prisma/prisma.service';
import { slugify } from '../common/slug.util';

@Injectable()
export class ArticleCategoriesService extends BaseCrudService<ArticleCategory> {
  constructor(private readonly prisma: PrismaService) {
    super(prisma.articleCategory as unknown as CrudDelegate<ArticleCategory>, {
      searchFields: ['name', 'description'],
      sortable: ['order', 'createdAt', 'updatedAt', 'name'],
      defaultSort: { order: 'asc' },
      label: '카테고리',
    });
  }

  private async assertSlugFree(slug: string, exceptId?: string): Promise<void> {
    const dupe = await this.prisma.articleCategory.findFirst({
      where: { slug, ...(exceptId ? { id: { not: exceptId } } : {}) },
    });
    if (dupe) throw AppException.conflict('이미 사용 중인 슬러그입니다', 'SLUG_TAKEN');
  }

  async create(data: Record<string, unknown>): Promise<ArticleCategory> {
    const slug = slugify(String(data.slug || data.name || ''));
    if (!slug) throw AppException.badRequest('슬러그를 만들 수 없는 이름입니다');
    await this.assertSlugFree(slug);
    return super.create({ ...data, slug });
  }

  async update(id: string, data: Record<string, unknown>): Promise<ArticleCategory> {
    const payload = { ...data };
    if (payload.slug !== undefined || payload.name !== undefined) {
      const current = await this.findOne(id, { withTrashed: true });
      const slug = slugify(String(payload.slug ?? current.slug));
      if (!slug) throw AppException.badRequest('슬러그를 만들 수 없는 이름입니다');
      await this.assertSlugFree(slug, id);
      payload.slug = slug;
    }
    return super.update(id, payload);
  }
}
