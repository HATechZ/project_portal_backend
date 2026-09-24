import { WorkRequestFileProvider } from './work-request-file.provider';

describe('WorkRequestFileProvider', () => {
  const provider = new WorkRequestFileProvider();
  it('accepts a complete positional document-code mapping', () => {
    expect(() =>
      provider.assertMapping([{ originalname: 'a.pdf' } as never], ['code']),
    ).not.toThrow();
  });
  it('rejects unclassified and partial uploads', () => {
    expect(() =>
      provider.assertMapping([{ originalname: 'a.pdf' } as never], []),
    ).toThrow();
    expect(() => provider.assertMapping([], ['code'])).toThrow();
  });
  it('preserves the safe original name separately from generated metadata', () => {
    expect(provider.originalName('../../plan.pdf')).toBe('plan.pdf');
    expect(provider.extension('plan.pdf')).toBe('.pdf');
  });
});
