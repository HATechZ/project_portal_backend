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
        division: { id: 'division-id', name: 'Division', abbr: 'DIV' },
        user: {
          id: 'user-id',
          fullName: 'Jane Member',
          email: 'jane@example.com',
        },
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

    await service.create(
      {
        name: 'Jane Member',
        email: 'jane@example.com',
        password: 'secret123',
        divisionId: 'division-id',
        roleId: 'role-id',
        designation: 'Engineer',
        phone: '+1-555-0100',
      },
      actor,
      'admin-user-id',
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
        roleId: 'role-id',
        assignedByUserId: 'admin-user-id',
        designation: 'Engineer',
        phone: '+1-555-0100',
      },
    );
    expect(onboardingRepository.createWithAccess).not.toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ password: 'secret123' }),
    );
  });
});
