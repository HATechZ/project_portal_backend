import { RequestContext } from '../../common/context/request-context';
import { TeamMembershipRepository } from './team-membership.repository';

describe('TeamMembershipRepository', () => {
  it('accepts a nullable optional team role without writing a null trim value', async () => {
    const create = jest.fn().mockResolvedValue({ id: 'membership-id' });
    const repository = new TeamMembershipRepository({
      execute: async (work: (transaction: never) => Promise<unknown>) =>
        work({ teamMember: { create } } as never),
    } as never);

    await RequestContext.run(
      { requestId: 'request-id', tenantId: 'tenant-id' },
      () => repository.addMember('team-id', 'member-id', null),
    );

    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.not.objectContaining({ teamRole: expect.anything() }),
      }),
    );
  });
});
