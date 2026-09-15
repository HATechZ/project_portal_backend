import {
  ClientContactResponseDto,
  ClientPortalAccessResponseDto,
  ClientResponseDto,
} from '../dtos';
import {
  ClientContactRecord,
  ClientRecord,
  PortalAccessRecord,
} from '../repositories';

export function toClientResponse(record: ClientRecord): ClientResponseDto {
  return record;
}

export function toClientContactResponse(
  record: ClientContactRecord,
): ClientContactResponseDto {
  return record;
}

export function toPortalAccessResponse(
  record: PortalAccessRecord,
): ClientPortalAccessResponseDto {
  return {
    client: record.client,
    clientContact: record.clientContact,
    portalAccess: { role: 'client_owner', scope: 'client', active: true },
  };
}
