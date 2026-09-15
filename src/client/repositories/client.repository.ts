import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { RequestContext } from '../../common/context/request-context';
import { PaginationArgs } from '../../common/pagination/paginate';
import { BaseRepository } from '../../infra/prisma/base.repository';
import { UnitOfWorkService } from '../../infra/prisma/unit-of-work.service';
import {
  ClientRecord,
  clientSelect,
  ScopedCompanyRecord,
} from './client.records';

@Injectable()
export class ClientRepository extends BaseRepository {
  constructor(unitOfWork: UnitOfWorkService) {
    super(unitOfWork);
  }

  findScopedCompany(): Promise<ScopedCompanyRecord | null> {
    const tenantId = RequestContext.requireTenantId();
    return this.transaction((db) =>
      db.company.findUnique({ where: { tenantId }, select: { id: true } }),
    );
  }

  findAll(companyId: string, args: PaginationArgs): Promise<ClientRecord[]> {
    const tenantId = RequestContext.requireTenantId();
    return this.transaction((db) =>
      db.client.findMany({
        where: { tenantId, companyId },
        orderBy: [{ name: 'asc' }, { id: 'asc' }],
        skip: args.skip,
        take: args.take,
        select: clientSelect,
      }),
    );
  }

  count(companyId: string): Promise<number> {
    const tenantId = RequestContext.requireTenantId();
    return this.transaction((db) =>
      db.client.count({ where: { tenantId, companyId } }),
    );
  }

  findById(id: string, companyId: string): Promise<ClientRecord | null> {
    const tenantId = RequestContext.requireTenantId();
    return this.transaction((db) =>
      db.client.findFirst({
        where: { id, tenantId, companyId },
        select: clientSelect,
      }),
    );
  }

  update(id: string, companyId: string, name: string): Promise<ClientRecord> {
    RequestContext.requireTenantId();
    return this.transaction((db) =>
      db.client.update({
        where: { id },
        data: { name: name.trim(), updatedAt: new Date() },
        select: clientSelect,
      }),
    ).then((client) => {
      void companyId;
      return client;
    });
  }

  setActive(
    id: string,
    companyId: string,
    isActive: boolean,
  ): Promise<ClientRecord> {
    RequestContext.requireTenantId();
    return this.transaction((db) =>
      db.client.update({
        where: { id },
        data: { isActive, updatedAt: new Date() },
        select: clientSelect,
      }),
    ).then((client) => {
      void companyId;
      return client;
    });
  }

  create(companyId: string, name: string): Promise<ClientRecord> {
    const tenantId = RequestContext.requireTenantId();
    return this.transaction((db) =>
      db.client.create({
        data: {
          id: randomUUID(),
          tenantId,
          companyId,
          name: name.trim(),
          isActive: true,
        },
        select: clientSelect,
      }),
    );
  }
}
