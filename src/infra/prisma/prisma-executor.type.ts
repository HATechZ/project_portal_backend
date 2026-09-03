import { Prisma } from '../../generated/prisma/client';
import { TenantPrismaClient } from './tenant-prisma.extension';

export type PrismaTransactionClient = Parameters<
  Parameters<TenantPrismaClient['$transaction']>[0]
>[0];
export type PrismaExecutor = TenantPrismaClient | PrismaTransactionClient;
export interface PrismaProvisioningExecutor {
  $queryRaw<T = unknown>(query: Prisma.Sql): Prisma.PrismaPromise<T>;
}
export interface PrismaReferenceReadExecutor {
  $queryRaw<T = unknown>(query: Prisma.Sql): Prisma.PrismaPromise<T>;
}
