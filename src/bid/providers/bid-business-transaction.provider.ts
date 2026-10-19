import { Injectable } from '@nestjs/common';
import { UnitOfWorkService } from '../../infra/prisma/unit-of-work.service';

/** Bounded retry for PostgreSQL serializable C3 command transactions. */
@Injectable()
export class BidBusinessTransactionProvider {
  constructor(private readonly uow: UnitOfWorkService) {}

  async execute<T>(work: () => Promise<T>): Promise<T> {
    for (let attempt = 0; ; attempt += 1) {
      try {
        return await this.uow.execute(work, { isolationLevel: 'Serializable' });
      } catch (error) {
        if (!isSerializationFailure(error) || attempt >= 1) throw error;
      }
    }
  }
}

function isSerializationFailure(error: unknown): boolean {
  return (error as { code?: unknown } | undefined)?.code === 'P2034';
}
