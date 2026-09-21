import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { RequestContext } from '../../common/context/request-context';
import { PaginationArgs } from '../../common/pagination/paginate';
import { BaseRepository } from '../../infra/prisma/base.repository';
import { UnitOfWorkService } from '../../infra/prisma/unit-of-work.service';
import { DesignationRecord, designationSelect } from './designation.records';

@Injectable()
export class DesignationRepository extends BaseRepository {
  constructor(unitOfWork: UnitOfWorkService) {
    super(unitOfWork);
  }

  async companyId(): Promise<string | null> {
    const tenantId = RequestContext.requireTenantId();
    return this.transaction(
      async (db) =>
        (
          await db.company.findUnique({
            where: { tenantId },
            select: { id: true },
          })
        )?.id ?? null,
    );
  }

  list(
    companyId: string,
    { skip, take }: PaginationArgs,
  ): Promise<DesignationRecord[]> {
    const tenantId = RequestContext.requireTenantId();
    return this.transaction((db) =>
      db.designation.findMany({
        where: { tenantId, companyId },
        orderBy: [{ name: 'asc' }, { id: 'asc' }],
        skip,
        take,
        select: designationSelect,
      }),
    );
  }

  count(companyId: string): Promise<number> {
    const tenantId = RequestContext.requireTenantId();
    return this.transaction((db) =>
      db.designation.count({ where: { tenantId, companyId } }),
    );
  }

  find(id: string, companyId: string): Promise<DesignationRecord | null> {
    const tenantId = RequestContext.requireTenantId();
    return this.transaction((db) =>
      db.designation.findUnique({
        where: { id_tenantId_companyId: { id, tenantId, companyId } },
        select: designationSelect,
      }),
    );
  }

  async duplicate(
    name: string,
    companyId: string,
    exceptId?: string,
  ): Promise<boolean> {
    const tenantId = RequestContext.requireTenantId();
    return this.transaction(
      async (db) =>
        !!(await db.designation.findFirst({
          where: {
            tenantId,
            companyId,
            name: { equals: name.trim(), mode: 'insensitive' },
            ...(exceptId ? { NOT: { id: exceptId } } : {}),
          },
          select: { id: true },
        })),
    );
  }

  create(companyId: string, name: string): Promise<DesignationRecord> {
    const tenantId = RequestContext.requireTenantId();
    return this.transaction((db) =>
      db.designation.create({
        data: { id: randomUUID(), tenantId, companyId, name: name.trim() },
        select: designationSelect,
      }),
    );
  }

  update(
    id: string,
    companyId: string,
    name: string,
  ): Promise<DesignationRecord> {
    const tenantId = RequestContext.requireTenantId();
    return this.transaction((db) =>
      db.designation.update({
        where: { id_tenantId_companyId: { id, tenantId, companyId } },
        data: { name: name.trim() },
        select: designationSelect,
      }),
    );
  }

  async hasMembers(id: string, companyId: string): Promise<boolean> {
    const tenantId = RequestContext.requireTenantId();
    return this.transaction(
      async (db) =>
        !!(await db.member.findFirst({
          where: { tenantId, companyId, designationId: id },
          select: { id: true },
        })),
    );
  }

  delete(id: string, companyId: string): Promise<void> {
    const tenantId = RequestContext.requireTenantId();
    return this.transaction(async (db) => {
      await db.designation.delete({
        where: { id_tenantId_companyId: { id, tenantId, companyId } },
      });
    });
  }
}
