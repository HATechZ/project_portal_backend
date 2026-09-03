import { AsyncLocalStorage } from 'node:async_hooks';
import { Injectable } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client';
import {
  PrismaExecutor,
  PrismaProvisioningExecutor,
  PrismaReferenceReadExecutor,
  PrismaTransactionClient,
} from './prisma-executor.type';
import { PrismaService } from './prisma.service';
import { RequestContext } from '../../common/context/request-context';

@Injectable()
export class UnitOfWorkService {
  private readonly storage = new AsyncLocalStorage<PrismaTransactionClient>();

  constructor(private readonly prisma: PrismaService) {}

  get client(): PrismaExecutor {
    const transaction = this.storage.getStore();
    if (!transaction) {
      throw new Error('Repository access requires an active unit of work');
    }
    return transaction;
  }
  get inTransaction(): boolean {
    return this.storage.getStore() !== undefined;
  }

  async execute<T>(
    work: (transaction: PrismaTransactionClient) => Promise<T>,
    options?: {
      maxWait?: number;
      timeout?: number;
      isolationLevel?: Prisma.TransactionIsolationLevel;
    },
  ): Promise<T> {
    const current = this.storage.getStore();
    if (current) return work(current);
    const tenantId = RequestContext.requireTenantId();
    return this.prisma.scoped.$transaction(
      async (transaction) => {
        await transaction.$executeRaw`SELECT set_config('app.tenant_id', ${tenantId}, true)`;
        return this.storage.run(transaction, () => work(transaction));
      },
      {
        maxWait: options?.maxWait ?? 5000,
        timeout: options?.timeout ?? 15000,
        isolationLevel: options?.isolationLevel,
      },
    );
  }

  async executeProvisioning<T>(
    work: (executor: PrismaProvisioningExecutor) => Promise<T>,
  ): Promise<T> {
    if (this.storage.getStore()) {
      throw new Error('Provisioning cannot join a tenant-scoped unit of work');
    }
    return this.prisma.$transaction((transaction) => {
      const executor: PrismaProvisioningExecutor = Object.freeze({
        $queryRaw: <TResult = unknown>(query: Prisma.Sql) =>
          transaction.$queryRaw<TResult>(query),
      });
      return work(executor);
    });
  }

  async executeReferenceRead<T>(
    work: (executor: PrismaReferenceReadExecutor) => Promise<T>,
  ): Promise<T> {
    if (this.storage.getStore()) {
      throw new Error(
        'A public reference read cannot join a tenant unit of work',
      );
    }
    return this.prisma.$transaction((transaction) => {
      const executor: PrismaReferenceReadExecutor = Object.freeze({
        $queryRaw: <TResult = unknown>(query: Prisma.Sql) =>
          transaction.$queryRaw<TResult>(query),
      });
      return work(executor);
    });
  }
}
