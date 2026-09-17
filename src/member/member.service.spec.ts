import { ActorRoleCode } from '../generated/prisma/client';
import { ActorScopeKind } from '../common/security/object-scope.provider';
import { MemberService } from './member.service';

describe('MemberService onboarding', () => {
  const now = new Date('2026-09-10T00:00:00.000Z');
  const company = { id: 'company-id' };
  const actor = {
    actorProfileId: 'actor-profile-id',
    roleId: 'system-admin-role-id',
    roleCode: ActorRoleCode.system_admin,
    kind: ActorScopeKind.TenantAdmin,
    tenantWide: true,
    member: null,
    clientContact: null,
  };

  it('hashes the create password and delegates atomic onboarding without plaintext password', async () => {
    const repository = {
      findScopedCompany: jest.fn().mockResolvedValue(company),
    };
    const onboardingRepository = {
      createWithAccess: jest.fn().mockResolvedValue({
        id: 'member-id',
        userId: 'user-id',
        companyId: company.id,
        divisionId: 'division-id',
        name: 'Jane Member',
        email: 'jane@example.com',
        roleTitle: 'Engineer',
        isActive: true,
        createdAt: now,
        updatedAt: now,
      }),
    };
    const scopeProvider = {
      assertCanCreate: jest.fn().mockResolvedValue(undefined),
    };
    const passwordHasher = {
      hash: jest.fn().mockResolvedValue('hashed-password'),
    };
    const service = new MemberService(
      repository as never,
      {} as never,
      onboardingRepository as never,
      {} as never,
      scopeProvider as never,
      passwordHasher as never,
    );

    const result = await service.create(
      {
        name: 'Jane Member',
        email: 'jane@example.com',
        password: 'secret123',
        divisionId: 'division-id',
        designation: 'Engineer',
        phone: '+1-555-0100',
      },
      actor,
    );

    expect(passwordHasher.hash).toHaveBeenCalledWith('secret123');
    expect(scopeProvider.assertCanCreate).toHaveBeenCalledWith(
      actor,
      company.id,
      'division-id',
    );
    expect(onboardingRepository.createWithAccess).toHaveBeenCalledWith(
      company.id,
      {
        name: 'Jane Member',
        email: 'jane@example.com',
        passwordHash: 'hashed-password',
        divisionId: 'division-id',
        designation: 'Engineer',
        phone: '+1-555-0100',
      },
    );
    expect(onboardingRepository.createWithAccess).not.toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ password: 'secret123' }),
    );
    expect(result).toEqual({
      id: 'member-id',
      userId: 'user-id',
      companyId: 'company-id',
      divisionId: 'division-id',
      designation: 'Engineer',
      name: 'Jane Member',
      email: 'jane@example.com',
      isActive: true,
      createdAt: now,
      updatedAt: now,
    });
    expect(result).not.toHaveProperty('user');
    expect(result).not.toHaveProperty('division');
    expect(result).not.toHaveProperty('roleId');
  });

  it('delegates removal to the atomic lifecycle repository', async () => {
    const repository = {
      findScopedCompany: jest.fn().mockResolvedValue(company),
    };
    const scopeProvider = { assertSystemAdmin: jest.fn() };
    const removalRepository = {
      remove: jest.fn().mockResolvedValue(undefined),
    };
    const service = new MemberService(
      repository as never,
      {} as never,
      {} as never,
      {} as never,
      scopeProvider as never,
      {} as never,
      removalRepository as never,
    );
    await service.delete('member-id', actor);

    expect(scopeProvider.assertSystemAdmin).toHaveBeenCalledWith(actor);
    expect(removalRepository.remove).toHaveBeenCalledWith(
      'member-id',
      company.id,
    );
  });

  it('uses the same flat response contract for Member detail and list results', async () => {
    const member = {
      id: 'member-id',
      userId: 'user-id',
      companyId: company.id,
      divisionId: 'division-id',
      name: 'Jane Member',
      email: 'jane@example.com',
      roleTitle: 'Engineer',
      isActive: true,
      createdAt: now,
      updatedAt: now,
    };
    const repository = {
      findScopedCompany: jest.fn().mockResolvedValue(company),
      findById: jest.fn().mockResolvedValue(member),
      findAll: jest.fn().mockResolvedValue([member]),
      count: jest.fn().mockResolvedValue(1),
    };
    const scopeProvider = {
      resolveReadableDivisionIds: jest.fn().mockResolvedValue(['division-id']),
    };
    const service = new MemberService(
      repository as never,
      {} as never,
      {} as never,
      {} as never,
      scopeProvider as never,
      {} as never,
      {} as never,
    );

    const detail = await service.findOne('member-id', actor);
    const list = await service.findAll({}, actor);

    expect(detail).toEqual({
      id: 'member-id',
      userId: 'user-id',
      companyId: 'company-id',
      divisionId: 'division-id',
      name: 'Jane Member',
      email: 'jane@example.com',
      designation: 'Engineer',
      isActive: true,
      createdAt: now,
      updatedAt: now,
    });
    expect(list.items).toEqual([detail]);
    expect(detail).not.toHaveProperty('user');
    expect(detail).not.toHaveProperty('division');
    expect(detail).not.toHaveProperty('roleId');
    expect(list.items[0]).not.toHaveProperty('user');
    expect(list.items[0]).not.toHaveProperty('division');
    expect(list.items[0]).not.toHaveProperty('roleId');
  });
});
