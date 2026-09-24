import { Global, Module } from '@nestjs/common';
import { FILE_STORAGE } from '../../contracts/storage/file-storage.port';
import { LocalFileStorageService } from './local-file-storage.service';
import { BidStorageCleanupProcessor } from './bid-storage-cleanup.processor';
import { ProjectStorageCleanupProcessor } from './project-storage-cleanup.processor';
import { WorkRequestStorageCleanupProcessor } from './work-request-storage-cleanup.processor';

@Global()
@Module({
  providers: [
    LocalFileStorageService,
    BidStorageCleanupProcessor,
    ProjectStorageCleanupProcessor,
    WorkRequestStorageCleanupProcessor,
    { provide: FILE_STORAGE, useExisting: LocalFileStorageService },
  ],
  exports: [FILE_STORAGE],
})
export class StorageModule {}
