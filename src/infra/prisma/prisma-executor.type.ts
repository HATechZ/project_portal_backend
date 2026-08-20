import { TenantPrismaClient } from './tenant-prisma.extension';

export type PrismaTransactionClient = Parameters<
  Parameters<TenantPrismaClient['$transaction']>[0]
>[0];
export type PrismaExecutor = TenantPrismaClient | PrismaTransactionClient;
