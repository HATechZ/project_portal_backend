import { randomUUID } from 'node:crypto';
import { HttpStatus, Inject } from '@nestjs/common';
import { RequestContext } from '../../common/context/request-context';
import { AppErrorCode } from '../../common/exceptions/app-error-code';
import { AppException } from '../../common/exceptions/app-exception';
import { PaginationQueryDto } from '../../common/pagination/dtos/pagination-query.dto';
import { paginate } from '../../common/pagination/paginate';
import { PaginatedResult } from '../../common/pagination/paginated-result';
import {
  ProjectCreated,
  ProjectStatusChanged,
  ProjectUpdated,
} from '../../contracts/events/project-events';
import {
  FILE_STORAGE,
  type FileStorage,
} from '../../contracts/storage/file-storage.port';
import { OutboxService } from '../../infra/messaging/outbox.service';
import { UnitOfWorkService } from '../../infra/prisma/unit-of-work.service';
import {
  CreateProjectDto,
  ProjectResponseDto,
  ReclassifyProjectDocumentDto,
  UpdateProjectDto,
} from '../dtos/project.dto';
import {
  ProjectRecord,
  ProjectRepository,
} from '../repositories/project.repository';
import { ProjectStorageCleanupRepository } from '../repositories/project-storage-cleanup.repository';
import {
  deriveProjectCode,
  formatDirectProjectDocumentFileName,
} from '../../common/documents/document-naming';
import { DocumentUploadPipeline } from '../../common/documents/document-upload.pipeline';
import type { DocumentSummaryDto } from '../../common/documents/document-summary.dto';
import type { DocumentVersionResponseDto } from '../../common/documents/document-summary.dto';
import type { SessionActor } from '../../common/security/session.types';
import { DocumentUploadRequestRepository } from '../../common/documents/document-upload-request.repository';
import {
  DocumentUploadOperationCode,
  DocumentUploadOwnerCode,
  PermissionCode,
} from '../../generated/prisma/client';

export interface ProjectUploadedFile {
  fieldname: string;
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

export abstract class ProjectServiceBase {
  protected constructor(
    private readonly projects: ProjectRepository,
    private readonly uow: UnitOfWorkService,
    private readonly outbox: OutboxService,
    private readonly cleanup: ProjectStorageCleanupRepository,
    @Inject(FILE_STORAGE) private readonly storage: FileStorage,
    private readonly receipts?: DocumentUploadRequestRepository,
  ) {}

