import { ForbiddenException } from '@nestjs/common';
import {
  ActorScopeContext,
  ActorScopeKind,
} from '../../common/security/object-scope.provider';
import { ActorRoleCode } from '../../generated/prisma/client';
import { TeamRecord } from '../repositories';
import { TeamScopeProvider } from './team-scope.provider';

const COMPANY = 'company-1';
const DIVISION_A = 'division-a';
const DIVISION_B = 'division-b';
const DIVISION_C = 'division-c';
const HOME = 'division-home';

function actor(ledDivisionIds: string[]): ActorScopeContext {
  return {
    actorProfileId: 'actor-profile',
    roleId: 'role-id',
    roleCode: ActorRoleCode.division_lead,
    kind: ActorScopeKind.Member,
    tenantWide: false,
    member: {
      id: 'member-1',
      companyId: COMPANY,
      divisionId: HOME,
      ledDivisionIds,
      active: true,
      companyActive: true,
      divisionActive: true,
    },
    clientContact: null,
  };
}

function teamIn(divisionId: string): TeamRecord {
  return { id: 'team-1', divisionId, leadMemberId: null } as TeamRecord;
}

function provider() {
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
  };
  return new TeamScopeProvider(repository as never);
}

describe('TeamScopeProvider Division sets', () => {
  it('manages Teams in every led Division', async () => {
    await expect(
      provider().resolveManageDivisionIds(
        actor([DIVISION_A, DIVISION_B]),
        COMPANY,
      ),
    ).resolves.toEqual([DIVISION_A, DIVISION_B]);
  });

  it('allows a Team in the SECOND led Division', async () => {
    await expect(
      provider().assertCanManageTeam(
        actor([DIVISION_A, DIVISION_B]),
        COMPANY,
        teamIn(DIVISION_B),
      ),
    ).resolves.toBeUndefined();
  });

  it('denies a Team outside the led set', async () => {
    await expect(
      provider().assertCanManageTeam(
        actor([DIVISION_A]),
        COMPANY,
        teamIn(DIVISION_C),
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('allows membership management in any led Division', () => {
    expect(() =>
      provider().assertCanManageMembership(
        actor([DIVISION_A, DIVISION_B]),
        teamIn(DIVISION_B),
      ),
    ).not.toThrow();
  });

  it('denies an empty led set instead of falling back to the home Division', async () => {
    await expect(
      provider().resolveManageDivisionIds(actor([]), COMPANY),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(() =>
      provider().assertCanManageMembership(actor([]), teamIn(HOME)),
    ).toThrow(ForbiddenException);
  });
});
