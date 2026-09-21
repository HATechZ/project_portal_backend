import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { RequestContext } from '../../common/context/request-context';
import { OptionTypeCode, Prisma } from '../../generated/prisma/client';
import { BaseRepository } from '../../infra/prisma/base.repository';
import { PrismaExecutor } from '../../infra/prisma/prisma-executor.type';
import { UnitOfWorkService } from '../../infra/prisma/unit-of-work.service';

export const optionValueSelect = {
  id: true,
  name: true,
  code: true,
  sortOrder: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.OptionValueSelect;
export type OptionValueRecord = Prisma.OptionValueGetPayload<{
  select: typeof optionValueSelect;
}>;

@Injectable()
export class PodCodeRepository extends BaseRepository {
  constructor(uow: UnitOfWorkService) {
    super(uow);
  }

  private readonly optionType = OptionTypeCode.POD;

  private typeId(db: PrismaExecutor) {
    return db.optionType
      .findUniqueOrThrow({
        where: { code: this.optionType },
        select: { id: true },
      })
      .then((row) => row.id);
  }
  async list(includeInactive: boolean): Promise<OptionValueRecord[]> {
    const tenantId = RequestContext.requireTenantId();
    return this.transaction(async (db) => {
      const optionTypeId = await this.typeId(db);
      return db.optionValue.findMany({
        where: {
          tenantId,
          optionTypeId,
          ...(includeInactive ? {} : { isActive: true }),
        },
        orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }, { id: 'asc' }],
        select: optionValueSelect,
      });
    });
  }
  async listDeactivated(): Promise<OptionValueRecord[]> {
    const tenantId = RequestContext.requireTenantId();
    return this.transaction(async (db) => {
      const optionTypeId = await this.typeId(db);
      return db.optionValue.findMany({
        where: { tenantId, optionTypeId, isActive: false },
        orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }, { id: 'asc' }],
        select: optionValueSelect,
      });
    });
  }
  async find(id: string): Promise<OptionValueRecord | null> {
    const tenantId = RequestContext.requireTenantId();
    return this.transaction(async (db) => {
      const optionTypeId = await this.typeId(db);
      return db.optionValue.findFirst({
        where: { id, tenantId, optionTypeId },
        select: optionValueSelect,
      });
    });
  }
  async duplicate(
    name: string,
    code?: string,
    exceptId?: string,
  ): Promise<boolean> {
    const tenantId = RequestContext.requireTenantId();
    return this.transaction(async (db) => {
      const optionTypeId = await this.typeId(db);
      const base = {
        tenantId,
        optionTypeId,
        ...(exceptId ? { NOT: { id: exceptId } } : {}),
      };
      const byName = await db.optionValue.findFirst({
        where: { ...base, name: { equals: name.trim(), mode: 'insensitive' } },
        select: { id: true },
      });
      if (byName) return true;
      if (code === undefined) return false;
      return !!(await db.optionValue.findFirst({
        where: { ...base, code: { equals: code.trim(), mode: 'insensitive' } },
        select: { id: true },
      }));
    });
  }
  async create(input: {
    name: string;
    code?: string;
  }): Promise<OptionValueRecord> {
    const tenantId = RequestContext.requireTenantId();
    return this.transaction(async (db) => {
      const optionTypeId = await this.typeId(db);
      return db.optionValue.create({
        data: {
          id: randomUUID(),
          tenantId,
          optionTypeId,
          name: input.name.trim(),
          ...(input.code === undefined
            ? { code: null }
            : { code: input.code.trim().toUpperCase() }),
        },
        select: optionValueSelect,
      });
    });
  }
  async update(
    id: string,
    input: { name?: string; code?: string },
  ): Promise<OptionValueRecord> {
    const tenantId = RequestContext.requireTenantId();
    return this.transaction(async (db) => {
      const optionTypeId = await this.typeId(db);
      const row = await db.optionValue.findFirst({
        where: { id, tenantId, optionTypeId },
        select: { id: true },
      });
      if (!row) throw new Error('option value disappeared');
      return db.optionValue.update({
        where: { id },
        data: {
          ...(input.name === undefined ? {} : { name: input.name.trim() }),
          ...(input.code === undefined
            ? {}
            : { code: input.code.trim().toUpperCase() }),
        },
        select: optionValueSelect,
      });
    });
  }
  async setActive(id: string, isActive: boolean): Promise<OptionValueRecord> {
    const tenantId = RequestContext.requireTenantId();
    return this.transaction(async (db) => {
      const optionTypeId = await this.typeId(db);
      const row = await db.optionValue.findFirst({
        where: { id, tenantId, optionTypeId },
        select: { id: true },
      });
      if (!row) throw new Error('option value disappeared');
      return db.optionValue.update({
        where: { id },
        data: { isActive },
        select: optionValueSelect,
      });
    });
  }
  async isReferenced(id: string): Promise<boolean> {
    const tenantId = RequestContext.requireTenantId();
    return this.transaction(
      async (db) =>
        (await db.bidDetail.count({
          where: {
            tenantId,
            OR: [
              { polOptionId: id },
              { podOptionId: id },
              { cargoCodeOptionId: id },
              { vesselCodeOptionId: id },
            ],
          },
        })) > 0,
    );
  }
}
