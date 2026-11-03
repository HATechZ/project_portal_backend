import { AppErrorCode } from '../../common/exceptions/app-error-code';
import { RequestContext } from '../../common/context/request-context';
import { DivisionLeadRepository } from './division-lead.repository';

const TENANT = 'tenant-1';
const COMPANY = 'company-1';

/** Active Member in the target Division. */
const MEMBER = {
  id: 'member-1',
  name: 'Lead User',
  email: 'lead@example.com',
  userId: 'user-1',
  divisionId: 'division-a',
  tenantId: TENANT,
  companyId: COMPANY,
  isActive: true,
};

interface DbOverrides {
  activeForPair?: unknown;
  incumbent?: unknown;
  member?: unknown;
}

function makeDb({
  activeForPair = null,
  incumbent = null,
  member = MEMBER,
}: DbOverrides = {}) {
  return {
    $queryRaw: jest.fn().mockResolvedValue([{ id: 'user-1' }]),
    division: {
      findUnique: jest
        .fn()
        .mockResolvedValue({ id: 'division-a', name: 'Alpha', abbr: 'ALP' }),
    },
    member: {
      findFirst: jest
        .fn()
        .mockImplementation(({ where }: { where: Partial<typeof MEMBER> }) => {
          const candidate = member as typeof MEMBER | null;
          return Promise.resolve(
            candidate &&
              Object.entries(where).every(
                ([key, value]) =>
                  candidate[key as keyof typeof MEMBER] === value,
              )
              ? candidate
              : null,
          );
        }),
      update: jest.fn().mockResolvedValue({}),
    },
    divisionLead: {
      // first call = "is this pair already active?", second = "who is incumbent?"
      findFirst: jest
        .fn()
        .mockResolvedValueOnce(activeForPair)
        .mockResolvedValueOnce(incumbent),
      create: jest
        .fn()
        .mockResolvedValue({ assignedAt: new Date('2026-09-15T10:00:00Z') }),
      update: jest.fn().mockResolvedValue({}),
    },
    role: {
      findFirstOrThrow: jest
        .fn()
        .mockResolvedValue({ id: 'role-1', name: 'Division Lead' }),
      findUniqueOrThrow: jest
        .fn()
        .mockResolvedValue({ id: 'role-1', name: 'Division Lead' }),
    },
    user: {
      findUniqueOrThrow: jest.fn().mockResolvedValue({ id: 'user-1' }),
      findFirst: jest.fn().mockResolvedValue({ id: 'user-1' }),
    },
    userRole: {
      findFirst: jest.fn().mockResolvedValue({ id: 'user-role-1' }),
      create: jest.fn(),
    },
    actorProfile: {
      findFirst: jest.fn().mockResolvedValue({
        id: 'actor-profile-1',
        userId: 'user-1',
        roleId: 'role-1',
        memberId: null,
        isActive: true,
      }),
      updateMany: jest.fn(),
      update: jest.fn().mockResolvedValue({ id: 'actor-profile-1' }),
      create: jest.fn(),
    },
  };
}

/** `jest.fn()` types `mock.calls` as `any[]`; narrow it once here. */
function firstArg<T>(mock: jest.Mock): T {
  const calls = mock.mock.calls as unknown[][];
  return calls[0][0] as T;
}

function repositoryOver(db: unknown) {
  const unitOfWork = {
    execute: (work: (executor: unknown) => unknown) => work(db),
  };
  return new DivisionLeadRepository(unitOfWork as never);
}

function inTenant<T>(work: () => T): T {
  return RequestContext.run({ requestId: 'req-1', tenantId: TENANT }, work);
}

const assignInput = {
  companyId: COMPANY,
  divisionId: 'division-a',
  memberId: MEMBER.id,
  assignedByUserId: 'admin-1',
};

