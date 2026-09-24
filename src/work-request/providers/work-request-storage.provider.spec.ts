import { WorkRequestStorageProvider } from './work-request-storage.provider';

describe('WorkRequestStorageProvider', () => {
  it('removes every successfully written key when the transaction later fails', async () => {
    const storage = { put: jest.fn(), remove: jest.fn() };
    const provider = new WorkRequestStorageProvider();
    const keys = await provider.putAll(storage, [
      {
        storageKey: 'tenants/t/work-requests/r/documents/a.pdf',
        content: Buffer.from('x'),
      },
    ]);
    await provider.compensate(storage, keys);
    expect(storage.remove).toHaveBeenCalledWith(keys[0]);
  });
  it('does not allow failed removal to hide the original database failure path', async () => {
    const storage = {
      put: jest.fn(),
      remove: jest.fn().mockRejectedValue(new Error('locked')),
    };
    await expect(
      new WorkRequestStorageProvider().compensate(storage, ['orphan']),
    ).resolves.toBeUndefined();
  });
});
