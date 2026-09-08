import { ForbiddenException } from '@nestjs/common';
import { RequestContext } from '../common/context/request-context';
import { ActorRoleCode } from '../generated/prisma/client';
import { ActorProfileService } from './actor-profile.service';
import { ActorProfileRepository } from './repositories/actor-profile.repository';

describe('ActorProfileService', () => {
  const repository = { findForUser: jest.fn(), setDefault: jest.fn() };
  const actor = {
    id: 'actor-1',
    roleId: 'role-1',
    memberId: null,
    clientContactId: null,
    label: 'System Administrator',
    isDefault: true,
    isActive: true,
    role: { code: ActorRoleCode.system_admin },
  };
  const service = () =>
    new ActorProfileService(repository as unknown as ActorProfileRepository);

  beforeEach(() => jest.clearAllMocks());

  it('lists only profiles returned for the authenticated User', async () => {
    repository.findForUser.mockResolvedValue([actor]);

    await expect(service().findForUser('user-1')).resolves.toEqual([
      expect.objectContaining({
        id: 'actor-1',
        roleCode: ActorRoleCode.system_admin,
        memberId: null,
        clientContactId: null,
      }),
    ]);
    expect(repository.findForUser).toHaveBeenCalledWith('user-1');
  });

  it('activates an eligible owned profile and updates acting context', async () => {
    repository.setDefault.mockResolvedValue(actor);

    await RequestContext.run(
      { requestId: 'activate', tenantId: 'tenant-1' },
      async () => {
        await expect(service().activate('actor-1', 'user-1')).resolves.toEqual(
          expect.objectContaining({ id: 'actor-1', isDefault: true }),
        );
        expect(RequestContext.actorId()).toBe('actor-1');
      },
    );
  });

  it('rejects an unavailable or unowned profile', async () => {
    repository.setDefault.mockResolvedValue(null);

    await expect(
      RequestContext.run({ requestId: 'activate', tenantId: 'tenant-1' }, () =>
        service().activate('actor-other', 'user-1'),
      ),
    ).rejects.toEqual(
      new ForbiddenException('Actor profile is unavailable for this account'),
    );
  });
});
