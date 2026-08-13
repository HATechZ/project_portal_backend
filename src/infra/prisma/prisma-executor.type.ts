import { PrismaClient } from '../../generated/prisma/client';

export type PrismaTransactionClient = Parameters<
  Parameters<PrismaClient['$transaction']>[0]
>[0];
export type PrismaExecutor = PrismaClient | PrismaTransactionClient;
