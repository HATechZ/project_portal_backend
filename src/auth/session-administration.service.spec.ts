import { SessionAdministrationService } from './session-administration.service';
import { SessionAdministrationRepository } from './repositories/session-administration.repository';

describe('SessionAdministrationService', () => {
  const repository = { revokeForUser: jest.fn() };
  const service = new SessionAdministrationService(
    repository as unknown as SessionAdministrationRepository,
  );
  it('revokes a visible target idempotently', async () => {
    repository.revokeForUser.mockResolvedValue(true);
    await expect(service.revokeForUser('target')).resolves.toBeUndefined();
    expect(repository.revokeForUser).toHaveBeenCalledWith('target');
  });
  it('does not disclose missing or cross-Tenant targets', async () => {
    repository.revokeForUser.mockResolvedValue(false);
    await expect(service.revokeForUser('foreign')).rejects.toMatchObject({
      status: 404,
    });
  });
});
