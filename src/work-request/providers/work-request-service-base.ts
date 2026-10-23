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
import { OutboxService } from '../../infra/messaging/outbox.service';
import { DocumentVersionCreated } from '../../contracts/events/document-events';
import {
  CreateWorkRequestDto,
  UpdateWorkRequestDto,
} from '../dtos/work-request.dto';
import type { WorkRequestUploadedFile } from '../work-request.service';
import { WorkRequestRepository } from '../repositories/work-request.repository';
import { WorkRequestReadRepository } from '../repositories/work-request-read.repository';
import { WorkRequestEventRepository } from '../repositories/work-request-event.repository';
import { WorkRequestActionsProvider } from './work-request-actions.provider';
import { toWorkRequestResponse } from './work-request-response.mapper';
import { WorkRequestStorageProvider } from './work-request-storage.provider';
import { WorkRequestDocumentHistoryProvider } from './work-request-document-history.provider';
import { WorkRequestNamingProvider } from './work-request-naming.provider';
import { DocumentUploadPipeline } from '../../common/documents/document-upload.pipeline';
import type { DocumentSummaryDto } from '../../common/documents/document-summary.dto';
import {
  formatDirectProjectDocumentFileName,
  nextBidRevisionCode,
  nextProjectRevisionCode,
} from '../../common/documents/document-naming';
import { WorkRequestV1StateCode } from '../../generated/prisma/client';
import type { DocumentVersionResponseDto } from '../../common/documents/document-summary.dto';
import type {
  WorkRequestAvailableActionResponseDto,
  WorkRequestEventResponseDto,
} from '../dtos/work-request.dto';
import { DocumentUploadRequestRepository } from '../../common/documents/document-upload-request.repository';
import {
  DocumentUploadOperationCode,
  DocumentUploadOwnerCode,
} from '../../generated/prisma/client';
import { assertWorkRequestExternalClientAccess } from './work-request-external-client-access';

