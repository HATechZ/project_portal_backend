import { ForbiddenException } from '@nestjs/common';
import {
  ActorScopeContext,
  ActorScopeKind,
} from '../../common/security/object-scope.provider';
import { ActorRoleCode } from '../../generated/prisma/client';
import { MemberScopeProvider } from './member-scope.provider';

const COMPANY = 'company-1';
const DIVISION_A = 'division-a';
const DIVISION_B = 'division-b';
const DIVISION_C = 'division-c';
const HOME = 'division-home';

function actor(
  roleCode: ActorRoleCode,
  ledDivisionIds: string[],
): ActorScopeContext {
  return {
    actorProfileId: 'actor-profile',
    roleId: 'role-id',
    roleCode,
    kind: ActorScopeKind.Member,
    tenantWide: false,
    member: {
      id: 'member-1',
      companyId: COMPANY,
      // Home Division is deliberately none of the led Divisions.
      divisionId: HOME,
      ledDivisionIds,
      active: true,
      companyActive: true,
      divisionActive: true,
    },
    clientContact: null,
  };
}

function providerWith(ledTeamDivisionId: string | null = null) {
  const repository = {
    findDivision: jest
      .fn()
      .mockImplementation((id: string) =>
        Promise.resolve(
          [DIVISION_A, DIVISION_B, DIVISION_C].includes(id) ? { id } : null,
        ),
      ),
    findCompanyDivisionIds: jest
      .fn()
      .mockResolvedValue([DIVISION_A, DIVISION_B]),
    findLedTeamDivisionId: jest.fn().mockResolvedValue(ledTeamDivisionId),
  };
  return { provider: new MemberScopeProvider(repository as never), repository };
}

describe('MemberScopeProvider Division sets', () => {
  it('returns every Division a lead actively leads', async () => {
    const { provider } = providerWith();
    await expect(
      provider.resolveReadableDivisionIds(
        actor(ActorRoleCode.division_lead, [DIVISION_A, DIVISION_B]),
        COMPANY,
      ),
    ).resolves.toEqual([DIVISION_A, DIVISION_B]);
  });

  it('permits creation in the SECOND led Division', async () => {
    const { provider } = providerWith();
    await expect(
      provider.assertCanCreate(
        actor(ActorRoleCode.division_lead, [DIVISION_A, DIVISION_B]),
        COMPANY,
        DIVISION_B,
      ),
    ).resolves.toBeUndefined();
  });

  it('denies a Division the actor does not lead', async () => {
    const { provider } = providerWith();
    await expect(
      provider.assertCanCreate(
        actor(ActorRoleCode.division_lead, [DIVISION_A]),
        COMPANY,
        DIVISION_C,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('denies a requested Division outside the led set', async () => {
    const { provider } = providerWith();
    await expect(
      provider.resolveReadableDivisionIds(
        actor(ActorRoleCode.division_lead, [DIVISION_A]),
        COMPANY,
        DIVISION_C,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('denies an empty led set instead of falling back to the home Division', async () => {
    const { provider } = providerWith();
    const leadWithNothing = actor(ActorRoleCode.division_lead, []);

    await expect(
      provider.resolveReadableDivisionIds(leadWithNothing, COMPANY),
    ).rejects.toBeInstanceOf(ForbiddenException);
    // The home Division must never leak in as implicit authority.
    await expect(
      provider.assertCanCreate(leadWithNothing, COMPANY, HOME),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('preserves the unrelated Team-Lead fallback', async () => {
    const { provider, repository } = providerWith(DIVISION_A);
    await expect(
      provider.resolveReadableDivisionIds(
        actor(ActorRoleCode.division_member, []),
        COMPANY,
      ),
    ).resolves.toEqual([DIVISION_A]);
    expect(repository.findLedTeamDivisionId).toHaveBeenCalled();
  });
});
