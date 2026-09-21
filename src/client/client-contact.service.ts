import { Inject, Injectable } from '@nestjs/common';
import { PaginationQueryDto } from '../common/pagination/dtos/pagination-query.dto';
import { paginate } from '../common/pagination/paginate';
import { PaginatedResult } from '../common/pagination/paginated-result';
import { PASSWORD_SETUP_INITIATOR } from '../common/security/password-setup.port';
import type { PasswordSetupInitiator } from '../common/security/password-setup.port';
import {
  ClientContactResponseDto,
  ClientPortalAccessResponseDto,
  CreateClientContactDto,
  UpdateClientContactDto,
} from './dtos';
import {
  ClientScopeProvider,
  clientBadRequest,
  clientConflict,
  clientNotFound,
  toClientContactResponse,
  toPortalAccessResponse,
} from './providers';
import {
  ClientAccessRepository,
  ClientContactRepository,
} from './repositories';

@Injectable()
export class ClientContactService {
  constructor(
    private readonly contacts: ClientContactRepository,
    private readonly access: ClientAccessRepository,
    private readonly scope: ClientScopeProvider,
    @Inject(PASSWORD_SETUP_INITIATOR)
    private readonly passwordSetup: PasswordSetupInitiator,
  ) {}

  async addContact(
    clientId: string,
    input: CreateClientContactDto,
  ): Promise<ClientContactResponseDto> {
    const company = await this.scope.requireCompany();
    const client = await this.scope.requireClient(clientId, company.id);
    if (!client.isActive) throw clientConflict('Client is inactive');
    return toClientContactResponse(await this.contacts.create(clientId, input));
  }

  async findContacts(
    clientId: string,
    query: PaginationQueryDto,
  ): Promise<PaginatedResult<ClientContactResponseDto>> {
    await this.requireClient(clientId);
    return paginate(
      query,
      async (args) =>
        (await this.contacts.findAll(clientId, args)).map(
          toClientContactResponse,
        ),
      () => this.contacts.count(clientId),
    );
  }

  async findDeactivatedContacts(
    clientId: string,
    query: PaginationQueryDto,
  ): Promise<PaginatedResult<ClientContactResponseDto>> {
    await this.requireClient(clientId);
    return paginate(
      query,
      async (args) =>
        (await this.contacts.findDeactivated(clientId, args)).map(
          toClientContactResponse,
        ),
      () => this.contacts.countDeactivated(clientId),
    );
  }

  async findContact(
    clientId: string,
    contactId: string,
  ): Promise<ClientContactResponseDto> {
    await this.requireClient(clientId);
    return toClientContactResponse(
      await this.scope.requireContact(contactId, clientId),
    );
  }

  async updateContact(
    clientId: string,
    contactId: string,
    input: UpdateClientContactDto,
  ): Promise<ClientContactResponseDto> {
    if (Object.values(input).every((value) => value === undefined)) {
      throw clientBadRequest('Supply a Client contact field');
    }
    await this.requireContact(clientId, contactId);
    return toClientContactResponse(
      await this.contacts.update(contactId, clientId, input),
    );
  }

  async deactivateContact(
    clientId: string,
    contactId: string,
  ): Promise<ClientContactResponseDto> {
    await this.requireContact(clientId, contactId);
    return toClientContactResponse(
      await this.contacts.deactivate(contactId, clientId),
    );
  }

  async reactivateContact(
    clientId: string,
    contactId: string,
  ): Promise<ClientContactResponseDto> {
    await this.requireContact(clientId, contactId);
    return toClientContactResponse(
      await this.contacts.reactivate(contactId, clientId),
    );
  }

  async setPrimary(
    clientId: string,
    contactId: string,
  ): Promise<ClientContactResponseDto> {
    await this.requireClient(clientId);
    const contact = await this.contacts.setPrimary(contactId, clientId);
    if (!contact) throw clientNotFound('Active Client contact was not found');
    return toClientContactResponse(contact);
  }

  async grantPortalAccess(
    clientId: string,
    contactId: string,
    assignedByUserId: string,
  ): Promise<ClientPortalAccessResponseDto> {
    const company = await this.scope.requireCompany();
    const result = await this.access.grant(
      clientId,
      contactId,
      company.id,
      assignedByUserId,
    );
    if (result.setupRequired)
      await this.passwordSetup.initiate(result.clientContact.email);
    return toPortalAccessResponse(result);
  }

  async revokePortalAccess(clientId: string, contactId: string): Promise<void> {
    const company = await this.scope.requireCompany();
    await this.access.revoke(clientId, contactId, company.id);
  }

  private async requireClient(clientId: string): Promise<void> {
    const company = await this.scope.requireCompany();
    await this.scope.requireClient(clientId, company.id);
  }

  private async requireContact(
    clientId: string,
    contactId: string,
  ): Promise<void> {
    await this.requireClient(clientId);
    await this.scope.requireContact(contactId, clientId);
  }
}
