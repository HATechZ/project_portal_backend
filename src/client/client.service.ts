import { Inject, Injectable } from '@nestjs/common';
import { PaginationQueryDto } from '../common/pagination/dtos/pagination-query.dto';
import { paginate } from '../common/pagination/paginate';
import { PaginatedResult } from '../common/pagination/paginated-result';
import { PASSWORD_SETUP_INITIATOR } from '../common/security/password-setup.port';
import type { PasswordSetupInitiator } from '../common/security/password-setup.port';
import { ClientResponseDto, CreateClientDto, UpdateClientDto } from './dtos';
import {
  ClientScopeProvider,
  clientBadRequest,
  toClientResponse,
} from './providers';
import { ClientOnboardingRepository, ClientRepository } from './repositories';

@Injectable()
export class ClientService {
  constructor(
    private readonly clients: ClientRepository,
    private readonly onboarding: ClientOnboardingRepository,
    private readonly scope: ClientScopeProvider,
    @Inject(PASSWORD_SETUP_INITIATOR)
    private readonly passwordSetup: PasswordSetupInitiator,
  ) {}

  async create(
    input: CreateClientDto,
    assignedByUserId: string,
  ): Promise<ClientResponseDto> {
    const company = await this.scope.requireCompany();
    const result = await this.onboarding.create(company.id, {
      ...input,
      assignedByUserId,
    });
    if (result.setupRequired)
      await this.passwordSetup.initiate(result.contact.email);
    return toClientResponse(result.client);
  }

  async findAll(
    query: PaginationQueryDto,
  ): Promise<PaginatedResult<ClientResponseDto>> {
    const company = await this.scope.requireCompany();
    return paginate(
      query,
      async (args) =>
        (await this.clients.findAll(company.id, args)).map(toClientResponse),
      () => this.clients.count(company.id),
    );
  }

  async findDeactivated(
    query: PaginationQueryDto,
  ): Promise<PaginatedResult<ClientResponseDto>> {
    const company = await this.scope.requireCompany();
    return paginate(
      query,
      async (args) =>
        (await this.clients.findDeactivated(company.id, args)).map(
          toClientResponse,
        ),
      () => this.clients.countDeactivated(company.id),
    );
  }

  async findOne(id: string): Promise<ClientResponseDto> {
    const company = await this.scope.requireCompany();
    return toClientResponse(await this.scope.requireClient(id, company.id));
  }

  async update(id: string, input: UpdateClientDto): Promise<ClientResponseDto> {
    if (input.name === undefined)
      throw clientBadRequest('Supply a Client name');
    const company = await this.scope.requireCompany();
    await this.scope.requireClient(id, company.id);
    return toClientResponse(
      await this.clients.update(id, company.id, input.name),
    );
  }

  async deactivate(id: string): Promise<ClientResponseDto> {
    const company = await this.scope.requireCompany();
    await this.scope.requireClient(id, company.id);
    return toClientResponse(
      await this.clients.setActive(id, company.id, false),
    );
  }

  async reactivate(id: string): Promise<ClientResponseDto> {
    const company = await this.scope.requireCompany();
    await this.scope.requireClient(id, company.id);
    return toClientResponse(await this.clients.setActive(id, company.id, true));
  }
}
