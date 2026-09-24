import { randomUUID } from 'node:crypto';
import { HttpStatus, Inject } from '@nestjs/common';
import { RequestContext } from '../../common/context/request-context';
import { AppErrorCode } from '../../common/exceptions/app-error-code';
import { AppException } from '../../common/exceptions/app-exception';
import { PaginationQueryDto } from '../../common/pagination/dtos/pagination-query.dto';
import { paginate } from '../../common/pagination/paginate';
import type { SessionActor } from '../../common/security/session.types';
import {
  FILE_STORAGE,
  type FileStorage,
} from '../../contracts/storage/file-storage.port';
import { UnitOfWorkService } from '../../infra/prisma/unit-of-work.service';
import {
  CreateWorkRequestDto,
  UpdateWorkRequestDto,
} from '../dtos/work-request.dto';
import type { WorkRequestUploadedFile } from '../work-request.service';
import { WorkRequestRepository } from '../repositories/work-request.repository';
import { WorkRequestReadRepository } from '../repositories/work-request-read.repository';
import { WorkRequestEventRepository } from '../repositories/work-request-event.repository';
import { WorkRequestActionsProvider } from './work-request-actions.provider';
import { WorkRequestFileProvider } from './work-request-file.provider';
import { toWorkRequestResponse } from './work-request-response.mapper';
import { WorkRequestResourceScopeProvider } from './work-request-resource-scope.provider';
import { WorkRequestStorageProvider } from './work-request-storage.provider';
import { WorkRequestDocumentHistoryProvider } from './work-request-document-history.provider';
import { WorkRequestNamingProvider } from './work-request-naming.provider';

