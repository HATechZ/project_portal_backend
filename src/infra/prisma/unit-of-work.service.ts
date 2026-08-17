import { AsyncLocalStorage } from 'node:async_hooks';
import { Injectable } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client';
import {
  PrismaExecutor,
  PrismaTransactionClient,
} from './prisma-executor.type';
import { PrismaService } from './prisma.service';

@Injectable()
export class UnitOfWorkService {
  private readonly storage = new AsyncLocalStorage<PrismaTransactionClient>();

  constructor(private readonly prisma: PrismaService) {}

  get client(): PrismaExecutor {
    return this.storage.getStore() ?? this.prisma.scoped;
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
    return this.prisma.scoped.$transaction(
      (transaction) => this.storage.run(transaction, () => work(transaction)),
      {
        maxWait: options?.maxWait ?? 5000,
        timeout: options?.timeout ?? 15000,
        isolationLevel: options?.isolationLevel,
      },
    );
  }
}
