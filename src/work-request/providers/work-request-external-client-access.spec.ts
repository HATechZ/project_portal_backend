import { assertWorkRequestExternalClientAccess } from './work-request-external-client-access';

const parent = { clientId: 'client-a' };

function actor(
  scope: 'client' | 'client_contact' | 'company',
  clientId = 'client-a',
) {
  return {
    role: { customScope: scope },
    clientContact: {
      clientId,
      isActive: true,
      client: { isActive: true },
    },
  } as never;
}

describe('Work Request external client exposure', () => {
  it.each(['client', 'client_contact'] as const)(
    'allows an active linked %s scope for its Client resource',
    (scope) => {
      expect(() =>
        assertWorkRequestExternalClientAccess(actor(scope), parent),
      ).not.toThrow();
    },
  );

  it('denies a different Client even with a compatible external scope', () => {
    expect(() =>
      assertWorkRequestExternalClientAccess(
        actor('client_contact', 'client-b'),
        parent,
      ),
    ).toThrow('Client portal access is not available for this resource.');
  });

  it('does not impose an external exposure rule on internal compatible scopes', () => {
    expect(() =>
      assertWorkRequestExternalClientAccess(
        actor('company', 'client-b'),
        parent,
      ),
    ).not.toThrow();
  });
});
