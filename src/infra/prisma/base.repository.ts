import {
  PrismaExecutor,
  PrismaReferenceReadExecutor,
} from './prisma-executor.type';
import { UnitOfWorkService } from './unit-of-work.service';

export abstract class BaseRepository {
  protected constructor(private readonly unitOfWork: UnitOfWorkService) {}
  protected get db(): PrismaExecutor {
    return this.unitOfWork.client;
  }
  protected transaction<T>(
    work: (db: PrismaExecutor) => Promise<T>,
    options?: Parameters<UnitOfWorkService['execute']>[1],
  ): Promise<T> {
    return this.unitOfWork.execute((transaction) => work(transaction), options);
  }
  protected referenceRead<T>(
    work: (db: PrismaReferenceReadExecutor) => Promise<T>,
  ): Promise<T> {
    return this.unitOfWork.executeReferenceRead(work);
  }
}
