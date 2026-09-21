import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { RequestContext } from '../../common/context/request-context';
import { PaginationArgs } from '../../common/pagination/paginate';
import { Prisma } from '../../generated/prisma/client';
import { BaseRepository } from '../../infra/prisma/base.repository';
import { UnitOfWorkService } from '../../infra/prisma/unit-of-work.service';
import { ClientContactRecord, clientContactSelect } from './client.records';

export interface ClientContactInput {
  name: string;
  email: string;
  designation?: string;
  phone?: string;
}

@Injectable()
export class ClientContactRepository extends BaseRepository {
  constructor(unitOfWork: UnitOfWorkService) {
    super(unitOfWork);
  }

  findAll(
    clientId: string,
    args: PaginationArgs,
  ): Promise<ClientContactRecord[]> {
    const tenantId = RequestContext.requireTenantId();
    return this.transaction((db) =>
      db.clientContact.findMany({
        where: { tenantId, clientId },
        orderBy: [{ name: 'asc' }, { id: 'asc' }],
        skip: args.skip,
        take: args.take,
        select: clientContactSelect,
      }),
    );
  }

  findDeactivated(
    clientId: string,
    args: PaginationArgs,
  ): Promise<ClientContactRecord[]> {
    const tenantId = RequestContext.requireTenantId();
    return this.transaction((db) =>
      db.clientContact.findMany({
        where: { tenantId, clientId, isActive: false },
        orderBy: [{ name: 'asc' }, { id: 'asc' }],
        skip: args.skip,
        take: args.take,
        select: clientContactSelect,
      }),
    );
  }

  count(clientId: string): Promise<number> {
    const tenantId = RequestContext.requireTenantId();
    return this.transaction((db) =>
      db.clientContact.count({ where: { tenantId, clientId } }),
    );
  }

  countDeactivated(clientId: string): Promise<number> {
    const tenantId = RequestContext.requireTenantId();
    return this.transaction((db) =>
      db.clientContact.count({
        where: { tenantId, clientId, isActive: false },
      }),
    );
  }

  findById(id: string, clientId: string): Promise<ClientContactRecord | null> {
    const tenantId = RequestContext.requireTenantId();
    return this.transaction((db) =>
      db.clientContact.findFirst({
        where: { id, tenantId, clientId },
        select: clientContactSelect,
      }),
    );
  }

  create(
    clientId: string,
    input: ClientContactInput,
  ): Promise<ClientContactRecord> {
    const tenantId = RequestContext.requireTenantId();
    return this.transaction((db) =>
      db.clientContact.create({
        data: {
          id: randomUUID(),
          tenantId,
          clientId,
          name: input.name.trim(),
          email: input.email.trim().toLowerCase(),
          designation: optional(input.designation),
          phone: optional(input.phone),
          isActive: true,
          isPrimary: false,
        },
        select: clientContactSelect,
      }),
    );
  }

  update(
    id: string,
    clientId: string,
    input: Partial<ClientContactInput>,
  ): Promise<ClientContactRecord> {
    const tenantId = RequestContext.requireTenantId();
    return this.transaction((db) =>
      db.clientContact.update({
        where: { id_tenantId: { id, tenantId } },
        data: {
          ...(input.name !== undefined ? { name: input.name.trim() } : {}),
          ...(input.email !== undefined
            ? { email: input.email.trim().toLowerCase() }
            : {}),
          ...(input.designation !== undefined
            ? { designation: optional(input.designation) }
            : {}),
          ...(input.phone !== undefined
            ? { phone: optional(input.phone) }
            : {}),
          updatedAt: new Date(),
        },
        select: clientContactSelect,
      }),
    ).then((contact) => {
      void clientId;
      return contact;
    });
  }

  deactivate(id: string, clientId: string): Promise<ClientContactRecord> {
    const tenantId = RequestContext.requireTenantId();
    return this.transaction((db) =>
      db.clientContact.update({
        where: { id_tenantId: { id, tenantId } },
        data: { isActive: false, isPrimary: false, updatedAt: new Date() },
        select: clientContactSelect,
      }),
    ).then((contact) => {
      void clientId;
      return contact;
    });
  }

  reactivate(id: string, clientId: string): Promise<ClientContactRecord> {
    const tenantId = RequestContext.requireTenantId();
    return this.transaction((db) =>
      db.clientContact.update({
        where: { id_tenantId: { id, tenantId } },
        data: { isActive: true, updatedAt: new Date() },
        select: clientContactSelect,
      }),
    ).then((contact) => {
      void clientId;
      return contact;
    });
  }

  setPrimary(
    id: string,
    clientId: string,
  ): Promise<ClientContactRecord | null> {
    const tenantId = RequestContext.requireTenantId();
    return this.transaction(
      async (db) => {
        const selected = await db.clientContact.findFirst({
          where: { id, tenantId, clientId, isActive: true },
          select: { id: true },
        });
        if (!selected) return null;
        await db.clientContact.updateMany({
          where: { tenantId, clientId, isPrimary: true },
          data: { isPrimary: false, updatedAt: new Date() },
        });
        return db.clientContact.update({
          where: { id_tenantId: { id, tenantId } },
          data: { isPrimary: true, updatedAt: new Date() },
          select: clientContactSelect,
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }
}

function optional(value: string | undefined): string | null {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}
