import { RequestContext } from '../../common/context/request-context';
import type { Prisma } from '../../generated/prisma/client';
import { WorkRequestReadRepository } from './work-request-read.repository';

describe('participating Member Work Request read scope', () => {
  const actor = {
    role: { customScope: 'member', systemRole: null },
    member: {
      id: 'member-a',
      isActive: true,
      company: { isActive: true },
      divisionLeadsByMemberId: [],
    },
  } as never;
  const participation = {
    route: {
      is: {
        memberSteps: { some: { memberId: 'member-a', cancelledAt: null } },
      },
    },
  };

  it('applies the same tenant-scoped participation predicate to list, count, detail, and archive reads', async () => {
    let listWhere: Prisma.WorkRequestV1WhereInput | undefined;
    let countWhere: Prisma.WorkRequestV1WhereInput | undefined;
    let detailWhere: Prisma.WorkRequestV1WhereInput | undefined;
    const db = {
      workRequestV1: {
        findMany: jest
          .fn()
          .mockImplementation((args: Prisma.WorkRequestV1FindManyArgs) => {
            listWhere = args.where;
            return Promise.resolve([]);
          }),
        count: jest
          .fn()
          .mockImplementation((args: Prisma.WorkRequestV1CountArgs) => {
            countWhere = args.where;
            return Promise.resolve(0);
          }),
        findFirst: jest
          .fn()
          .mockImplementation((args: Prisma.WorkRequestV1FindFirstArgs) => {
            detailWhere = args.where;
            return Promise.resolve(null);
          }),
      },
    };
    const repository = new WorkRequestReadRepository({
      execute: (work: (value: unknown) => Promise<unknown>) => work(db),
    } as never);
    await RequestContext.run({ tenantId: 'tenant-a' } as never, async () => {
      await repository.list(0, 20, actor, 'archived');
      await repository.count(actor, 'archived');
      await repository.find('request-a', actor);
    });
    expect(listWhere?.tenantId).toBe('tenant-a');
    expect(countWhere?.tenantId).toBe('tenant-a');
    expect(detailWhere?.tenantId).toBe('tenant-a');
    expect(listWhere?.archivedAt).toEqual({ not: null });
    expect(countWhere?.archivedAt).toEqual({ not: null });
    expect(detailWhere?.id).toBe('request-a');
    expect(listWhere?.OR).toContainEqual(participation);
    expect(countWhere?.OR).toContainEqual(participation);
    expect(detailWhere?.OR).toContainEqual(participation);
  });
});