export abstract class WorkRequestServiceBase {
  protected constructor(
    private readonly repository: WorkRequestRepository,
    private readonly reads: WorkRequestReadRepository,
    private readonly eventsRepository: WorkRequestEventRepository,
    private readonly uow: UnitOfWorkService,
    private readonly files: WorkRequestFileProvider,
    private readonly scope: WorkRequestResourceScopeProvider,
    private readonly storageProvider: WorkRequestStorageProvider,
    private readonly actions: WorkRequestActionsProvider,
    private readonly history: WorkRequestDocumentHistoryProvider,
    private readonly naming: WorkRequestNamingProvider,
    @Inject(FILE_STORAGE) private readonly storage: FileStorage,
  ) {}
  async create(
    input: CreateWorkRequestDto,
    uploads: WorkRequestUploadedFile[],
    actor: SessionActor,
  ) {
    const codeIds = input.documentCodeIds ?? [];
    this.files.assertMapping(uploads, codeIds);
    let reference: Awaited<ReturnType<WorkRequestRepository['prepareCreate']>>;
    try {
      reference = await this.repository.prepareCreate(
        input.bidId,
        input.projectId,
        codeIds,
      );
    } catch (error) {
      throw mapReferenceError(error);
    }
    this.scope.assert(actor, reference.parent);
    if (reference.parent.state !== (input.bidId ? 'BIDDING' : 'ACTIVE'))
      throw conflict('Parent is not eligible for a Work Request.');
    const id = randomUUID();
    const files = uploads.map((file, index) => {
      const originalFileName = this.files.originalName(file.originalname);
      const documentCodeSnapshot = reference.codes.get(codeIds[index]);
      if (!documentCodeSnapshot)
        throw notFound('A Document Code was not found or inactive.');
      if (file.size < 1) throw bad('Uploaded file is invalid.');
      return {
        id: randomUUID(),
        documentCodeId: codeIds[index],
        documentCodeSnapshot,
        originalFileName,
        generatedFileName: this.naming.generatedFileName({
          bidNaming: reference.bidNaming,
          documentCode: documentCodeSnapshot,
          originalFileName,
          revisionCode: 'A',
        }),
        storageKey: `tenants/${RequestContext.requireTenantId()}/work-requests/${id}/documents/${randomUUID()}${this.files.extension(originalFileName)}`,
        mimeType: file.mimetype,
        fileSizeBytes: BigInt(file.size),
        content: file.buffer,
      };
    });
    let stored: string[] = [];
    try {
      stored = await this.storageProvider.putAll(this.storage, files);
      const record = await this.uow.execute(() =>
        this.repository.create({
          id,
          bidId: input.bidId,
          projectId: input.projectId,
          title: input.title,
          priority: input.priority,
          notes: input.notes,
          actorId: actor.id,
          files,
        }),
      );
      return toWorkRequestResponse(record);
    } catch (error) {
      await this.storageProvider.compensate(this.storage, stored);
      throw error;
    }
  }
  async list(query: PaginationQueryDto, actor: SessionActor) {
    const scope = this.scope.scopeFor(actor);
    return paginate(
      query,
      async ({ skip, take }) =>
        (await this.reads.list(skip, take, scope)).map((r) =>
          toWorkRequestResponse(
            r,
            this.actions.available(actor, r.events[0]?.resultingState ?? null),
          ),
        ),
      () => this.reads.count(scope),
    );
  }
  async find(id: string, actor: SessionActor) {
    const record = await this.reads.find(id);
    if (!record) throw notFound();
    this.scope.assert(actor, this.reads.parentScope(record));
    return toWorkRequestResponse(
      record,
      this.actions.available(actor, record.events[0]?.resultingState ?? null),
    );
  }
  async update(id: string, input: UpdateWorkRequestDto, actor: SessionActor) {
    if (
      input.title === undefined &&
      input.priority === undefined &&
      input.notes === undefined
    )
      throw bad('Supply metadata to update.');
    const current = await this.reads.find(id);
    if (!current) throw notFound();
    this.scope.assert(actor, this.reads.parentScope(current));
    const record = await this.uow.execute(() =>
      this.repository.update(id, input),
    );
    if (!record) throw notFound();
    return toWorkRequestResponse(
      record,
      this.actions.available(actor, record.events[0]?.resultingState ?? null),
    );
  }
  async events(id: string, query: PaginationQueryDto, actor: SessionActor) {
    const record = await this.reads.find(id);
    if (!record) throw notFound();
    this.scope.assert(actor, this.reads.parentScope(record));
    return paginate(
      query,
      ({ skip, take }) => this.eventsRepository.events(id, skip, take),
      () => this.eventsRepository.count(id),
    );
  }
  async availableActions(id: string, actor: SessionActor) {
    const record = await this.reads.find(id);
    if (!record) throw notFound();
    this.scope.assert(actor, this.reads.parentScope(record));
    return this.actions.available(
      actor,
      record.events[0]?.resultingState ?? null,
    );
  }
  async documents(id: string, actor: SessionActor) {
    const record = await this.reads.find(id);
    if (!record) throw notFound();
    this.scope.assert(actor, this.reads.parentScope(record));
    return this.history.list(id);
  }
  async documentVersions(id: string, documentId: string, actor: SessionActor) {
    const record = await this.reads.find(id);
    if (!record) throw notFound();
    this.scope.assert(actor, this.reads.parentScope(record));
    return this.history.versions(id, documentId);
  }
}
function bad(message: string) {
  return new AppException({
    code: AppErrorCode.BadRequest,
    status: HttpStatus.BAD_REQUEST,
    message,
  });
}
function notFound(message = 'Work Request was not found.') {
  return new AppException({
    code: AppErrorCode.NotFound,
    status: 404,
    message,
  });
}
function conflict(message: string) {
  return new AppException({
    code: AppErrorCode.Conflict,
    status: 409,
    message,
  });
}
function mapReferenceError(error: unknown): Error {
  if (!(error instanceof Error)) return error as Error;
  if (error.message === 'WR_PARENT_XOR')
    return bad('Supply exactly one Bid or Project.');
  if (error.message === 'WR_PARENT') return notFound('Parent was not found.');
  if (error.message === 'WR_DOCUMENT_CODE')
    return notFound('A Document Code was not found or inactive.');
  return error;
}
