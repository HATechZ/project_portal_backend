import { WorkRequestResourceScopeProvider } from './work-request-resource-scope.provider';

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
  it('turns off the ObjectScopeProvider tenant-admin wildcard for a parent check', () => {
    const assertCanAccess = jest.fn();
    const provider = new WorkRequestResourceScopeProvider({
      assertCanAccess,
    } as never);
    provider.assert({} as never, { clientId: 'client', companyId: 'company' });
    expect(assertCanAccess).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ allowTenantAdmin: false }),
    );
  });
});
