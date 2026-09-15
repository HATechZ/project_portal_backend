import { ActorRoleCode } from '../../generated/prisma/client';
import { ObjectScopeProvider } from './object-scope.provider';

describe('ObjectScopeProvider client owner scope', () => {
  const provider = new ObjectScopeProvider();
  const actor = {
    id: 'actor-id',
    roleId: 'role-id',
    memberId: null,
    clientContactId: 'contact-id',
    label: 'Client Owner',
    isDefault: true,
    role: {
      code: ActorRoleCode.client_owner,
      workflowActionRolePermissionsByRoleId: [],
    },
    member: null,
    clientContact: {
      id: 'contact-id',
      clientId: 'client-id',
      isActive: true,
      client: {
        id: 'client-id',
        companyId: 'company-id',
        isActive: true,
        company: { id: 'company-id', isActive: true },
      },
    },
  };

  it('allows only the Client linked through the active ClientContact profile', () => {
    expect(
      provider.canAccess(actor, {
        allOf: [{ kind: 'client', clientId: 'client-id' }],
      }).allowed,
    ).toBe(true);
    expect(
      provider.canAccess(actor, {
        allOf: [{ kind: 'client', clientId: 'other-client-id' }],
      }).allowed,
    ).toBe(false);
  });
});
