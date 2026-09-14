import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { AppErrorCode } from '../common/exceptions/app-error-code';
import { AppException } from '../common/exceptions/app-exception';
import { PaginationQueryDto } from '../common/pagination/dtos/pagination-query.dto';
import { paginate } from '../common/pagination/paginate';
import { PaginatedResult } from '../common/pagination/paginated-result';
import { PASSWORD_SETUP_INITIATOR } from '../common/security/password-setup.port';
import type { PasswordSetupInitiator } from '../common/security/password-setup.port';
import {
  ClientContactResponseDto,
  ClientPortalAccessResponseDto,
  ClientResponseDto,
  CreateClientContactDto,
  CreateClientDto,
  UpdateClientContactDto,
  UpdateClientDto,
} from './dtos';
import { toClientContactResponse, toClientResponse, toPortalAccessResponse } from './providers';
import {
  ClientAccessRepository,
  ClientContactRepository,
  ClientOnboardingRepository,
  ClientRepository,
  ScopedCompanyRecord,
} from './repositories';

@Injectable()
export class ClientService {
  constructor(
    private readonly clients: ClientRepository,
    private readonly contacts: ClientContactRepository,
    private readonly onboarding: ClientOnboardingRepository,
    private readonly access: ClientAccessRepository,
    @Inject(PASSWORD_SETUP_INITIATOR)
    private readonly passwordSetup: PasswordSetupInitiator,
  ) {}

  async create(input: CreateClientDto, assignedByUserId: string): Promise<ClientResponseDto> {
    const company = await this.requireCompany();
    const result = await this.onboarding.create(company.id, { ...input, assignedByUserId });
    if (result.setupRequired) await this.passwordSetup.initiate(result.contact.email);
    return toClientResponse(result.client);
  }

  async findAll(query: PaginationQueryDto): Promise<PaginatedResult<ClientResponseDto>> {
    const company = await this.requireCompany();
    return paginate(query, async (args) => (await this.clients.findAll(company.id, args)).map(toClientResponse), () => this.clients.count(company.id));
  }

  async findOne(id: string): Promise<ClientResponseDto> {
    const company = await this.requireCompany();
    return toClientResponse(await this.requireClient(id, company.id));
  }

  async update(id: string, input: UpdateClientDto): Promise<ClientResponseDto> {
    if (input.name === undefined) throw this.badRequest('Supply a Client name');
    const company = await this.requireCompany();
    await this.requireClient(id, company.id);
    return toClientResponse(await this.clients.update(id, company.id, input.name));
  }

  async deactivate(id: string): Promise<ClientResponseDto> {
    const company = await this.requireCompany();
    await this.requireClient(id, company.id);
    return toClientResponse(await this.clients.setActive(id, company.id, false));
  }

  async reactivate(id: string): Promise<ClientResponseDto> {
    const company = await this.requireCompany();
    await this.requireClient(id, company.id);
    return toClientResponse(await this.clients.setActive(id, company.id, true));
  }

  async addContact(clientId: string, input: CreateClientContactDto): Promise<ClientContactResponseDto> {
    const company = await this.requireCompany();
    const client = await this.requireClient(clientId, company.id);
    if (!client.isActive) throw this.conflict('Client is inactive');
    return toClientContactResponse(await this.contacts.create(clientId, input));
  }

  async findContacts(clientId: string, query: PaginationQueryDto): Promise<PaginatedResult<ClientContactResponseDto>> {
    const company = await this.requireCompany();
    await this.requireClient(clientId, company.id);
    return paginate(query, async (args) => (await this.contacts.findAll(clientId, args)).map(toClientContactResponse), () => this.contacts.count(clientId));
  }

  async findContact(clientId: string, contactId: string): Promise<ClientContactResponseDto> {
    const company = await this.requireCompany();
    await this.requireClient(clientId, company.id);
    return toClientContactResponse(await this.requireContact(contactId, clientId));
  }

  async updateContact(clientId: string, contactId: string, input: UpdateClientContactDto): Promise<ClientContactResponseDto> {
    if (Object.values(input).every((value) => value === undefined)) {
      throw this.badRequest('Supply a Client contact field');
    }
    const company = await this.requireCompany();
    await this.requireClient(clientId, company.id);
    await this.requireContact(contactId, clientId);
    return toClientContactResponse(await this.contacts.update(contactId, clientId, input));
  }

  async deactivateContact(clientId: string, contactId: string): Promise<ClientContactResponseDto> {
    const company = await this.requireCompany();
    await this.requireClient(clientId, company.id);
    await this.requireContact(contactId, clientId);
    return toClientContactResponse(await this.contacts.deactivate(contactId, clientId));
  }

  async reactivateContact(clientId: string, contactId: string): Promise<ClientContactResponseDto> {
    const company = await this.requireCompany();
    await this.requireClient(clientId, company.id);
    await this.requireContact(contactId, clientId);
    return toClientContactResponse(await this.contacts.reactivate(contactId, clientId));
  }

  async setPrimary(clientId: string, contactId: string): Promise<ClientContactResponseDto> {
    const company = await this.requireCompany();
    await this.requireClient(clientId, company.id);
    const contact = await this.contacts.setPrimary(contactId, clientId);
    if (!contact) throw this.notFound('Active Client contact was not found');
    return toClientContactResponse(contact);
  }

  async grantPortalAccess(clientId: string, contactId: string, assignedByUserId: string): Promise<ClientPortalAccessResponseDto> {
    const company = await this.requireCompany();
    const result = await this.access.grant(clientId, contactId, company.id, assignedByUserId);
    if (result.setupRequired) await this.passwordSetup.initiate(result.clientContact.email);
    return toPortalAccessResponse(result);
  }

  async revokePortalAccess(clientId: string, contactId: string): Promise<void> {
    const company = await this.requireCompany();
    await this.access.revoke(clientId, contactId, company.id);
  }

  private async requireCompany(): Promise<ScopedCompanyRecord> {
    const company = await this.clients.findScopedCompany();
    if (!company) throw this.notFound('Company was not found for the active Tenant');
    return company;
  }

  private async requireClient(id: string, companyId: string) {
    const client = await this.clients.findById(id, companyId);
    if (!client) throw this.notFound('Client was not found');
    return client;
  }

  private async requireContact(id: string, clientId: string) {
    const contact = await this.contacts.findById(id, clientId);
    if (!contact) throw this.notFound('Client contact was not found');
    return contact;
  }

  private badRequest(message: string): AppException {
    return new AppException({ code: AppErrorCode.BadRequest, status: HttpStatus.BAD_REQUEST, message });
  }

  private conflict(message: string): AppException {
    return new AppException({ code: AppErrorCode.Conflict, status: HttpStatus.CONFLICT, message });
  }

  private notFound(message: string): AppException {
    return new AppException({ code: AppErrorCode.NotFound, status: HttpStatus.NOT_FOUND, message });
  }
}
