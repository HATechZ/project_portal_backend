import { Prisma, PrismaClient } from '../../generated/prisma/client';
import { RequestContext } from '../../common/context/request-context';
import { TENANT_SCOPED_MODELS } from '../../common/tenant/tenant.constants';

type QueryArguments = Record<string, unknown>;

const FILTER_OPERATIONS = new Set([
  'findUnique',
  'findUniqueOrThrow',
  'findFirst',
  'findFirstOrThrow',
  'findMany',
  'count',
  'aggregate',
  'groupBy',
  'update',
  'updateMany',
  'updateManyAndReturn',
  'delete',
  'deleteMany',
]);

const ROLE_READ_FILTER_OPERATIONS = new Set([
  'findFirst',
  'findFirstOrThrow',
  'findMany',
  'count',
  'aggregate',
  'groupBy',
]);

function withTenantWhere(
  args: QueryArguments,
  tenantId: string,
): QueryArguments {
  return {
    ...args,
    where: { ...(args.where as object | undefined), tenantId },
  };
}

function withTenantData(data: unknown, tenantId: string): unknown {
  if (Array.isArray(data)) {
    return data.map((item) => ({ ...(item as object), tenantId }));
  }
  return { ...(data as object | undefined), tenantId };
}

function scopeArguments(
  operation: string,
  args: QueryArguments,
  tenantId: string,
): QueryArguments {
  if (FILTER_OPERATIONS.has(operation)) {
    const scoped = withTenantWhere(args, tenantId);
    if (operation.startsWith('update')) {
      return { ...scoped, data: withTenantData(scoped.data, tenantId) };
    }
    return scoped;
  }
  if (operation === 'create' || operation.startsWith('createMany')) {
    return { ...args, data: withTenantData(args.data, tenantId) };
  }
  if (operation === 'upsert') {
    return {
      ...withTenantWhere(args, tenantId),
      create: withTenantData(args.create, tenantId),
      update: withTenantData(args.update, tenantId),
    };
  }
  return args;
}

/**
 * Roles are a mixed catalog: system roles are globally visible while custom
 * access roles are tenant-owned. They cannot use the normal tenant-only
 * branch without hiding fixed workflow identities from every tenant.
 */
function scopeRoleArguments(
  operation: string,
  args: QueryArguments,
  tenantId: string,
): QueryArguments {
  if (operation === 'findUnique' || operation === 'findUniqueOrThrow') {
    throw new Error(
      'Role findUnique is unsafe for the mixed system/custom role catalog; use findFirst with tenant scope.',
    );
  }
  const customRoleData = (data: unknown): unknown => {
    if (Array.isArray(data)) {
      return data.map((item) => ({
        ...(item as object),
        isSystemRole: false,
        tenantId,
      }));
    }
    return {
      ...(data as object | undefined),
      isSystemRole: false,
      tenantId,
    };
  };
  const where = args.where as object | undefined;
  const readableWhere = {
    AND: [
      ...(where ? [where] : []),
      {
        OR: [{ isSystemRole: true }, { tenantId }],
      },
    ],
  };
  const writableWhere = {
    AND: [...(where ? [where] : []), { isSystemRole: false, tenantId }],
  };

  if (ROLE_READ_FILTER_OPERATIONS.has(operation)) {
    return { ...args, where: readableWhere };
  }
  if (
    [
      'update',
      'updateMany',
      'updateManyAndReturn',
      'delete',
      'deleteMany',
    ].includes(operation)
  ) {
    return { ...args, where: writableWhere };
  }
  if (operation === 'create' || operation.startsWith('createMany')) {
    return {
      ...args,
      data: customRoleData(args.data),
    };
  }
  if (operation === 'upsert') {
    return {
      ...args,
      where: writableWhere,
      create: customRoleData(args.create),
      update: customRoleData(args.update),
    };
  }
  return args;
}

export const tenantScopeExtension = Prisma.defineExtension({
  name: 'tenant-scope',
  query: {
    $allModels: {
      $allOperations({ model, operation, args, query }) {
        if (model === 'Role') {
          const tenantId = RequestContext.requireTenantId();
          return query(scopeRoleArguments(operation, args, tenantId));
        }
        if (!TENANT_SCOPED_MODELS.has(model)) return query(args);
        const tenantId = RequestContext.requireTenantId();
        return query(scopeArguments(operation, args, tenantId));
      },
    },
  },
});

export function createTenantPrismaClient(client: PrismaClient) {
  return client.$extends(tenantScopeExtension);
}

export type TenantPrismaClient = ReturnType<typeof createTenantPrismaClient>;
