import { randomUUID } from 'node:crypto';
import { HttpStatus, Inject } from '@nestjs/common';
import { AppErrorCode } from '../../common/exceptions/app-error-code';
import { AppException } from '../../common/exceptions/app-exception';
import { RequestContext } from '../../common/context/request-context';
import { BidCreated, BidUpdated } from '../../contracts/events/bid-events';
import { PaginationQueryDto } from '../../common/pagination/dtos/pagination-query.dto';
import { paginate } from '../../common/pagination/paginate';
import { PaginatedResult } from '../../common/pagination/paginated-result';
import {
  FILE_STORAGE,
  type FileStorage,
} from '../../contracts/storage/file-storage.port';
import {
  CreateBidDto,
  ReclassifyBidDocumentDto,
  BidResponseDto,
  UpdateBidDto,
} from '../dtos/bid.dto';
import { BidRecord, BidRepository } from '../repositories/bid.repository';
import { BidStorageCleanupRepository } from '../repositories/bid-storage-cleanup.repository';
import { OutboxService } from '../../infra/messaging/outbox.service';
import { UnitOfWorkService } from '../../infra/prisma/unit-of-work.service';
import { formatBidDocumentFileName } from '../../common/utils/bid-document-file-name';
import { deriveProjectCode } from '../../common/documents/document-naming';
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

export interface BidUploadedFile {
  fieldname: string;
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

export abstract class BidServiceBase {
  protected constructor(
    private readonly bids: BidRepository,
    private readonly unitOfWork: UnitOfWorkService,
    private readonly outbox: OutboxService,
    private readonly cleanup: BidStorageCleanupRepository,
    @Inject(FILE_STORAGE) private readonly storage: FileStorage,
    private readonly receipts?: DocumentUploadRequestRepository,
  ) {}