export abstract class WorkRequestServiceBase {
  protected constructor(
    protected readonly repository: WorkRequestRepository,
    private readonly reads: WorkRequestReadRepository,
    private readonly eventsRepository: WorkRequestEventRepository,
    private readonly uow: UnitOfWorkService,
    private readonly storageProvider: WorkRequestStorageProvider,
    private readonly actions: WorkRequestActionsProvider,
    private readonly history: WorkRequestDocumentHistoryProvider,
    private readonly naming: WorkRequestNamingProvider,
    @Inject(FILE_STORAGE) private readonly storage: FileStorage,
    private readonly receipts?: DocumentUploadRequestRepository,
    private readonly outbox?: OutboxService,
  ) {}
  async createStandaloneDocuments(
    id: string,
    uploads: WorkRequestUploadedFile[],
    documentCodeIds: string[],
    actor: SessionActor,
  ): Promise<DocumentSummaryDto[]> {
    let context: Awaited<
      ReturnType<WorkRequestRepository['prepareStandaloneDocuments']>
    >;
    try {
      context = await this.repository.prepareStandaloneDocuments(
        id,
        documentCodeIds,
      );
    } catch (error) {
      throw mapReferenceError(error);
    }
    if (!context) throw notFound();
    assertWorkRequestExternalClientAccess(actor, context.parent);
    const requestId = RequestContext.requestId()!;
    const replay =
      this.receipts &&
      (await this.receipts.find({
        owner: DocumentUploadOwnerCode.WORK_REQUEST,
        parentId: id,
        targetId: id,
        operation: DocumentUploadOperationCode.NEW_DOCUMENT,
        requestId,
      }));
    if (replay) return replay.response as unknown as DocumentSummaryDto[];
    const revisionCode = context.naming.kind === 'BID' ? 'A' : '01';
    const drafts = DocumentUploadPipeline.prepare({
      uploads,
      documentCodeIds,
      codes: context.codes,
      revisionCode,
      storagePrefix: `tenants/${RequestContext.requireTenantId()}/work-requests/${id}/documents`,
      generatedFileName: (code, uploadedFileName) =>
        context.naming.kind === 'BID'
          ? this.naming.generatedFileName({
              bidNaming: context.naming,
              documentCode: code.code,
              documentName: code.name,
              uploadedFileName,
              revisionCode,
            })!
          : formatDirectProjectDocumentFileName({
              ...context.naming,
              documentCode: code.code,
              documentName: code.name,
              uploadedFileName,
              revisionCode,
            }),
    });
    let stored: string[] = [];
    try {
      stored = await DocumentUploadPipeline.putAll(this.storage, drafts);
      const created = await this.uow.execute(async () => {
        const result = await this.repository.createStandaloneDocuments(
          id,
          actor.id,
          drafts,
        );
        if (result && this.outbox)
          await this.outbox.enqueueAll(
            result.map(
              (document) =>
                new DocumentVersionCreated(
                  {
                    tenantId: RequestContext.requireTenantId(),
                    actorId: actor.id,
                    correlationId: requestId,
                  },
                  {
                    owner: 'WORK_REQUEST',
                    parentId: id,
                    documentId: document.id,
                    versionId: document.versions[0].id,
                  },
                ),
            ),
          );
        if (result && this.receipts)
          await this.receipts.write({
            owner: DocumentUploadOwnerCode.WORK_REQUEST,
            parentId: id,
            targetId: id,
            operation: DocumentUploadOperationCode.NEW_DOCUMENT,
            requestId,
            actorId: actor.id,
            response: result.map((document) =>
              documentSummary(id, document),
            ) as never,
            audit: {
              entityId: id,
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
      return created.map((document) => documentSummary(id, document));
    } catch (error) {
      await DocumentUploadPipeline.compensate(this.storage, stored, (key) =>
        this.storageProvider.compensate(this.storage, [key]),
      );
      throw error;
    }
  }
  async appendDocumentVersion(
    id: string,
    documentId: string,
    upload: WorkRequestUploadedFile,
    actor: SessionActor,
  ): Promise<DocumentVersionResponseDto> {
    const context = await this.repository.prepareDocumentVersion(
      id,
      documentId,
    );
    if (!context) throw notFound('Work Request document was not found.');
    const request = context.workRequest;
    const parent = request.bid ?? request.directProject;
    if (!parent) throw notFound('Work Request parent was not found.');
    assertWorkRequestExternalClientAccess(actor, parent);
    const requestId = RequestContext.requestId()!;
    const replay =
      this.receipts &&
      (await this.receipts.find({
        owner: DocumentUploadOwnerCode.WORK_REQUEST,
        parentId: id,
        targetId: documentId,
        operation: DocumentUploadOperationCode.NEW_VERSION,
        requestId,
      }));
    if (replay) return replay.response as unknown as DocumentVersionResponseDto;
    if (!allowsWorkRequestDocumentVersion(request.events[0]?.resultingState))
      throw conflict(
        'Work Request is not accepting working document versions.',
      );
    if (
      !actor.member?.isActive ||
      request.assignments[0]?.memberId !== actor.member.id
    )
      throw notFound('You are not the assigned Work Request Member.');
    const revisionCode = request.bid
      ? nextBidRevisionCode(context.revisionCode)
      : nextProjectRevisionCode(context.revisionCode);
    const file = DocumentUploadPipeline.prepareVersion({
      upload,
      revisionCode,
      storagePrefix: `tenants/${RequestContext.requireTenantId()}/work-requests/${id}/documents/${documentId}/versions`,
      generatedFileName: (uploadedFileName) =>
        request.bid
          ? this.naming.generatedFileName({
              bidNaming: {
                biddingNumber: request.bid.biddingNumber,
                projectCode: request.bid.projectCode,
                cargoCode: request.bid.cargoCodeSnapshot,
                vesselCode: request.bid.vesselCodeSnapshot,
                shipmentNumber: request.bid.shipmentNumber,
              },
              documentCode: context.documentCodeSnapshot ?? '',
              documentName:
                context.documentNameSnapshot ??
                context.documentCodeSnapshot ??
                '',
              uploadedFileName,
              revisionCode,
            })!
          : formatDirectProjectDocumentFileName({
              projectCode: request.directProject!.projectCode!,
              cargoCode: request.directProject!.cargoCodeSnapshot!,
              vesselCode: request.directProject!.vesselCodeSnapshot!,
              shipmentNumber: request.directProject!.shipmentNumber!,
              documentCode: context.documentCodeSnapshot ?? '',
              documentName:
                context.documentNameSnapshot ??
                context.documentCodeSnapshot ??
                '',
              uploadedFileName,
              revisionCode,
            }),
    });
    let stored: string[] = [];
    try {
      stored = await DocumentUploadPipeline.putAll(this.storage, [file]);
      const version = await this.uow.execute(
        async () => {
          const result = await this.repository.appendDocumentVersion(
            id,
            documentId,
            actor.id,
            file,
          );
          if (result && this.outbox)
            await this.outbox.enqueue(
              new DocumentVersionCreated(
                {
                  tenantId: RequestContext.requireTenantId(),
                  actorId: actor.id,
                  correlationId: requestId,
                },
                {
                  owner: 'WORK_REQUEST',
                  parentId: id,
                  documentId,
                  versionId: result.id,
                },
              ),
            );
          if (result && this.receipts)
            await this.receipts.write({
              owner: DocumentUploadOwnerCode.WORK_REQUEST,
              parentId: id,
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
                  workRequestId: id,
                  documentId,
                  versionId: result.id,
                },
              },
            });
          return result;
        },
        { isolationLevel: 'Serializable' },
      );
      if (!version) throw notFound('Work Request document was not found.');
      return versionResponse(documentId, version);
    } catch (error) {
      await DocumentUploadPipeline.compensate(this.storage, stored, (key) =>
        this.storageProvider.compensate(this.storage, [key]),
      );
      throw error;
    }
  }
  async create(
    input: CreateWorkRequestDto,
    uploads: WorkRequestUploadedFile[],
    actor: SessionActor,
  ) {
    const codeIds = input.documentCodeIds ?? [];
    const actorMemberId = actor.member?.id;
    if (!actorMemberId) throw bad('An active Member context is required.');
    const originatingDivisionId = input.originatingDivisionId;
    const intermediateDivisionIds = input.intermediateDivisionIds;
    if (!originatingDivisionId || !intermediateDivisionIds?.length)
      throw bad(
        'An originating Division and at least one intermediate Division are required.',
      );
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
    if (reference.parent.state !== (input.bidId ? 'BIDDING' : 'ACTIVE'))
      throw conflict('Parent is not eligible for a Work Request.');
    if (
      uploads.length > 0 &&
      !reference.bidNaming &&
      (!reference.projectNaming?.projectCode ||
        !reference.projectNaming.cargoCode ||
        !reference.projectNaming.vesselCode ||
        !reference.projectNaming.shipmentNumber)
    )
      throw conflict('Parent naming context is invalid.');
    const id = randomUUID();
    const revisionCode = reference.bidNaming ? 'A' : '01';
    const drafts = DocumentUploadPipeline.prepare({
      uploads,
      documentCodeIds: codeIds,
      codes: reference.codes,
      allowEmpty: true,
      revisionCode,
      storagePrefix: `tenants/${RequestContext.requireTenantId()}/work-requests/${id}/documents`,
      generatedFileName: (code, uploadedFileName) =>
        reference.bidNaming
          ? this.naming.generatedFileName({
              bidNaming: reference.bidNaming,
              documentCode: code.code,
              documentName: code.name,
              uploadedFileName,
              revisionCode,
            })!
          : formatDirectProjectDocumentFileName({
              projectCode: reference.projectNaming.projectCode!,
              cargoCode: reference.projectNaming.cargoCode!,
              vesselCode: reference.projectNaming.vesselCode!,
              shipmentNumber: reference.projectNaming.shipmentNumber!,
              documentCode: code.code,
              documentName: code.name,
              uploadedFileName,
              revisionCode,
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
    let stored: string[] = [];
    try {
      stored = await DocumentUploadPipeline.putAll(this.storage, drafts);
      const record = await this.uow.execute(async () => {
        const created = await this.repository.create({
          id,
          bidId: input.bidId,
          projectId: input.projectId,
          title: input.title,
          priority: input.priority,
          notes: input.notes,
          actorId: actor.id,
          actorMemberId,
          originatingDivisionId,
          intermediateDivisionIds,
          files,
        });
        if (this.outbox)
          await this.outbox.enqueueAll(
            drafts.map(
              (file) =>
                new DocumentVersionCreated(
                  {
                    tenantId: RequestContext.requireTenantId(),
                    actorId: actor.id,
                  },
                  {
                    owner: 'WORK_REQUEST',
                    parentId: id,
                    documentId: file.documentId,
                    versionId: file.versionId,
                  },
                ),
            ),
          );
        return created;
      });
      return toWorkRequestResponse(record);
    } catch (error) {
      await DocumentUploadPipeline.compensate(this.storage, stored, (key) =>
        this.storageProvider.compensate(this.storage, [key]),
      );
      throw error;
    }
  }
  async list(query: PaginationQueryDto, actor: SessionActor) {
    return paginate(
      query,
      async ({ skip, take }) =>
        (await this.reads.list(skip, take, actor)).map((r) =>
          toWorkRequestResponse(
            r,
            this.actions.available(
              actor,
              r.events[0]?.resultingState ?? null,
              r,
            ),
          ),
        ),
      () => this.reads.count(actor),
    );
  }
  async find(id: string, actor: SessionActor) {
    const record = await this.reads.find(id, actor);
    if (!record) throw notFound();
    return toWorkRequestResponse(
      record,
      this.actions.available(
        actor,
        record.events[0]?.resultingState ?? null,
        record,
      ),
    );
  }
  async update(id: string, input: UpdateWorkRequestDto, actor: SessionActor) {
    if (input.title === undefined && input.notes === undefined)
      throw bad('Supply metadata to update.');
    const current = await this.reads.find(id, actor);
    if (!current) throw notFound();
    const record = await this.uow.execute(() =>
      this.repository.update(id, input),
    );
    if (!record) throw notFound();
    return toWorkRequestResponse(
      record,
      this.actions.available(
        actor,
        record.events[0]?.resultingState ?? null,
        record,
      ),
    );
  }
  async events(id: string, query: PaginationQueryDto, actor: SessionActor) {
    void actor;
    const record = await this.reads.find(id, actor);
    if (!record) throw notFound();
    return paginate(
      query,
      async ({ skip, take }): Promise<WorkRequestEventResponseDto[]> =>
        (await this.eventsRepository.events(id, skip, take)).map((event) => ({
          id: event.id,
          action: event.action,
          priorState: event.priorState,
          resultingState: event.resultingState,
          responsibilityLevel: event.responsibilityLevel,
          note: event.note,
          occurredAt: event.occurredAt,
          performedBy: event.performedByActor,
        })),
      () => this.eventsRepository.count(id),
    );
  }
  async availableActions(
    id: string,
    actor: SessionActor,
  ): Promise<WorkRequestAvailableActionResponseDto[]> {
    const record = await this.reads.find(id, actor);
    if (!record) throw notFound();
    return this.actions.available(
      actor,
      record.events[0]?.resultingState ?? null,
      record,
    );
  }
  async documents(id: string, actor: SessionActor) {
    const external = isExternalClientActor(actor);
    const record = external
      ? await this.reads.findForClient(id, actor.clientContact?.clientId ?? '')
      : await this.reads.find(id, actor);
    if (!record) throw notFound();
    assertWorkRequestExternalClientAccess(
      actor,
      record.bid ?? record.directProject,
    );
    return external ? this.history.externalList(id) : this.history.list(id);
  }
  async documentVersions(id: string, documentId: string, actor: SessionActor) {
    const external = isExternalClientActor(actor);
    const record = external
      ? await this.reads.findForClient(id, actor.clientContact?.clientId ?? '')
      : await this.reads.find(id, actor);
    if (!record) throw notFound();
    assertWorkRequestExternalClientAccess(
      actor,
      record.bid ?? record.directProject,
    );
    return external
      ? this.history.externalVersions(id, documentId)
      : this.history.versions(id, documentId);
  }
}
function isExternalClientActor(actor: SessionActor) {
  return (
    actor.role.customScope === 'client' ||
    actor.role.customScope === 'client_contact'
  );
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
    owner: { kind: 'WORK_REQUEST', id: parentId },
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
export function allowsWorkRequestDocumentVersion(
  state: WorkRequestV1StateCode | null | undefined,
) {
  return state === WorkRequestV1StateCode.MEMBER_ASSIGNED;
}
function mapReferenceError(error: unknown): Error {
  if (!(error instanceof Error)) return error as Error;
  if (error.message === 'WR_PARENT_XOR')
    return bad('Supply exactly one Bid or Project.');
  if (error.message === 'WR_PARENT') return notFound('Parent was not found.');
  if (error.message === 'WR_PARENT_INACTIVE')
    return conflict('Parent is not eligible for a Work Request.');
  if (error.message === 'WR_BID_CYCLE')
    return conflict('Bid has no active business cycle.');
  if (error.message === 'WR_DOCUMENT_CODE')
    return notFound('A Document Code was not found or inactive.');
  return error;
}
