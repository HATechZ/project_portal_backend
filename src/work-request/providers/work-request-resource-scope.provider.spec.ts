import { WorkRequestResourceScopeProvider } from './work-request-resource-scope.provider';
import {
  ActorScopeKind,
  ObjectScopeProvider,
  type ActorScopeContext,
  type ObjectScopeCheck,
} from '../../common/security/object-scope.provider';
import { ActorRoleCode } from '../../generated/prisma/client';
import type { SessionActor } from '../../common/security/session.types';

describe('WorkRequestResourceScopeProvider', () => {
  it('derives SQL scope from an active member company', () => {
    const scopes = {
      resolve: jest.fn().mockReturnValue({
        member: { active: true, companyActive: true, companyId: 'company' },
      }),
    };
    expect(
      new WorkRequestResourceScopeProvider(scopes as never).scopeFor(
        {} as never,
      ),
    ).toEqual({ companyId: 'company' });
  });
  it('derives a tenant-wide list scope from the established object scope', () => {
    const scopes = {
      resolve: jest.fn().mockReturnValue({
        tenantWide: true,
        member: null,
        clientContact: null,
      }),
    };
    expect(
      new WorkRequestResourceScopeProvider(scopes as never).scopeFor(
        {} as never,
      ),
    ).toEqual({ tenantWide: true });
  });
  it('derives the tenant-wide list scope for tenant_super_admin only', () => {
    const provider = new WorkRequestResourceScopeProvider(
      new ObjectScopeProvider(),
    );
    const actor = {
      id: 'actor-id',
      roleId: 'role-id',
      role: {
        isSystemRole: true,
        customScope: null,
        systemRole: { systemCode: ActorRoleCode.tenant_super_admin },
      },
      member: null,
      clientContact: null,
    } as never;

    expect(provider.scopeFor(actor)).toEqual({ tenantWide: true });
  });
  it('turns off the ObjectScopeProvider tenant-admin wildcard for a parent check', () => {
    const resolve = jest
      .fn<ActorScopeContext, [SessionActor]>()
      .mockReturnValue({
        actorProfileId: 'actor-id',
        roleId: 'role-id',
        roleCode: null,
        isSystemRole: true,
        customScope: null,
        boundTeamId: null,
        kind: ActorScopeKind.TenantAdmin,
        tenantWide: true,
        member: null,
        clientContact: null,
      });
    const assertCanAccess = jest.fn<void, [SessionActor, ObjectScopeCheck]>();
    const provider = new WorkRequestResourceScopeProvider({
      resolve,
      assertCanAccess,
    } as never);
    provider.assert({} as never, {
      clientId: 'client',
      companyId: 'company',
      divisionId: null,
      teamId: null,
    });
    expect(assertCanAccess).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ allowTenantAdmin: false }),
    );
  });

  it('uses only the bound Team for a TEAM-scoped custom role', () => {
    const scopes = {
      resolve: jest.fn().mockReturnValue({
        tenantWide: false,
        isSystemRole: false,
        customScope: 'team',
        boundTeamId: 'team-a',
      }),
    };
    const provider = new WorkRequestResourceScopeProvider(scopes as never);

    expect(provider.scopeFor({} as never)).toEqual({ teamId: 'team-a' });
    expect(() =>
      provider.assert({} as never, {
        clientId: 'client',
        companyId: 'company',
        divisionId: 'division-a',
        teamId: 'team-b',
      }),
    ).toThrow();
    expect(() =>
      provider.assert({} as never, {
        clientId: 'client',
        companyId: 'company',
        divisionId: 'division-a',
        teamId: 'team-a',
      }),
    ).not.toThrow();
  });

  it('fails closed when a TEAM-scoped custom role has no grant binding', () => {
    const provider = new WorkRequestResourceScopeProvider({
      resolve: jest.fn().mockReturnValue({
        tenantWide: false,
        isSystemRole: false,
        customScope: 'team',
        boundTeamId: null,
      }),
    } as never);

    expect(() => provider.scopeFor({} as never)).toThrow();
  });

  it('uses only the active Division for a DIVISION-scoped custom role', () => {
    const provider = new WorkRequestResourceScopeProvider({
      resolve: jest.fn().mockReturnValue({
        tenantWide: false,
        isSystemRole: false,
        customScope: 'division',
        member: {
          active: true,
          companyActive: true,
          divisionActive: true,
          divisionId: 'division-a',
        },
      }),
    } as never);

    expect(provider.scopeFor({} as never)).toEqual({
      divisionId: 'division-a',
    });
    expect(() =>
      provider.assert({} as never, {
        clientId: 'client',
        companyId: 'company',
        divisionId: 'division-b',
        teamId: null,
      }),
    ).toThrow();
  });
});