  async createStandaloneDocuments(
    bidId: string,
    uploads: BidUploadedFile[],
    documentCodeIds: string[],
    actor: SessionActor,
  ): Promise<DocumentSummaryDto[]> {
    let context: Awaited<
      ReturnType<BidRepository['prepareStandaloneDocuments']>
    >;
    try {
      context = await this.bids.prepareStandaloneDocuments(
        bidId,
        documentCodeIds,
      );
    } catch (error) {
      throw mapReferenceError(error);
    }
    if (!context) throw notFound();
    const requestId = RequestContext.requestId()!;
    const replay =
      this.receipts &&
      (await this.receipts.find({
        owner: DocumentUploadOwnerCode.BID,
        parentId: bidId,
        targetId: bidId,
        operation: DocumentUploadOperationCode.NEW_DOCUMENT,
        requestId,
      }));
    if (replay) return replay.response as unknown as DocumentSummaryDto[];
    const drafts = DocumentUploadPipeline.prepare({
      uploads,
      documentCodeIds,
      codes: context.codes,
      revisionCode: 'A',
      storagePrefix: `tenants/${RequestContext.requireTenantId()}/bids/${bidId}/documents`,
      generatedFileName: (code, uploadedFileName) =>
        bidFileName({
          biddingNumber: context.bid.biddingNumber,
          projectCode: context.bid.projectCode,
          cargoCode: context.bid.cargoCodeSnapshot,
          vesselCode: context.bid.vesselCodeSnapshot,
          shipmentNumber: context.bid.shipmentNumber,
          documentCode: code.code,
          documentName: code.name,
          uploadedFileName,
        }),
    });
    let stored: string[] = [];
    try {
      stored = await DocumentUploadPipeline.putAll(this.storage, drafts);
      const created = await this.unitOfWork.execute(async () => {
        const result = await this.bids.createStandaloneDocuments(
          bidId,
          actor.id,
          drafts,
        );
        if (result && this.receipts)
          await this.receipts.write({
            owner: DocumentUploadOwnerCode.BID,
            parentId: bidId,
            targetId: bidId,
            operation: DocumentUploadOperationCode.NEW_DOCUMENT,
            requestId,
            actorId: actor.id,
            response: result.map((document) =>
              documentSummary('BID', bidId, document),
            ) as never,
            audit: {
              entityId: bidId,
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
      return created.map((document) => documentSummary('BID', bidId, document));
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
    bidId: string,
    documentId: string,
    upload: BidUploadedFile,
    actor: SessionActor,
  ): Promise<DocumentVersionResponseDto> {
    const context = await this.bids.prepareDocumentVersion(bidId, documentId);
    if (!context) throw notFound('Bid document was not found.');
    const requestId = RequestContext.requestId()!;
    const replay =
      this.receipts &&
      (await this.receipts.find({
        owner: DocumentUploadOwnerCode.BID,
        parentId: bidId,
        targetId: documentId,
        operation: DocumentUploadOperationCode.NEW_VERSION,
        requestId,
      }));
    if (replay) return replay.response as unknown as DocumentVersionResponseDto;
    const file = DocumentUploadPipeline.prepareVersion({
      upload,
      revisionCode: context.revisionCode,
      storagePrefix: `tenants/${RequestContext.requireTenantId()}/bids/${bidId}/documents/${documentId}/versions`,
      generatedFileName: (uploadedFileName) =>
        bidFileName({
          biddingNumber: context.bid.biddingNumber,
          projectCode: context.bid.projectCode,
          cargoCode: context.bid.cargoCodeSnapshot,
          vesselCode: context.bid.vesselCodeSnapshot,
          shipmentNumber: context.bid.shipmentNumber,
          documentCode: context.documentCodeSnapshot,
          documentName:
            context.documentNameSnapshot ?? context.documentCodeSnapshot,
          uploadedFileName,
        }),
    });
    let stored: string[] = [];
    try {
      stored = await DocumentUploadPipeline.putAll(this.storage, [file]);
      const version = await this.unitOfWork.execute(
        async () => {
          const result = await this.bids.appendDocumentVersion(
            bidId,
            documentId,
            actor.id,
            file,
          );
          if (result && this.receipts)
            await this.receipts.write({
              owner: DocumentUploadOwnerCode.BID,
              parentId: bidId,
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
                  bidId,
                  documentId,
                  versionId: result.id,
                },
              },
            });
          return result;
        },
        { isolationLevel: 'Serializable' },
      );
      if (!version) throw notFound('Bid document was not found.');
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
    input: CreateBidDto,
    uploads: BidUploadedFile[],
    actorId: string,
  ): Promise<BidResponseDto> {
    const documents = input.documents ?? [];
    const bidId = randomUUID();
    const shipmentNumber = normalizeShipment(input.bidInfo.shipmentNumber);
    const reference = await this.resolveReferences(input, documents);
    const projectCode = bidProjectCode(
      input.name,
      reference.polName,
      reference.podName,
    );
    const drafts = DocumentUploadPipeline.prepare({
      uploads,
      documentCodeIds: documents.map(({ documentCodeId }) => documentCodeId),
      codes: reference.documentCodes,
      allowEmpty: true,
      revisionCode: 'A',
      storagePrefix: `tenants/${RequestContext.requireTenantId()}/bids/${bidId}/documents`,
      generatedFileName: (code, uploadedFileName) =>
        bidFileName({
          biddingNumber: input.bidInfo.biddingNumber,
          projectCode,
          cargoCode: reference.cargoCode,
          vesselCode: reference.vesselCode,
          shipmentNumber,
          documentCode: code.code,
          documentName: code.name,
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
      const created = await this.unitOfWork.execute(async () => {
        const bid = await this.bids.create({
          id: bidId,
          clientId: reference.clientId,
          name: input.name,
          normalizedName: normalizeName(input.name),
          projectCode,
          biddingNumber: input.bidInfo.biddingNumber,
          shipmentNumber,
          polId: input.bidInfo.polId,
          podId: input.bidInfo.podId,
          cargoId: input.bidInfo.cargoId,
          vesselId: input.bidInfo.vesselId,
          actorId,
          files,
          snapshots: reference,
        });
        await this.outbox.enqueue(
          new BidCreated(
            { tenantId: RequestContext.requireTenantId(), actorId },
            { bidId },
          ),
        );
        return bid;
      });
      return response(created);
    } catch (error) {
      await DocumentUploadPipeline.compensate(
        this.storage,
        stored,
        (key, cause) => this.cleanup.enqueue(key, cause),
      );
      throw mapReferenceError(error);
    }
  }

  async findAll(
    query: PaginationQueryDto,
    actor: SessionActor,
  ): Promise<PaginatedResult<BidResponseDto>> {
    return paginate(
      query,
      async (args) => (await this.bids.list(args, actor)).map(response),
      () => this.bids.count(actor),
    );
  }

  async findOne(id: string, actor: SessionActor): Promise<BidResponseDto> {
    const bid = await this.bids.find(id, actor);
    if (!bid) throw notFound();
    return response(bid);
  }

  async documents(
    id: string,
    actor: SessionActor,
  ): Promise<DocumentSummaryDto[]> {
    assertPermission(actor, PermissionCode.VIEW_BID);
    const bid = await this.bids.find(id, actor);
    if (!bid) throw notFound();
    return (await this.bids.documents(id)).map((document) =>
      documentSummary('BID', id, document),
    );
  }

  async documentVersions(
    id: string,
    documentId: string,
    actor: SessionActor,
  ): Promise<DocumentVersionResponseDto[]> {
    assertPermission(actor, PermissionCode.VIEW_BID);
    const bid = await this.bids.find(id, actor);
    if (!bid) throw notFound();
    const versions = await this.bids.documentVersions(id, documentId);
    if (!versions) throw notFound('Bid document was not found.');
    return versions.map((version) => versionResponse(documentId, version));
  }

  async update(id: string, input: UpdateBidDto): Promise<BidResponseDto> {
    if (!input.name) throw badRequest('Supply a Bid name to update.');
    const name = input.name;
    const current = await this.bids.find(id);
    if (!current) throw notFound();
    const renamed = await this.unitOfWork.execute(async () => {
      const bid = await this.bids.rename({
        id,
        name,
        normalizedName: normalizeName(name),
        projectCode: bidProjectCode(
          name,
          current.polNameSnapshot,
          current.podNameSnapshot,
        ),
      });
      if (bid)
        await this.outbox.enqueue(
          new BidUpdated(
            { tenantId: RequestContext.requireTenantId() },
            { bidId: id },
          ),
        );
      return bid;
    });
    if (!renamed) throw notFound();
    return response(renamed);
  }

  async reclassifyDocument(
    bidId: string,
    documentId: string,
    input: ReclassifyBidDocumentDto,
    actorId: string,
  ) {
    const context = await this.bids.reclassifyDocument({
      bidId,
      documentId,
      documentCodeId: input.documentCodeId,
      actorId,
    });
    if (!context) throw notFound('Bid document was not found.');
    const generatedFileName = context.previousGeneratedFileName;
    await this.unitOfWork.execute(async () => {
      await this.bids.applyReclassification({
        bidId,
        documentId,
        documentCodeId: input.documentCodeId,
        documentCode: context.documentCode,
        generatedFileName,
        actorId,
        previousDocumentCodeId: context.previousDocumentCodeId,
        previousDocumentCode: context.previousDocumentCode,
        previousGeneratedFileName: context.previousGeneratedFileName,
      });
      await this.outbox.enqueue(
        new BidUpdated(
          { tenantId: RequestContext.requireTenantId(), actorId },
          { bidId },
        ),
      );
    });
    return {
      id: documentId,
      originalFileName: context.originalFileName,
      storageKey: context.storageKey,
      generatedFileName,
      documentCodeId: input.documentCodeId,
    };
  }

  private async resolveReferences(
    input: CreateBidDto,
    documents: { documentCodeId: string }[],
  ) {
    try {
      return await this.bids.prepareCreate({
        clientId: input.clientId,
        polId: input.bidInfo.polId,
        podId: input.bidInfo.podId,
        cargoId: input.bidInfo.cargoId,
        vesselId: input.bidInfo.vesselId,
        documentCodeIds: documents.map(({ documentCodeId }) => documentCodeId),
      });
    } catch (error) {
      throw mapReferenceError(error);
    }
  }
}
function documentSummary(
  kind: 'BID',
  parentId: string,
  document: {
    id: string;
    documentCodeId: string;
    documentCodeSnapshot: string;
    documentNameSnapshot: string | null;
    originalFileName: string;
    versions: Array<{
      id: string;
      versionNumber: number;
      revisionCode: string;
      uploadedFileName: string | null;
      generatedFileName: string;
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
    owner: { kind, id: parentId },
    documentCode: {
      id: document.documentCodeId,
      code: document.documentCodeSnapshot,
      name: document.documentNameSnapshot ?? '',
    },
    originalFileName: document.originalFileName,
    latestVersion: {
      versionId: version.id,
      versionNumber: version.versionNumber,
      revisionCode: version.revisionCode,
      uploadedFileName: version.uploadedFileName ?? document.originalFileName,
      generatedFileName: version.generatedFileName,
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
    generatedFileName: string;
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
    generatedFileName: version.generatedFileName,
    mimeType: version.mimeType,
    size: Number(version.fileSizeBytes),
    uploadedBy: version.uploadedByActor,
    uploadedAt: version.uploadedAt,
  };
}

function response(bid: BidRecord): BidResponseDto {
  return {
    id: bid.id,
    name: bid.name,
    projectCode: bid.projectCode,
    biddingNumber: bid.biddingNumber,
    shipmentNumber: bid.shipmentNumber,
    clientId: bid.clientId,
    client: bid.client,
    status: bid.statusEvents[0]?.toStatus.code ?? 'BIDDING',
    fileCount: bid._count.documents,
    documents: bid.documents.map((document) => ({
      id: document.id,
      documentCodeId: document.documentCodeId,
      originalFileName: document.originalFileName,
      generatedFileName: document.generatedFileName,
      mimeType: document.mimeType,
      size: Number(document.fileSizeBytes),
    })),
    createdAt: bid.createdAt,
    updatedAt: bid.updatedAt,
  };
}

export function bidProjectCode(name: string, pol: string, pod: string): string {
  try {
    return deriveProjectCode(name, pol, pod);
  } catch {
    throw badRequest('Bid naming values are invalid.');
  }
}

export function bidFileName(input: {
  biddingNumber: string;
  projectCode: string;
  cargoCode: string;
  vesselCode: string;
  shipmentNumber: string;
  documentCode: string;
  documentName: string;
  uploadedFileName: string;
}): string {
  const result = formatBidDocumentFileName({ ...input, revisionCode: 'A' });
  if (result.length > 260) throw badRequest('Generated filename is too long.');
  return result;
}

export function normalizeShipment(value: string): string {
  if (!/^\d{1,2}$/.test(value))
    throw badRequest('Shipment number must contain one or two digits.');
  return value.padStart(2, '0');
}

function normalizeName(value: string): string {
  return value.trim().toLowerCase();
}

function mapReferenceError(error: unknown): Error {
  if (error instanceof Error && error.message === 'BID_REFERENCE_CLIENT')
    return notFound('Client was not found or is inactive.');
  if (error instanceof Error && error.message === 'BID_REFERENCE_OPTION')
    return notFound('A Bid reference option was not found or is inactive.');
  if (error instanceof Error && error.message === 'BID_REFERENCE_DOCUMENT_CODE')
    return notFound('A Document Code was not found or is inactive.');
  if (error instanceof Error) return error;
  return new AppException({
    code: AppErrorCode.InternalError,
    status: HttpStatus.INTERNAL_SERVER_ERROR,
    message: 'Unable to create Bid.',
  });
}

function badRequest(message: string): AppException {
  return new AppException({
    code: AppErrorCode.BadRequest,
    status: HttpStatus.BAD_REQUEST,
    message,
  });
}
function assertPermission(
  actor: SessionActor,
  permission: PermissionCode,
): void {
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
function notFound(message = 'Bid was not found.'): AppException {
  return new AppException({
    code: AppErrorCode.NotFound,
    status: HttpStatus.NOT_FOUND,
    message,
  });
}
