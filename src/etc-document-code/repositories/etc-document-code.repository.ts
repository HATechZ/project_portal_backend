import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { DocumentGroupCode, Prisma } from '../../generated/prisma/client';
import { RequestContext } from '../../common/context/request-context';
import { BaseRepository } from '../../infra/prisma/base.repository';
import { UnitOfWorkService } from '../../infra/prisma/unit-of-work.service';

export const etcDocumentCodeSelect = {
  id: true,
  code: true,
  name: true,
  description: true,
  sortOrder: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.DocumentCodeOptionSelect;

export type EtcDocumentCodeRecord = Prisma.DocumentCodeOptionGetPayload<{
  select: typeof etcDocumentCodeSelect;
}>;

export type EtcDocumentCodeStatus = 'active' | 'inactive' | 'all';

@Injectable()
export class EtcDocumentCodeRepository extends BaseRepository {
  private readonly group = DocumentGroupCode.ETC;

  constructor(unitOfWork: UnitOfWorkService) {
    super(unitOfWork);
  }

  list(status: EtcDocumentCodeStatus): Promise<EtcDocumentCodeRecord[]> {
    const tenantId = RequestContext.requireTenantId();
    return this.transaction((db) =>
      db.documentCodeOption.findMany({
        where: {
          tenantId,
          documentGroup: this.group,
          ...(status === 'all' ? {} : { isActive: status === 'active' }),
        },
        orderBy: [{ sortOrder: 'asc' }, { code: 'asc' }, { id: 'asc' }],
        select: etcDocumentCodeSelect,
      }),
    );
  }

  find(id: string): Promise<EtcDocumentCodeRecord | null> {
    const tenantId = RequestContext.requireTenantId();
    return this.transaction((db) =>
      db.documentCodeOption.findFirst({
        where: { id, tenantId, documentGroup: this.group },
        select: etcDocumentCodeSelect,
      }),
    );
  }

  async duplicate(code: string, exceptId?: string): Promise<boolean> {
    const tenantId = RequestContext.requireTenantId();
    return this.transaction(
      async (db) =>
        !!(await db.documentCodeOption.findFirst({
          where: {
            tenantId,
            documentGroup: this.group,
            code,
            ...(exceptId ? { NOT: { id: exceptId } } : {}),
          },
          select: { id: true },
        })),
    );
  }

  create(input: {
    code: string;
    name: string;
    description?: string;
  }): Promise<EtcDocumentCodeRecord> {
    const tenantId = RequestContext.requireTenantId();
    return this.transaction((db) =>
      db.documentCodeOption.create({
        data: {
          id: randomUUID(),
          tenantId,
          documentGroup: this.group,
          code: input.code,
          name: input.name,
          ...(input.description === undefined
            ? {}
            : { description: input.description }),
        },
        select: etcDocumentCodeSelect,
      }),
    );
  }

  update(
    id: string,
    input: { code?: string; name?: string; description?: string },
  ): Promise<EtcDocumentCodeRecord> {
    const tenantId = RequestContext.requireTenantId();
    return this.transaction(async (db) => {
      const result = await db.documentCodeOption.updateMany({
        where: { id, tenantId, documentGroup: this.group },
        data: {
          ...(input.code === undefined ? {} : { code: input.code }),
          ...(input.name === undefined ? {} : { name: input.name }),
          ...(input.description === undefined
            ? {}
            : { description: input.description }),
        },
      });
      if (result.count !== 1) throw new Error('document code disappeared');
      return db.documentCodeOption.findFirstOrThrow({
        where: { id, tenantId, documentGroup: this.group },
        select: etcDocumentCodeSelect,
      });
    });
  }

  setActive(id: string, isActive: boolean): Promise<EtcDocumentCodeRecord> {
    const tenantId = RequestContext.requireTenantId();
    return this.transaction(async (db) => {
      const result = await db.documentCodeOption.updateMany({
        where: { id, tenantId, documentGroup: this.group },
        data: { isActive },
      });
      if (result.count !== 1) throw new Error('document code disappeared');
      return db.documentCodeOption.findFirstOrThrow({
        where: { id, tenantId, documentGroup: this.group },
        select: etcDocumentCodeSelect,
      });
    });
  }
}
