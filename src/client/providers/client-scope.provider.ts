import { HttpStatus, Injectable } from '@nestjs/common';
import { AppErrorCode } from '../../common/exceptions/app-error-code';
import { AppException } from '../../common/exceptions/app-exception';
import {
  ClientContactRecord,
  ClientContactRepository,
  ClientRecord,
  ClientRepository,
  ScopedCompanyRecord,
} from '../repositories';

@Injectable()
export class ClientScopeProvider {
  constructor(
    private readonly clients: ClientRepository,
    private readonly contacts: ClientContactRepository,
  ) {}

  async requireCompany(): Promise<ScopedCompanyRecord> {
    const company = await this.clients.findScopedCompany();
    if (!company)
      throw clientNotFound(
        'Company not found. It may have been removed or you may not have access to it.',
      );
    return company;
  }

  async requireClient(id: string, companyId: string): Promise<ClientRecord> {
    const client = await this.clients.findById(id, companyId);
    if (!client)
      throw clientNotFound(
        'Client not found. It may have been removed or you may not have access to it.',
      );
    return client;
  }

  async requireContact(
    id: string,
    clientId: string,
  ): Promise<ClientContactRecord> {
    const contact = await this.contacts.findById(id, clientId);
    if (!contact)
      throw clientNotFound(
        'Client contact not found. Refresh the client details and try again.',
      );
    return contact;
  }
}

export function clientBadRequest(message: string): AppException {
  return new AppException({
    code: AppErrorCode.BadRequest,
    status: HttpStatus.BAD_REQUEST,
    message,
  });
}

export function clientConflict(message: string): AppException {
  return new AppException({
    code: AppErrorCode.Conflict,
    status: HttpStatus.CONFLICT,
    message,
  });
}

export function clientNotFound(message: string): AppException {
  return new AppException({
    code: AppErrorCode.NotFound,
    status: HttpStatus.NOT_FOUND,
    message,
  });
}
