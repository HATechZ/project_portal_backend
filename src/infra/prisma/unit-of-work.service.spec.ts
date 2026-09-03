import { RequestContext } from '../../common/context/request-context';
import { PrismaService } from './prisma.service';
import { UnitOfWorkService } from './unit-of-work.service';

describe('UnitOfWorkService', () => {
  const transaction = {
    $executeRaw: jest.fn(),
    user: { findMany: jest.fn() },
    companyType: { findMany: jest.fn() },
  };
  const prisma = {
    $transaction: jest.fn(
      async (work: (client: typeof transaction) => Promise<unknown>) =>
        work(transaction),
    ),
    scoped: {
      $transaction: jest.fn(
        async (work: (client: typeof transaction) => Promise<unknown>) =>
          work(transaction),
      ),
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('sets the transaction-local tenant before exposing the client', async () => {
    const order: string[] = [];
    transaction.$executeRaw.mockImplementation(() => {
      order.push('guc');
      return Promise.resolve(1);
    });

    const unitOfWork = new UnitOfWorkService(
      prisma as unknown as PrismaService,
    );
    await RequestContext.run(
      { requestId: 'request-1', tenantId: 'tenant-1' },
      () =>
        unitOfWork.execute((client) => {
          order.push('work');
          expect(unitOfWork.client).toBe(client);
          return Promise.resolve();
        }),
    );

    expect(order).toEqual(['guc', 'work']);
    expect(transaction.$executeRaw).toHaveBeenCalledWith(
      ["SELECT set_config('app.tenant_id', ", ', true)'],
      'tenant-1',
    );
  });

  it('rejects missing tenant context before opening a transaction', async () => {
    const unitOfWork = new UnitOfWorkService(
      prisma as unknown as PrismaService,
    );

    await expect(
      RequestContext.run({ requestId: 'request-2' }, () =>
        unitOfWork.execute(() => Promise.resolve(undefined)),
      ),
    ).rejects.toThrow('Tenant context is required');
    expect(prisma.scoped.$transaction).not.toHaveBeenCalled();
  });

  it('does not expose a root client outside a unit of work', () => {
    const unitOfWork = new UnitOfWorkService(
      prisma as unknown as PrismaService,
    );

    expect(() => unitOfWork.client).toThrow(
      'Repository access requires an active unit of work',
    );
  });

  it('opens onboarding through app_user without requiring tenant context', async () => {
    const unitOfWork = new UnitOfWorkService(
      prisma as unknown as PrismaService,
    );

    await RequestContext.run({ requestId: 'signup-request' }, () =>
      unitOfWork.executeProvisioning((client) => {
        expect(Object.keys(client)).toEqual(['$queryRaw']);
        expect(Object.isFrozen(client)).toBe(true);
        expect('user' in client).toBe(false);
        expect(() => unitOfWork.client).toThrow(
          'Repository access requires an active unit of work',
        );
        return Promise.resolve();
      }),
    );

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(prisma.scoped.$transaction).not.toHaveBeenCalled();
  });

  it('exposes only a raw-query capability for a pre-tenant reference read', async () => {
    const unitOfWork = new UnitOfWorkService(
      prisma as unknown as PrismaService,
    );

    await RequestContext.run({ requestId: 'reference-request' }, () =>
      unitOfWork.executeReferenceRead((client) => {
        expect(Object.keys(client)).toEqual(['$queryRaw']);
        expect(Object.isFrozen(client)).toBe(true);
        expect('companyType' in client).toBe(false);
        expect(() => unitOfWork.client).toThrow(
          'Repository access requires an active unit of work',
        );
        return Promise.resolve();
      }),
    );

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(prisma.scoped.$transaction).not.toHaveBeenCalled();
  });
});
