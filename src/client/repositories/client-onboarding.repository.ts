import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { RequestContext } from '../../common/context/request-context';
import { Prisma } from '../../generated/prisma/client';
import { BaseRepository } from '../../infra/prisma/base.repository';
import { UnitOfWorkService } from '../../infra/prisma/unit-of-work.service';
import { ClientContactInput } from './client-contact.repository';
import {
  ClientContactRecord,
  ClientRecord,
  clientContactSelect,
  clientSelect,
} from './client.records';
import { establishPortalAccess, normalizeEmail } from './client-portal-access';

export interface ClientOnboardingInput {
  name: string;
  primaryContact: ClientContactInput;
  enablePortalAccess: boolean;
  assignedByUserId: string;
}

export interface ClientOnboardingRecord {
  client: ClientRecord;
  contact: ClientContactRecord;
  setupRequired: boolean;
}

@Injectable()
export class ClientOnboardingRepository extends BaseRepository {
  constructor(unitOfWork: UnitOfWorkService) {
    super(unitOfWork);
  }

  create(
    companyId: string,
    input: ClientOnboardingInput,
  ): Promise<ClientOnboardingRecord> {
    const tenantId = RequestContext.requireTenantId();
    return this.transaction(
      async (db) => {
        const client = await db.client.create({
          data: {
            id: randomUUID(),
            tenantId,
            companyId,
            name: input.name.trim(),
            isActive: true,
          },
          select: clientSelect,
        });
        const contact = await db.clientContact.create({
          data: {
            id: randomUUID(),
            tenantId,
            clientId: client.id,
            name: input.primaryContact.name.trim(),
            email: normalizeEmail(input.primaryContact.email),
            designation: optional(input.primaryContact.designation),
            phone: optional(input.primaryContact.phone),
            isActive: true,
            isPrimary: true,
          },
          select: clientContactSelect,
        });
        if (!input.enablePortalAccess)
          return { client, contact, setupRequired: false };
        const portal = await establishPortalAccess(
          db,
          client,
          contact,
          input.assignedByUserId,
        );
        return {
          client,
          contact: portal.clientContact as ClientContactRecord,
          setupRequired: portal.setupRequired,
        };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }
}

function optional(value: string | undefined): string | null {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}
