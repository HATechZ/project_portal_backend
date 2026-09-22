import { Module } from '@nestjs/common';
import { BidController } from './bid.controller';
import { BidService } from './bid.service';
import { BidRepository } from './repositories/bid.repository';
import { BidStorageCleanupRepository } from './repositories/bid-storage-cleanup.repository';

@Module({
  controllers: [BidController],
  providers: [BidService, BidRepository, BidStorageCleanupRepository],
})
export class BidModule {}
