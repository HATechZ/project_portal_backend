import { Module } from '@nestjs/common';
import { ProjectController } from './project.controller';
import { ProjectRepository } from './repositories/project.repository';
import { ProjectService } from './project.service';
import { ProjectStorageCleanupRepository } from './repositories/project-storage-cleanup.repository';
@Module({
  controllers: [ProjectController],
  providers: [
    ProjectService,
    ProjectRepository,
    ProjectStorageCleanupRepository,
  ],
})
export class ProjectModule {}
