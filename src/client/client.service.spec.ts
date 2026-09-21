import { ClientContactService } from './client-contact.service';
import { ClientService } from './client.service';
import { ClientScopeProvider } from './providers';

const client = {
  id: 'client-id',
  companyId: 'company-id',
  name: 'Client',
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date(),
};
const contact = {
  id: 'contact-id',
  userId: 'user-id',
  clientId: client.id,
  name: 'Contact',
  email: 'contact@example.com',
  designation: null,
  phone: null,
  isPrimary: true,
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe('ClientService onboarding', () => {
  const clients = {
    findScopedCompany: jest.fn(),
    findById: jest.fn(),
    findAll: jest.fn(),
    findDeactivated: jest.fn(),
    count: jest.fn(),
    countDeactivated: jest.fn(),
    update: jest.fn(),
    setActive: jest.fn(),
  };
  const contacts = {
    create: jest.fn(),
    findById: jest.fn(),
    findAll: jest.fn(),
    findDeactivated: jest.fn(),
    count: jest.fn(),
    countDeactivated: jest.fn(),
    update: jest.fn(),
    deactivate: jest.fn(),
    reactivate: jest.fn(),
    setPrimary: jest.fn(),
  };
  const onboarding = { create: jest.fn() };
  const access = { grant: jest.fn(), revoke: jest.fn() };
  const passwordSetup = { initiate: jest.fn() };
  const scope = new ClientScopeProvider(clients as never, contacts as never);
  const service = new ClientService(
    clients as never,
    onboarding as never,
    scope,
    passwordSetup,
  );
  const contactService = new ClientContactService(
    contacts as never,
    access as never,
    scope,
    passwordSetup,
  );

  beforeEach(() => {
    jest.resetAllMocks();
    clients.findScopedCompany.mockResolvedValue({ id: 'company-id' });
  });

  it('creates Client and Primary Contact without password setup when portal access is disabled', async () => {
    onboarding.create.mockResolvedValue({
      client,
      contact: { ...contact, userId: null },
      setupRequired: false,
    });

    await service.create(
      {
        name: 'Client',
        primaryContact: { name: 'Contact', email: 'contact@example.com' },
        enablePortalAccess: false,
      },
      'admin-id',
    );

    expect(onboarding.create).toHaveBeenCalledWith(
      'company-id',
      expect.objectContaining({ assignedByUserId: 'admin-id' }),
    );
    expect(passwordSetup.initiate).not.toHaveBeenCalled();
  });

  it('initiates the approved setup flow without exposing token material when portal access is enabled', async () => {
    onboarding.create.mockResolvedValue({
      client,
      contact,
      setupRequired: true,
    });

    const result = await service.create(
      {
        name: 'Client',
        primaryContact: { name: 'Contact', email: 'contact@example.com' },
        enablePortalAccess: true,
      },
      'admin-id',
    );

    expect(passwordSetup.initiate).toHaveBeenCalledWith('contact@example.com');
    expect(result).toEqual(client);
    expect(result).not.toHaveProperty('password');
  });

  it('uses the same setup port for a portal grant only when credentials still need setup', async () => {
    access.grant.mockResolvedValue({
      client: { id: client.id, name: client.name },
      clientContact: {
        id: contact.id,
        name: contact.name,
        email: contact.email,
        userId: contact.userId,
      },
      setupRequired: true,
    });

    await contactService.grantPortalAccess(client.id, contact.id, 'admin-id');

    expect(passwordSetup.initiate).toHaveBeenCalledWith(contact.email);
  });

  it('rejects a non-active contact when the primary repository cannot select it', async () => {
    clients.findById.mockResolvedValue(client);
    contacts.setPrimary.mockResolvedValue(null);

    await expect(
      contactService.setPrimary(client.id, contact.id),
    ).rejects.toMatchObject({
      message: 'Active Client contact was not found',
    });
  });

  it('lists only deactivated Clients and Contacts with matching totals', async () => {
    clients.findById.mockResolvedValue(client);
    clients.findDeactivated.mockResolvedValue([{ ...client, isActive: false }]);
    clients.countDeactivated.mockResolvedValue(1);
    contacts.findDeactivated.mockResolvedValue([
      { ...contact, isActive: false },
    ]);
    contacts.countDeactivated.mockResolvedValue(1);

    await expect(
      service.findDeactivated({ page: 1, limit: 20 }),
    ).resolves.toMatchObject({
      items: [{ id: client.id, isActive: false }],
      meta: { total: 1 },
    });
    await expect(
      contactService.findDeactivatedContacts(client.id, { page: 1, limit: 20 }),
    ).resolves.toMatchObject({
      items: [{ id: contact.id, isActive: false }],
      meta: { total: 1 },
    });
  });
});
