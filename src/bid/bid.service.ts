import { Inject, Injectable } from '@nestjs/common';
import {
  FILE_STORAGE,
  type FileStorage,
} from '../contracts/storage/file-storage.port';
import { OutboxService } from '../infra/messaging/outbox.service';
import { UnitOfWorkService } from '../infra/prisma/unit-of-work.service';
import { BidStorageCleanupRepository } from './repositories/bid-storage-cleanup.repository';
import { BidRepository } from './repositories/bid.repository';
import { BidServiceBase } from './providers/bid.service-base';

export {
  bidFileName,
  bidProjectCode,
  normalizeShipment,
} from './providers/bid.service-base';
export type { BidUploadedFile } from './providers/bid.service-base';

@Injectable()
export class BidService extends BidServiceBase {
  constructor(
    bids: BidRepository,
    unitOfWork: UnitOfWorkService,
    outbox: OutboxService,
    cleanup: BidStorageCleanupRepository,
    @Inject(FILE_STORAGE) storage: FileStorage,
  ) {
    super(bids, unitOfWork, outbox, cleanup, storage);
  }
}