  async createStandaloneDocuments(
    projectId: string,
    uploads: ProjectUploadedFile[],
    documentCodeIds: string[],
    actor: SessionActor,
  ): Promise<DocumentSummaryDto[]> {
    let context: Awaited<
      ReturnType<ProjectRepository['prepareStandaloneDocuments']>
    >;
    try {
      context = await this.projects.prepareStandaloneDocuments(
        projectId,
        documentCodeIds,
      );
    } catch (error) {
      throw map(error);
    }
    if (!context) throw notFound();
    const requestId = RequestContext.requestId()!;
    const replay =
      this.receipts &&
      (await this.receipts.find({
        owner: DocumentUploadOwnerCode.DIRECT_PROJECT,
        parentId: projectId,
        targetId: projectId,
        operation: DocumentUploadOperationCode.NEW_DOCUMENT,
        requestId,
      }));
    if (replay) return replay.response as unknown as DocumentSummaryDto[];
    const drafts = DocumentUploadPipeline.prepare({
      uploads,
      documentCodeIds,
      codes: context.codes,
      revisionCode: 'A',
      storagePrefix: `tenants/${RequestContext.requireTenantId()}/projects/${projectId}/documents`,
      generatedFileName: (code, uploadedFileName) =>
        formatDirectProjectDocumentFileName({
          projectCode: context.project.projectCode!,
          cargoCode: context.project.cargoCodeSnapshot!,
          vesselCode: context.project.vesselCodeSnapshot!,
          shipmentNumber: context.project.shipmentNumber!,
          documentCode: code.code,
          documentName: code.name,
          revisionCode: 'A',
          uploadedFileName,
        }),
    });
    let stored: string[] = [];
    try {
      stored = await DocumentUploadPipeline.putAll(this.storage, drafts);
      const created = await this.uow.execute(async () => {
        const result = await this.projects.createStandaloneDocuments(
          projectId,
          actor.id,
          drafts,
        );
        if (result && this.receipts)
          await this.receipts.write({
            owner: DocumentUploadOwnerCode.DIRECT_PROJECT,
            parentId: projectId,
            targetId: projectId,
            operation: DocumentUploadOperationCode.NEW_DOCUMENT,
            requestId,
            actorId: actor.id,
            response: result.map((document) =>
              documentSummary(projectId, document),
            ) as never,
            audit: {
              entityId: projectId,
              summary: 'NEW_DOCUMENT',
              afterData: {
                requestId,
                documentIds: drafts.map((draft) => draft.documentId),
                versionIds: drafts.map((draft) => draft.versionId),
              },
            },
          });
        return result;
      });
      if (!created) throw notFound();
      return created.map((document) => documentSummary(projectId, document));
    } catch (error) {
      await DocumentUploadPipeline.compensate(
        this.storage,
        stored,
        (key, cause) => this.cleanup.enqueue(key, cause),
      );
      throw error;
    }
  }
  async appendDocumentVersion(
    projectId: string,
    documentId: string,
    upload: ProjectUploadedFile,
    actor: SessionActor,
  ): Promise<DocumentVersionResponseDto> {
    const context = await this.projects.prepareDocumentVersion(
      projectId,
      documentId,
    );
    if (!context) throw notFound('Project document was not found.');
    const requestId = RequestContext.requestId()!;
    const replay =
      this.receipts &&
      (await this.receipts.find({
        owner: DocumentUploadOwnerCode.DIRECT_PROJECT,
        parentId: projectId,
        targetId: documentId,
        operation: DocumentUploadOperationCode.NEW_VERSION,
        requestId,
      }));
    if (replay) return replay.response as unknown as DocumentVersionResponseDto;
    if (
      !context.directProject.projectCode ||
      !context.directProject.cargoCodeSnapshot ||
      !context.directProject.vesselCodeSnapshot ||
      !context.directProject.shipmentNumber
    )
      throw bad('Project naming context is invalid.');
    const file = DocumentUploadPipeline.prepareVersion({
      upload,
      revisionCode: context.revisionCode,
      storagePrefix: `tenants/${RequestContext.requireTenantId()}/projects/${projectId}/documents/${documentId}/versions`,
      generatedFileName: (uploadedFileName) =>
        formatDirectProjectDocumentFileName({
          projectCode: context.directProject.projectCode!,
          cargoCode: context.directProject.cargoCodeSnapshot!,
          vesselCode: context.directProject.vesselCodeSnapshot!,
          shipmentNumber: context.directProject.shipmentNumber!,
          documentCode: context.documentCodeSnapshot ?? '',
          documentName:
            context.documentNameSnapshot ?? context.documentCodeSnapshot ?? '',
          revisionCode: context.revisionCode,
          uploadedFileName,
        }),
    });
    let stored: string[] = [];
    try {
      stored = await DocumentUploadPipeline.putAll(this.storage, [file]);
      const version = await this.uow.execute(
        async () => {
          const result = await this.projects.appendDocumentVersion(
            projectId,
            documentId,
            actor.id,
            file,
          );
          if (result && this.receipts)
            await this.receipts.write({
              owner: DocumentUploadOwnerCode.DIRECT_PROJECT,
              parentId: projectId,
              targetId: documentId,
              operation: DocumentUploadOperationCode.NEW_VERSION,
              requestId,
              actorId: actor.id,
              response: versionResponse(documentId, result) as never,
              audit: {
                entityId: documentId,
                summary: 'NEW_VERSION',
                afterData: {
                  requestId,
                  projectId,
                  documentId,
                  versionId: result.id,
                },
              },
            });
          return result;
        },
        { isolationLevel: 'Serializable' },
      );
      if (!version) throw notFound('Project document was not found.');
      return versionResponse(documentId, version);
    } catch (error) {
      await DocumentUploadPipeline.compensate(
        this.storage,
        stored,
        (key, cause) => this.cleanup.enqueue(key, cause),
      );
      throw error;
    }
  }

