import { Module } from '@nestjs/common';
import { BidController } from './bid.controller';
import { BidService } from './bid.service';
import { BidRepository } from './repositories/bid.repository';
import { BidStorageCleanupRepository } from './repositories/bid-storage-cleanup.repository';
import { DocumentUploadRequestRepository } from '../common/documents/document-upload-request.repository';
import { BidBusinessService } from './bid-business.service';
import { BidBusinessRepository } from './repositories/bid-business.repository';
import { BidBusinessReadinessProvider } from './providers/bid-business-readiness.provider';
import { BidBusinessTransactionProvider } from './providers/bid-business-transaction.provider';
import { BidBusinessController } from './bid-business.controller';

@Module({
  controllers: [BidController, BidBusinessController],
  providers: [
    BidService,
    BidRepository,
    BidStorageCleanupRepository,
    DocumentUploadRequestRepository,
    BidBusinessService,
    BidBusinessRepository,
    BidBusinessReadinessProvider,
    BidBusinessTransactionProvider,
  ],
})
export class BidModule {}
