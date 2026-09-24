import { Inject, Injectable } from '@nestjs/common';
import {
  FILE_STORAGE,
  type FileStorage,
} from '../contracts/storage/file-storage.port';
import { UnitOfWorkService } from '../infra/prisma/unit-of-work.service';
import { WorkRequestActionsProvider } from './providers/work-request-actions.provider';
import { WorkRequestFileProvider } from './providers/work-request-file.provider';
import { WorkRequestResourceScopeProvider } from './providers/work-request-resource-scope.provider';
import { WorkRequestServiceBase } from './providers/work-request-service-base';
import { WorkRequestStorageProvider } from './providers/work-request-storage.provider';
import { WorkRequestDocumentHistoryProvider } from './providers/work-request-document-history.provider';
import { WorkRequestRepository } from './repositories/work-request.repository';
import { WorkRequestReadRepository } from './repositories/work-request-read.repository';
import { WorkRequestEventRepository } from './repositories/work-request-event.repository';
import { WorkRequestNamingProvider } from './providers/work-request-naming.provider';

export type WorkRequestUploadedFile = {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
};

@Injectable()
export class WorkRequestService extends WorkRequestServiceBase {
  constructor(
    repository: WorkRequestRepository,
    reads: WorkRequestReadRepository,
    eventsRepository: WorkRequestEventRepository,
    uow: UnitOfWorkService,
    files: WorkRequestFileProvider,
    scope: WorkRequestResourceScopeProvider,
    storageProvider: WorkRequestStorageProvider,
    actions: WorkRequestActionsProvider,
    history: WorkRequestDocumentHistoryProvider,
    naming: WorkRequestNamingProvider,
    @Inject(FILE_STORAGE) storage: FileStorage,
  ) {
    super(
      repository,
      reads,
      eventsRepository,
      uow,
      files,
      scope,
      storageProvider,
      actions,
      history,
      naming,
      storage,
    );
  }
}
