import { BidBusinessTransactionProvider } from './bid-business-transaction.provider';

describe('BidBusinessTransactionProvider', () => {
  it('retries one serializable P2034 failure', async () => {
    const execute = jest.fn().mockRejectedValueOnce(Object.assign(new Error('retry'), { code: 'P2034' })).mockImplementation(async (work) => work());
    const provider = new BidBusinessTransactionProvider({ execute } as never);
    await expect(provider.execute(async () => 'ok')).resolves.toBe('ok');
    expect(execute).toHaveBeenCalledTimes(2);
  });

  it('does not retry ordinary failures', async () => {
    const execute = jest.fn().mockRejectedValue(new Error('conflict'));
    const provider = new BidBusinessTransactionProvider({ execute } as never);
    await expect(provider.execute(async () => 'no')).rejects.toThrow('conflict');
    expect(execute).toHaveBeenCalledTimes(1);
  });
});