describe('DivisionLeadRepository', () => {
  it('assigns an active Member from the exact Division', async () => {
    const db = makeDb();
    const result = await inTenant(() => repositoryOver(db).assign(assignInput));

    expect(result.idempotent).toBe(false);
    expect(result.revokedIncumbent).toBeNull();
    expect(db.divisionLead.create).toHaveBeenCalledTimes(1);

    // The written row and Member belong to the same target Division.
    const written = firstArg<{
      data: { divisionId: string; memberId: string; tenantId: string };
    }>(db.divisionLead.create);
    expect(written.data.divisionId).toBe('division-a');
    expect(written.data.divisionId).toBe(MEMBER.divisionId);
    expect(written.data.memberId).toBe(MEMBER.id);
    expect(written.data.tenantId).toBe(TENANT);
  });

  it('requires matching Tenant, Company and exact Division', async () => {
    const db = makeDb();
    await inTenant(() => repositoryOver(db).assign(assignInput));

    const { where } = firstArg<{ where: Record<string, unknown> }>(
      db.member.findFirst,
    );
    expect(where).toMatchObject({ tenantId: TENANT, companyId: COMPANY });
    expect(where.divisionId).toBe('division-a');
  });

  it('rejects cross-Division, foreign-Tenant and inactive candidates before writing', async () => {
    for (const member of [
      { ...MEMBER, divisionId: 'division-b' },
      { ...MEMBER, tenantId: 'tenant-b' },
      { ...MEMBER, isActive: false },
    ]) {
      const db = makeDb({ member });
      await expect(
        inTenant(() => repositoryOver(db).assign(assignInput)),
      ).rejects.toMatchObject({ status: 404 });
      expect(db.divisionLead.create).not.toHaveBeenCalled();
      expect(db.divisionLead.update).not.toHaveBeenCalled();
    }
  });

  it('revokes the incumbent in the same transaction as the insert', async () => {
    const db = makeDb({
      incumbent: {
        id: 'lead-row-old',
        assignedAt: new Date('2026-01-01T00:00:00Z'),
        assignedByUserId: 'admin-0',
        member: { id: 'member-0', name: 'Old', email: 'old@example.com' },
      },
    });
    const result = await inTenant(() => repositoryOver(db).assign(assignInput));

    expect(result.revokedIncumbent?.member.id).toBe('member-0');
    expect(db.divisionLead.update).toHaveBeenCalledTimes(1);
    const revoke = firstArg<{
      where: { id: string };
      data: { revokedAt: Date; revokedByUserId: string };
    }>(db.divisionLead.update);
    expect(revoke.where.id).toBe('lead-row-old');
    expect(revoke.data.revokedAt).toBeInstanceOf(Date);
    expect(revoke.data.revokedByUserId).toBe('admin-1');
    expect(db.divisionLead.create).toHaveBeenCalledTimes(1);
  });

  it('is a no-op when the Member already leads the Division', async () => {
    const db = makeDb({
      activeForPair: { assignedAt: new Date('2026-05-05T00:00:00Z') },
    });
    const result = await inTenant(() => repositoryOver(db).assign(assignInput));

    expect(result.idempotent).toBe(true);
    expect(result.assignedAt).toEqual(new Date('2026-05-05T00:00:00Z'));
    expect(db.divisionLead.create).not.toHaveBeenCalled();
    expect(db.divisionLead.update).not.toHaveBeenCalled();
  });

  it('does not require a User, UserRole, or ActorProfile for a Member lead', async () => {
    const db = makeDb({ member: { ...MEMBER, userId: null } });

    await expect(
      inTenant(() => repositoryOver(db).assign(assignInput)),
    ).resolves.toMatchObject({ member: { userId: null } });
    expect(db.divisionLead.create).toHaveBeenCalledTimes(1);
    expect(db.divisionLead.update).not.toHaveBeenCalled();
    expect(db.userRole.create).not.toHaveBeenCalled();
  });

  it('revokes by timestamp and never deletes', async () => {
    const db = makeDb({
      activeForPair: {
        id: 'lead-row-1',
        assignedAt: new Date('2026-02-02T00:00:00Z'),
        assignedByUserId: 'admin-1',
        member: { id: MEMBER.id, name: MEMBER.name, email: MEMBER.email },
      },
    });
    const result = await inTenant(() =>
      repositoryOver(db).revoke({
        companyId: COMPANY,
        divisionId: 'division-a',
        revokedByUserId: 'admin-2',
      }),
    );

    expect(result.member.id).toBe(MEMBER.id);
    const revoke = firstArg<{
      data: { revokedAt: Date; revokedByUserId: string };
    }>(db.divisionLead.update);
    expect(revoke.data.revokedAt).toBeInstanceOf(Date);
    expect(revoke.data.revokedByUserId).toBe('admin-2');
    expect(db.divisionLead).not.toHaveProperty('delete');
  });

  it('404s when revoking a Division with no active Lead', async () => {
    const db = makeDb();
    await expect(
      inTenant(() =>
        repositoryOver(db).revoke({
          companyId: COMPANY,
          divisionId: 'division-a',
          revokedByUserId: 'admin-2',
        }),
      ),
    ).rejects.toMatchObject({ code: AppErrorCode.NotFound });
    expect(db.divisionLead.update).not.toHaveBeenCalled();
  });

  it('reads only active rows and returns null for a Lead-less Division', async () => {
    const db = makeDb();
    await expect(
      inTenant(() => repositoryOver(db).findActiveLead('division-a', COMPANY)),
    ).resolves.toBeNull();

    const { where } = firstArg<{ where: Record<string, unknown> }>(
      db.divisionLead.findFirst,
    );
    expect(where).toMatchObject({ tenantId: TENANT, revokedAt: null });
  });
});
