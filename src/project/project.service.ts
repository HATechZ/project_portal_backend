import { Inject, Injectable } from '@nestjs/common';
import {
  FILE_STORAGE,
  type FileStorage,
} from '../contracts/storage/file-storage.port';
import { OutboxService } from '../infra/messaging/outbox.service';
import { UnitOfWorkService } from '../infra/prisma/unit-of-work.service';
import { ProjectStorageCleanupRepository } from './repositories/project-storage-cleanup.repository';
import { ProjectRepository } from './repositories/project.repository';
import { ProjectServiceBase } from './providers/project.service-base';

export type { ProjectUploadedFile } from './providers/project.service-base';

@Injectable()
export class ProjectService extends ProjectServiceBase {
  constructor(
    projects: ProjectRepository,
    uow: UnitOfWorkService,
    outbox: OutboxService,
    cleanup: ProjectStorageCleanupRepository,
    @Inject(FILE_STORAGE) storage: FileStorage,
  ) {
    super(projects, uow, outbox, cleanup, storage);
  }
}
