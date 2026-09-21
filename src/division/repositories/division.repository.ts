import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { RequestContext } from '../../common/context/request-context';
import { PaginationArgs } from '../../common/pagination/paginate';
import { BaseRepository } from '../../infra/prisma/base.repository';
import { UnitOfWorkService } from '../../infra/prisma/unit-of-work.service';
import {
  DivisionDeleteBlocker,
  DivisionMutationInput,
  DivisionRecord,
  DivisionTypeRecord,
  ScopedCompanyRecord,
  divisionSelect,
  divisionTypeSelect,
} from './division.records';

@Injectable()
export class DivisionRepository extends BaseRepository {
  constructor(unitOfWork: UnitOfWorkService) {
    super(unitOfWork);
  }

  findScopedCompany(): Promise<ScopedCompanyRecord | null> {
    const tenantId = RequestContext.requireTenantId();
    return this.transaction((db) =>
      db.company.findUnique({ where: { tenantId }, select: { id: true } }),
    );
  }

  findAll(
    companyId: string,
    { skip, take }: PaginationArgs,
  ): Promise<DivisionRecord[]> {
    const tenantId = RequestContext.requireTenantId();
    return this.transaction((db) =>
      db.division.findMany({
        where: { tenantId, companyId },
        orderBy: [{ name: 'asc' }, { id: 'asc' }],
        skip,
        take,
        select: divisionSelect,
      }),
    );
  }

  count(companyId: string): Promise<number> {
    const tenantId = RequestContext.requireTenantId();
    return this.transaction((db) =>
      db.division.count({ where: { tenantId, companyId } }),
    );
  }

  findById(id: string, companyId: string): Promise<DivisionRecord | null> {
    const tenantId = RequestContext.requireTenantId();
    return this.transaction((db) =>
      db.division.findUnique({
        where: { id_tenantId_companyId: { id, tenantId, companyId } },
        select: divisionSelect,
      }),
    );
  }

  async duplicateName(
    name: string,
    companyId: string,
    exceptId?: string,
  ): Promise<boolean> {
    const tenantId = RequestContext.requireTenantId();
    return this.transaction(
      async (db) =>
        !!(await db.division.findFirst({
          where: {
            tenantId,
            companyId,
            name: { equals: name.trim(), mode: 'insensitive' },
            ...(exceptId === undefined ? {} : { NOT: { id: exceptId } }),
          },
          select: { id: true },
        })),
    );
  }

  create(
    companyId: string,
    input: Required<Pick<DivisionMutationInput, 'name' | 'abbr'>> &
      Pick<DivisionMutationInput, 'divisionTypeId'>,
  ): Promise<DivisionRecord> {
    const tenantId = RequestContext.requireTenantId();
    return this.transaction((db) =>
      db.division.create({
        data: {
          tenantId,
          id: randomUUID(),
          companyId,
          name: input.name.trim(),
          abbr: input.abbr.trim(),
          ...(input.divisionTypeId !== undefined
            ? { divisionTypeId: input.divisionTypeId }
            : {}),
        },
        select: divisionSelect,
      }),
    );
  }

  update(
    id: string,
    companyId: string,
    input: DivisionMutationInput,
  ): Promise<DivisionRecord> {
    const tenantId = RequestContext.requireTenantId();
    return this.transaction((db) =>
      db.division.update({
        where: { id_tenantId_companyId: { id, tenantId, companyId } },
        data: {
          ...(input.name !== undefined ? { name: input.name.trim() } : {}),
          ...(input.abbr !== undefined ? { abbr: input.abbr.trim() } : {}),
          ...(input.divisionTypeId !== undefined
            ? { divisionTypeId: input.divisionTypeId }
            : {}),
          updatedAt: new Date(),
        },
        select: divisionSelect,
      }),
    );
  }

  delete(id: string, companyId: string): Promise<void> {
    const tenantId = RequestContext.requireTenantId();
    return this.transaction(async (db) => {
      await db.division.delete({
        where: { id_tenantId_companyId: { id, tenantId, companyId } },
      });
    });
  }

  findDivisionType(id: string): Promise<DivisionTypeRecord | null> {
    return this.transaction((db) =>
      db.divisionType.findUnique({ where: { id }, select: divisionTypeSelect }),
    );
  }

  async findDeleteBlockers(
    id: string,
    companyId: string,
  ): Promise<DivisionDeleteBlocker[]> {
    const tenantId = RequestContext.requireTenantId();
    return this.transaction(async (db) => {
      const where = { id, tenantId, companyId };
      const [
        membersByDivisionId,
        teamsByDivisionId,
        projectsByOriginDivisionId,
        workRequestsByAssignedDivisionId,
        workRequestsByOriginDivisionId,
        divisionLeadsByDivisionId,
      ] = await Promise.all([
        db.division.findFirst({
          where: { ...where, membersByDivisionId: { some: {} } },
          select: { id: true },
        }),
        db.division.findFirst({
          where: { ...where, teamsByDivisionId: { some: {} } },
          select: { id: true },
        }),
        db.division.findFirst({
          where: { ...where, projectsByOriginDivisionId: { some: {} } },
          select: { id: true },
        }),
        db.division.findFirst({
          where: { ...where, workRequestsByAssignedDivisionId: { some: {} } },
          select: { id: true },
        }),
        db.division.findFirst({
          where: { ...where, workRequestsByOriginDivisionId: { some: {} } },
          select: { id: true },
        }),
        db.division.findFirst({
          where: { ...where, divisionLeadsByDivisionId: { some: {} } },
          select: { id: true },
        }),
      ]);

      return [
        membersByDivisionId ? 'membersByDivisionId' : null,
        teamsByDivisionId ? 'teamsByDivisionId' : null,
        projectsByOriginDivisionId ? 'projectsByOriginDivisionId' : null,
        workRequestsByAssignedDivisionId
          ? 'workRequestsByAssignedDivisionId'
          : null,
        workRequestsByOriginDivisionId
          ? 'workRequestsByOriginDivisionId'
          : null,
        divisionLeadsByDivisionId ? 'divisionLeadsByDivisionId' : null,
      ].filter((blocker): blocker is DivisionDeleteBlocker => blocker !== null);
    });
  }
}