  async create(
    input: CreateProjectDto,
    uploads: ProjectUploadedFile[],
    actorId: string,
    documentCodeIds: string[] = [],
  ): Promise<ProjectResponseDto> {
    const shipmentNumber = normalizeShipment(input.shipmentNumber);
    const documents = documentCodeIds.map((documentCodeId, fileIndex) => ({
      fileIndex,
      documentCodeId,
    }));
    const reference = await this.projects.prepareCreate({
      clientId: input.clientId,
      polId: input.polId,
      podId: input.podId,
      cargoId: input.cargoId,
      vesselId: input.vesselId,
      documentCodeIds: documents.map(({ documentCodeId }) => documentCodeId),
    });
    const projectCode = deriveProjectCode(
      input.name,
      reference.polName,
      reference.podName,
    );
    const projectId = randomUUID();
    const drafts = DocumentUploadPipeline.prepare({
      uploads,
      documentCodeIds,
      codes: reference.documentCodes,
      allowEmpty: true,
      revisionCode: 'A',
      storagePrefix: `tenants/${RequestContext.requireTenantId()}/projects/${projectId}/documents`,
      generatedFileName: (code, uploadedFileName) =>
        formatDirectProjectDocumentFileName({
          projectCode,
          cargoCode: reference.cargoCode,
          vesselCode: reference.vesselCode,
          shipmentNumber,
          documentCode: code.code,
          documentName: code.name,
          revisionCode: 'A',
          uploadedFileName,
        }),
    });
    const files = drafts.map((file) => ({
      id: file.documentId,
      versionId: file.versionId,
      documentCodeId: file.documentCodeId,
      documentCodeSnapshot: file.documentCode,
      documentNameSnapshot: file.documentName,
      originalFileName: file.originalFileName,
      generatedFileName: file.generatedFileName,
      storageKey: file.storageKey,
      mimeType: file.mimeType,
      fileSizeBytes: file.fileSizeBytes,
      content: file.content,
    }));
    const stored: string[] = [];
    try {
      stored.push(
        ...(await DocumentUploadPipeline.putAll(this.storage, drafts)),
      );
      const project = await this.uow.execute(async () => {
        const created = await this.projects.create({
          id: projectId,
          name: input.name,
          normalizedName: normalizeName(input.name),
          clientId: input.clientId,
          polId: input.polId,
          podId: input.podId,
          cargoId: input.cargoId,
          vesselId: input.vesselId,
          projectCode,
          shipmentNumber,
          actorId,
          files,
          snapshots: reference,
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
      await DocumentUploadPipeline.compensate(
        this.storage,
        stored,
        (key, cause) => this.cleanup.enqueue(key, cause),
      );
      throw map(error);
    }
  }

  async findAll(
    query: PaginationQueryDto,
    actor: SessionActor,
  ): Promise<PaginatedResult<ProjectResponseDto>> {
    return paginate(
      query,
      async (args) => (await this.projects.list(args, actor)).map(response),
      () => this.projects.count(actor),
    );
  }
  async findOne(id: string, actor: SessionActor): Promise<ProjectResponseDto> {
    const project = await this.projects.find(id, actor);
    if (!project) throw notFound();
    return response(project);
  }

  async documents(id: string, actor: SessionActor): Promise<DocumentSummaryDto[]> {
    assertPermission(actor, PermissionCode.VIEW_PROJECT);
    const project = await this.projects.find(id, actor);
    if (!project) throw notFound();
    return (await this.projects.documents(id)).map((document) =>
      documentSummary(id, document),
    );
  }

  async documentVersions(
    id: string,
    documentId: string,
    actor: SessionActor,
  ): Promise<DocumentVersionResponseDto[]> {
    assertPermission(actor, PermissionCode.VIEW_PROJECT);
    const project = await this.projects.find(id, actor);
    if (!project) throw notFound();
    const versions = await this.projects.documentVersions(id, documentId);
    if (!versions) throw notFound('Project document was not found.');
    return versions.map((version) => versionResponse(documentId, version));
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
}
function documentSummary(
  parentId: string,
  document: {
    id: string;
    documentCodeId: string | null;
    documentCodeSnapshot: string | null;
    documentNameSnapshot: string | null;
    originalFileName: string;
    versions: Array<{
      id: string;
      versionNumber: number;
      revisionCode: string;
      uploadedFileName: string | null;
      generatedFileName: string | null;
      mimeType: string;
      fileSizeBytes: bigint;
      uploadedAt: Date;
      uploadedByActor: { id: string; label: string };
    }>;
  },
): DocumentSummaryDto {
  const version = document.versions[0];
  return {
    documentId: document.id,
    owner: { kind: 'PROJECT', id: parentId },
    documentCode: {
      id: document.documentCodeId!,
      code: document.documentCodeSnapshot!,
      name: document.documentNameSnapshot!,
    },
    originalFileName: document.originalFileName,
    latestVersion: {
      versionId: version.id,
      versionNumber: version.versionNumber,
      revisionCode: version.revisionCode,
      uploadedFileName: version.uploadedFileName ?? document.originalFileName,
      generatedFileName: version.generatedFileName!,
      mimeType: version.mimeType,
      size: Number(version.fileSizeBytes),
      uploadedBy: version.uploadedByActor,
      uploadedAt: version.uploadedAt,
    },
  };
}
function versionResponse(
  documentId: string,
  version: {
    id: string;
    versionNumber: number;
    revisionCode: string;
    uploadedFileName: string | null;
    generatedFileName: string | null;
    mimeType: string;
    fileSizeBytes: bigint;
    uploadedByActor: { id: string; label: string };
    uploadedAt: Date;
  },
): DocumentVersionResponseDto {
  return {
    documentId,
    versionId: version.id,
    versionNumber: version.versionNumber,
    revisionCode: version.revisionCode,
    uploadedFileName: version.uploadedFileName ?? '',
    generatedFileName: version.generatedFileName ?? '',
    mimeType: version.mimeType,
    size: Number(version.fileSizeBytes),
    uploadedBy: version.uploadedByActor,
    uploadedAt: version.uploadedAt,
  };
}
function response(value: ProjectRecord): ProjectResponseDto {
  return {
    id: value.id,
    name: value.name,
    clientId: value.clientId,
    projectCode: value.projectCode,
    shipmentNumber: value.shipmentNumber,
    status: value.statusEvents[0]?.toStatus.code ?? 'ACTIVE',
    fileCount: value._count.documents,
    documents: value.documents.map((document) => ({
      id: document.id,
      documentCodeId: document.documentCodeId!,
      originalFileName: document.originalFileName,
      generatedFileName: document.generatedFileName,
      mimeType: document.mimeType,
      size: Number(document.fileSizeBytes),
    })),
    createdAt: value.createdAt,
    updatedAt: value.updatedAt,
  };
}
function normalizeName(value: string): string {
  return value.trim().toLowerCase();
}
function normalizeShipment(value: string): string {
  if (!/^\d{1,2}$/.test(value))
    throw bad('Shipment number must contain one or two digits.');
  return value.padStart(2, '0');
}
function bad(message: string): AppException {
  return new AppException({
    code: AppErrorCode.BadRequest,
    status: HttpStatus.BAD_REQUEST,
    message,
  });
}
function assertPermission(actor: SessionActor, permission: PermissionCode): void {
  if (
    !actor.role.rolePermissions.some(
      ({ revokedAt, permission: grant }) =>
        revokedAt === null && grant.code === permission,
    )
  )
    throw new AppException({
      code: AppErrorCode.Forbidden,
      status: HttpStatus.FORBIDDEN,
      message: "You don't have permission to perform this action.",
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
