import { Module } from '@nestjs/common';
import { ProjectController } from './project.controller';
import { ProjectRepository } from './repositories/project.repository';
import { ProjectService } from './project.service';
import { ProjectStorageCleanupRepository } from './repositories/project-storage-cleanup.repository';
import { DocumentUploadRequestRepository } from '../common/documents/document-upload-request.repository';
@Module({
  controllers: [ProjectController],
  providers: [
    ProjectService,
    ProjectRepository,
    ProjectStorageCleanupRepository,
    DocumentUploadRequestRepository,
  ],
})
export class ProjectModule {}
