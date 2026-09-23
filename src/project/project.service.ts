import { randomUUID } from 'node:crypto';
import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { RequestContext } from '../common/context/request-context';
import { AppErrorCode } from '../common/exceptions/app-error-code';
import { AppException } from '../common/exceptions/app-exception';
import { PaginationQueryDto } from '../common/pagination/dtos/pagination-query.dto';
import { paginate } from '../common/pagination/paginate';
import { PaginatedResult } from '../common/pagination/paginated-result';
import {
  ProjectCreated,
  ProjectStatusChanged,
  ProjectUpdated,
} from '../contracts/events/project-events';
import {
  FILE_STORAGE,
  type FileStorage,
} from '../contracts/storage/file-storage.port';
import { OutboxService } from '../infra/messaging/outbox.service';
import { UnitOfWorkService } from '../infra/prisma/unit-of-work.service';
import {
  CreateProjectDto,
  ProjectResponseDto,
  ReclassifyProjectDocumentDto,
  UpdateProjectDto,
} from './dtos/project.dto';
import {
  ProjectRecord,
  ProjectRepository,
} from './repositories/project.repository';
import { ProjectStorageCleanupRepository } from './repositories/project-storage-cleanup.repository';
import {
  assertProjectUploadAllowed,
  projectFileExtension,
  safeProjectOriginalName,
} from './project-upload-policy';

export interface ProjectUploadedFile {
  fieldname: string;
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

@Injectable()
export class ProjectService {
  constructor(
    private readonly projects: ProjectRepository,
    private readonly uow: UnitOfWorkService,
    private readonly outbox: OutboxService,
    private readonly cleanup: ProjectStorageCleanupRepository,
    @Inject(FILE_STORAGE) private readonly storage: FileStorage,
  ) {}

  async create(
    input: CreateProjectDto,
    uploads: ProjectUploadedFile[],
    actorId: string,
    documentCodeIds: string[] = [],
  ): Promise<ProjectResponseDto> {
    const documents = documentCodeIds.map((documentCodeId, fileIndex) => ({
      fileIndex,
      documentCodeId,
    }));
    this.assertUploadDocuments(uploads, documents);
    uploads.forEach(assertProjectUploadAllowed);
    const codes = await this.projects.documentCodes(
      documents.map(({ documentCodeId }) => documentCodeId),
    );
    const projectId = randomUUID();
    const files = uploads.map((file) => {
      const documentCodeId = documents[indexOf(uploads, file)].documentCodeId;
      const documentCodeSnapshot = codes.get(documentCodeId);
      if (!documentCodeSnapshot)
        throw bad('Uploaded file has an invalid Document Code.');
      const originalFileName = safeProjectOriginalName(file.originalname);
      return {
        id: randomUUID(),
        documentCodeId,
        documentCodeSnapshot,
        originalFileName,
        generatedFileName: null,
        storageKey: `tenants/${RequestContext.requireTenantId()}/projects/${projectId}/documents/${randomUUID()}${projectFileExtension(originalFileName)}`,
        mimeType: file.mimetype,
        fileSizeBytes: BigInt(file.size),
        content: file.buffer,
      };
    });
    const stored: string[] = [];
    try {
      for (const file of files) {
        await this.storage.put({
          storageKey: file.storageKey,
          content: file.content,
        });
        stored.push(file.storageKey);
      }
      const project = await this.uow.execute(async () => {
        const created = await this.projects.create({
          id: projectId,
          name: input.name,
          normalizedName: normalizeName(input.name),
          clientId: input.clientId,
          actorId,
          files,
        });
        const origin = { tenantId: RequestContext.requireTenantId(), actorId };
        await this.outbox.enqueue(new ProjectCreated(origin, { projectId }));
        await this.outbox.enqueue(
          new ProjectStatusChanged(origin, { projectId, status: 'ACTIVE' }),
        );
        return created;
      });
      return response(project);
    } catch (error) {
      await this.compensate(stored);
      throw map(error);
    }
  }

