import { RequestContext } from '../../common/context/request-context';
import { establishPortalAccess } from './client-portal-access';

const tenantId = '11111111-1111-4111-8111-111111111111';
const roleId = '22222222-2222-4222-8222-222222222222';

function database(
  role: { id: string; name: string; customScope: string } | null,
) {
  return {
    user: {
      findFirst: jest.fn().mockResolvedValue({
        id: '33333333-3333-4333-8333-333333333333',
        email: 'contact@example.com',
        passwordHash: 'hash',
      }),
    },
    $queryRaw: jest.fn().mockResolvedValue([]),
    role: { findFirst: jest.fn().mockResolvedValue(role) },
    userRole: { findFirst: jest.fn().mockResolvedValue({ id: 'grant-id' }) },
    actorProfile: {
      findFirst: jest
        .fn()
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ id: 'default' }),
      updateMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    clientContact: {
      update: jest.fn().mockResolvedValue({
        id: 'contact-id',
        userId: '33333333-3333-4333-8333-333333333333',
        clientId: 'client-id',
        name: 'Contact',
        email: 'contact@example.com',
      }),
    },
  };
}

describe('establishPortalAccess', () => {
  it.each<[customScope: 'client' | 'client_contact']>([
    ['client'],
    ['client_contact'],
  ])(
    'uses an explicit active tenant custom role with %s scope',
    async (customScope) => {
      const db = database({
        id: roleId,
        name: 'External reviewer',
        customScope,
      });

      const result = await RequestContext.run(
        { requestId: 'request-id', tenantId },
        () =>
          establishPortalAccess(
            db as never,
            { id: 'client-id', name: 'Client' },
            {
              id: 'contact-id',
              name: 'Contact',
              email: 'contact@example.com',
              userId: '33333333-3333-4333-8333-333333333333',
            },
            'assigned-by',
            roleId,
          ),
      );

      expect(db.role.findFirst).toHaveBeenCalledWith({
        where: {
          id: roleId,
          tenantId,
          isSystemRole: false,
          isActive: true,
          customScope: { in: ['client', 'client_contact'] },
        },
        select: { id: true, name: true, customScope: true },
      });
      expect(result.role).toEqual({ id: roleId, scope: customScope });
    },
  );

  it('fails closed when the selected role is not an eligible external custom role', async () => {
    const db = database(null);

    await expect(
      RequestContext.run({ requestId: 'request-id', tenantId }, () =>
        establishPortalAccess(
          db as never,
          { id: 'client-id', name: 'Client' },
          {
            id: 'contact-id',
            name: 'Contact',
            email: 'contact@example.com',
            userId: '33333333-3333-4333-8333-333333333333',
          },
          'assigned-by',
          roleId,
        ),
      ),
    ).rejects.toThrow('Selected external custom role is unavailable');
  });
});
