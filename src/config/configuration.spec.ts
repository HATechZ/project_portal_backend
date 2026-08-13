import { normalizeApiPrefix } from './configuration';

describe('normalizeApiPrefix', () => {
  it.each([
    [undefined, 'api'],
    ['api', 'api'],
    ['/api/', 'api'],
    ['api/v1', 'api'],
    ['/api/v1/', 'api'],
  ])('normalizes %p to %p', (value, expected) => {
    expect(normalizeApiPrefix(value)).toBe(expected);
  });
});
