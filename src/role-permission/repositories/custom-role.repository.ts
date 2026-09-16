import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { Prisma, WorkflowActionCode } from '../../generated/prisma/client';
import { RequestContext } from '../../common/context/request-context';
import { BaseRepository } from '../../infra/prisma/base.repository';
import { UnitOfWorkService } from '../../infra/prisma/unit-of-work.service';
import { PrismaExecutor } from '../../infra/prisma/prisma-executor.type';
import { type CustomRoleScope } from '../providers/custom-role-policy';
import { roleSelect, type RoleRecord } from './role-permission.records';

@Injectable()
export class CustomRoleRepository extends BaseRepository {
  constructor(unitOfWork: UnitOfWorkService) {
    super(unitOfWork);
  }

  create(input: {
    name: string;
    description?: string;
    scope: CustomRoleScope;
    permissionCodes: WorkflowActionCode[];
  }): Promise<RoleRecord> {
    const tenantId = RequestContext.requireTenantId();
    return this.transaction(
      async (db) => {
        const code = await this.nextCode(db, tenantId, input.name);
        const actions = await db.workflowActionDefinition.findMany({
          where: { code: { in: input.permissionCodes } },
          select: { id: true },
        });
        const role = await db.role.create({
          data: {
            id: randomUUID(),
            tenantId,
            name: input.name.trim(),
            ...(input.description === undefined
              ? {}
              : { description: input.description.trim() || null }),
            isSystemRole: false,
            customCode: code,
            customScope: input.scope,
            workflowActionRolePermissionsByRoleId: {
              create: actions.map((action) => ({
                id: randomUUID(),
                tenantId,
                actionId: action.id,
                allowed: true,
              })),
            },
          },
          select: { id: true },
        });
        return db.role.findFirstOrThrow({
          where: { id: role.id, tenantId, isSystemRole: false },
          select: roleSelect(tenantId),
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  private async nextCode(
    db: PrismaExecutor,
    tenantId: string,
    name: string,
  ): Promise<string> {
    const base =
      name
        .trim()
        .toLowerCase()
        .normalize('NFKD')
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '')
        .slice(0, 100) || 'custom_role';
    const matches = await db.role.findMany({
      where: { tenantId, customCode: { startsWith: base } },
      select: { customCode: true },
    });
    const used = new Set(matches.map(({ customCode }) => customCode));
    if (!used.has(base)) return base;
    for (let suffix = 2; ; suffix += 1) {
      const candidate = `${base}_${suffix}`;
      if (!used.has(candidate)) return candidate;
    }
  }
}