  async findAll(
    query: PaginationQueryDto,
  ): Promise<PaginatedResult<ProjectResponseDto>> {
    // ObjectScopeGuard resolves grants before this handler. Approved Project readers
    // are tenant-wide, so the repository applies TenantContext/RLS in SQL, not post-filtering.
    return paginate(
      query,
      async (args) => (await this.projects.list(args)).map(response),
      () => this.projects.count(),
    );
  }
  async findOne(id: string): Promise<ProjectResponseDto> {
    const project = await this.projects.find(id);
    if (!project) throw notFound();
    return response(project);
  }
  async update(
    id: string,
    input: UpdateProjectDto,
    actorId: string,
  ): Promise<ProjectResponseDto> {
    if (!input.name) throw bad('Supply a Project name to update.');
    try {
      const project = await this.uow.execute(async () => {
        const renamed = await this.projects.rename(
          id,
          input.name!,
          normalizeName(input.name!),
        );
        if (renamed)
          await this.outbox.enqueue(
            new ProjectUpdated(
              { tenantId: RequestContext.requireTenantId(), actorId },
              { projectId: id },
            ),
          );
        return renamed;
      });
      if (!project) throw notFound();
      return response(project);
    } catch (error) {
      throw map(error);
    }
  }
  async reclassifyDocument(
    projectId: string,
    documentId: string,
    input: ReclassifyProjectDocumentDto,
    actorId: string,
  ) {
    try {
      const document = await this.uow.execute(async () => {
        const changed = await this.projects.reclassifyDocument({
          projectId,
          documentId,
          documentCodeId: input.documentCodeId,
          actorId,
        });
        if (changed)
          await this.outbox.enqueue(
            new ProjectUpdated(
              { tenantId: RequestContext.requireTenantId(), actorId },
              { projectId },
            ),
          );
        return changed;
      });
      if (!document) throw notFound('Project document was not found.');
      return document;
    } catch (error) {
      throw map(error);
    }
  }
  private assertUploadDocuments(
    uploads: ProjectUploadedFile[],
    documents: { fileIndex: number; documentCodeId: string }[],
  ): void {
    if (
      uploads.length !== documents.length ||
      new Set(documents.map((item) => item.fileIndex)).size !==
        documents.length ||
      !documents.every((item, index) => item.fileIndex === index)
    )
      throw bad(
        'documents must map one-for-one to files by contiguous fileIndex.',
      );
  }
  private async compensate(storageKeys: string[]): Promise<void> {
    for (const storageKey of storageKeys)
      try {
        await this.storage.remove(storageKey);
      } catch (error) {
        await this.cleanup.enqueue(
          storageKey,
          error instanceof Error ? error : new Error(String(error)),
        );
      }
  }
}
function response(value: ProjectRecord): ProjectResponseDto {
  return {
    id: value.id,
    name: value.name,
    clientId: value.clientId,
    status: value.statusEvents[0]?.toStatus.code ?? 'ACTIVE',
    fileCount: value._count.documents,
    documents: value.documents.map((document) => ({
      id: document.id,
      documentCodeId: document.documentCodeId!,
      originalFileName: document.originalFileName,
      generatedFileName: document.generatedFileName,
      storageKey: document.storageKey,
      mimeType: document.mimeType,
      size: Number(document.fileSizeBytes),
    })),
    createdAt: value.createdAt,
    updatedAt: value.updatedAt,
  };
}
function indexOf<T>(items: T[], item: T): number {
  return items.indexOf(item);
}
function normalizeName(value: string): string {
  return value.trim().toLowerCase();
}
function bad(message: string): AppException {
  return new AppException({
    code: AppErrorCode.BadRequest,
    status: HttpStatus.BAD_REQUEST,
    message,
  });
}
function notFound(message = 'Project was not found.'): AppException {
  return new AppException({
    code: AppErrorCode.NotFound,
    status: HttpStatus.NOT_FOUND,
    message,
  });
}
function map(error: unknown): Error {
  if (error instanceof AppException) return error;
  if (error instanceof Error && error.message === 'PROJECT_CLIENT')
    return notFound('Client was not found or is inactive.');
  if (error instanceof Error && error.message === 'PROJECT_DOCUMENT_CODE')
    return notFound('A Document Code was not found or is inactive.');
  return error instanceof Error
    ? error
    : new AppException({
        code: AppErrorCode.InternalError,
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        message: 'Project operation failed.',
      });
}
