import { ArticleCategoriesService } from './article-categories.service';

const row = (over: Record<string, unknown> = {}) => ({
  id: 'c1',
  name: 'ABA 전문 정보',
  slug: 'aba-info',
  description: null,
  order: 0,
  visible: true,
  deletedAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...over,
});

function makeService() {
  const delegate = {
    findMany: jest.fn().mockResolvedValue([]),
    findFirst: jest.fn(),
    count: jest.fn().mockResolvedValue(0),
    create: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
    delete: jest.fn(),
  };
  const prisma = { articleCategory: delegate };
  return { delegate, service: new ArticleCategoriesService(prisma as never) };
}

describe('ArticleCategoriesService', () => {
  it('create derives the slug from the name and appends to the order', async () => {
    const { delegate, service } = makeService();
    delegate.findFirst.mockResolvedValue(null); // slug free
    delegate.findMany.mockResolvedValue([row({ order: 3 })]); // nextOrder
    delegate.create.mockImplementation(({ data }: { data: Record<string, unknown> }) =>
      Promise.resolve(row(data)),
    );
    await service.create({ name: '부모교육 콘텐츠' });
    const data = delegate.create.mock.calls[0][0].data;
    expect(data.slug).toBe('부모교육-콘텐츠');
    expect(data.order).toBe(4);
  });

  it('create rejects a taken slug', async () => {
    const { delegate, service } = makeService();
    delegate.findFirst.mockResolvedValue(row());
    await expect(service.create({ name: 'ABA 전문 정보', slug: 'aba-info' })).rejects.toThrow(
      '이미 사용 중인 슬러그',
    );
  });

  it('create rejects names that cannot form a slug', async () => {
    const { service } = makeService();
    await expect(service.create({ name: '???' })).rejects.toThrow('슬러그를 만들 수 없는');
  });

  it('update re-slugs when the slug field changes', async () => {
    const { delegate, service } = makeService();
    delegate.findFirst
      .mockResolvedValueOnce(row()) // findOne (current)
      .mockResolvedValueOnce(null) // slug free check
      .mockResolvedValueOnce(row()); // findOne inside super.update
    delegate.update.mockImplementation(({ data }: { data: Record<string, unknown> }) =>
      Promise.resolve(row(data)),
    );
    await service.update('c1', { slug: 'NEW Slug' });
    const data = delegate.update.mock.calls[0][0].data;
    expect(data.slug).toBe('new-slug');
  });

  it('update without name/slug leaves the slug untouched', async () => {
    const { delegate, service } = makeService();
    delegate.findFirst.mockResolvedValue(row());
    delegate.update.mockImplementation(({ data }: { data: Record<string, unknown> }) =>
      Promise.resolve(row(data)),
    );
    await service.update('c1', { description: '설명만 변경' });
    const data = delegate.update.mock.calls[0][0].data;
    expect(data.slug).toBeUndefined();
  });
});
