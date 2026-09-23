import { basename, extname } from 'node:path';
import { randomUUID } from 'node:crypto';
import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { AppErrorCode } from '../common/exceptions/app-error-code';
import { AppException } from '../common/exceptions/app-exception';
import { RequestContext } from '../common/context/request-context';
import { BidCreated, BidUpdated } from '../contracts/events/bid-events';
import { PaginationQueryDto } from '../common/pagination/dtos/pagination-query.dto';
import { paginate } from '../common/pagination/paginate';
import { PaginatedResult } from '../common/pagination/paginated-result';
import {
  FILE_STORAGE,
  type FileStorage,
} from '../contracts/storage/file-storage.port';
import {
  CreateBidDto,
  ReclassifyBidDocumentDto,
  BidResponseDto,
  UpdateBidDto,
} from './dtos/bid.dto';
import { BidRecord, BidRepository } from './repositories/bid.repository';
import { BidStorageCleanupRepository } from './repositories/bid-storage-cleanup.repository';
import { OutboxService } from '../infra/messaging/outbox.service';
import { UnitOfWorkService } from '../infra/prisma/unit-of-work.service';

export interface BidUploadedFile {
  fieldname: string;
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

@Injectable()
export class BidService {
  constructor(
    private readonly bids: BidRepository,
    private readonly unitOfWork: UnitOfWorkService,
    private readonly outbox: OutboxService,
    private readonly cleanup: BidStorageCleanupRepository,
    @Inject(FILE_STORAGE) private readonly storage: FileStorage,
  ) {}

  async create(
    input: CreateBidDto,
    uploads: BidUploadedFile[],
    actorId: string,
  ): Promise<BidResponseDto> {
    const documents = input.documents ?? [];
    this.assertUploadDocuments(uploads, documents);
    uploads.forEach(assertAllowedUpload);
    const bidId = randomUUID();
    const shipmentNumber = normalizeShipment(input.bidInfo.shipmentNumber);
    const reference = await this.resolveReferences(input, documents);
    const projectCode = bidProjectCode(
      input.name,
      reference.polName,
      reference.podName,
    );
    const files = uploads.map((file, index) => {
      const documentCodeId = documents[index].documentCodeId;
      const documentCode = reference.documentCodes.get(documentCodeId);
      if (!documentCode)
        throw badRequest('Uploaded file has an invalid Document Code.');
      const originalFileName = safeOriginalName(file.originalname);
      const generatedFileName = bidFileName({
        biddingNumber: input.bidInfo.biddingNumber,
        projectCode,
        cargoCode: reference.cargoCode,
        vesselCode: reference.vesselCode,
        shipmentNumber,
        documentCode,
        originalFileName,
      });
      return {
        id: randomUUID(),
        documentCodeId,
        documentCodeSnapshot: documentCode,
        originalFileName,
        generatedFileName,
        storageKey: `tenants/${RequestContext.requireTenantId()}/bids/${bidId}/documents/${randomUUID()}${extname(originalFileName).toLowerCase()}`,
        mimeType: file.mimetype,
        fileSizeBytes: BigInt(file.size),
        content: file.buffer,
      };
    });
    if (
      new Set(files.map((file) => file.generatedFileName)).size !== files.length
    )
      throw conflict('Two uploaded files produce the same generated filename.');

    const stored: string[] = [];
    try {
      for (const file of files) {
        await this.storage.put({
          storageKey: file.storageKey,
          content: file.content,
        });
        stored.push(file.storageKey);
      }
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
      await this.compensate(stored);
      throw mapReferenceError(error);
    }
  }

  private async compensate(storageKeys: string[]): Promise<void> {
    for (const storageKey of storageKeys) {
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

  async findAll(
    query: PaginationQueryDto,
  ): Promise<PaginatedResult<BidResponseDto>> {
    return paginate(
      query,
      async (args) => (await this.bids.list(args)).map(response),
      () => this.bids.count(),
    );
  }

  async findOne(id: string): Promise<BidResponseDto> {
    const bid = await this.bids.find(id);
    if (!bid) throw notFound();
    return response(bid);
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
    const generatedFileName = bidFileName({
      biddingNumber: context.biddingNumber,
      projectCode: context.projectCode,
      cargoCode: context.cargoCodeSnapshot,
      vesselCode: context.vesselCodeSnapshot,
      shipmentNumber: context.shipmentNumber,
      documentCode: context.documentCode,
      originalFileName: context.originalFileName,
    }).replace(/-A /, `-${context.revisionCode} `);
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

  private assertUploadDocuments(
    uploads: BidUploadedFile[],
    documents: { fileIndex: number; documentCodeId: string }[],
  ): void {
    if (
      uploads.length !== documents.length ||
      new Set(documents.map((item) => item.fileIndex)).size !==
        documents.length ||
      !documents.every((item, index) => item.fileIndex === index)
    )
      throw badRequest(
        'documents must map one-for-one to files by contiguous fileIndex.',
      );
  }
}

const BID_UPLOAD_TYPES: Readonly<Record<string, readonly string[]>> = {
  '.pdf': ['application/pdf'],
  '.doc': ['application/msword'],
  '.docx': [
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  ],
  '.xls': ['application/vnd.ms-excel'],
  '.xlsx': [
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ],
  '.ppt': ['application/vnd.ms-powerpoint'],
  '.pptx': [
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  ],
  '.csv': ['text/csv', 'application/csv'],
  '.txt': ['text/plain'],
  '.dwg': ['application/acad', 'application/x-acad', 'image/vnd.dwg'],
  '.dxf': ['application/dxf', 'image/vnd.dxf'],
  '.jpg': ['image/jpeg'],
  '.jpeg': ['image/jpeg'],
  '.png': ['image/png'],
  '.zip': ['application/zip', 'application/x-zip-compressed'],
};

function assertAllowedUpload(file: BidUploadedFile): void {
  const extension = extname(safeOriginalName(file.originalname)).toLowerCase();
  if (!BID_UPLOAD_TYPES[extension]?.includes(file.mimetype.toLowerCase()))
    throw badRequest(
      'Uploaded file type does not match the approved allowlist.',
    );
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
      storageKey: document.storageKey,
      mimeType: document.mimeType,
      size: Number(document.fileSizeBytes),
    })),
    createdAt: bid.createdAt,
    updatedAt: bid.updatedAt,
  };
}

export function bidProjectCode(name: string, pol: string, pod: string): string {
  const values = [name, pol, pod].map((value) => Array.from(value.trim())[0]);
  if (values.some((value) => !value))
    throw badRequest('Bid naming values are invalid.');
  return values.join('').toUpperCase();
}

export function bidFileName(input: {
  biddingNumber: string;
  projectCode: string;
  cargoCode: string;
  vesselCode: string;
  shipmentNumber: string;
  documentCode: string;
  originalFileName: string;
}): string {
  const extension = extname(input.originalFileName);
  const base = input.originalFileName.slice(
    0,
    input.originalFileName.length - extension.length,
  );
  const result = `${input.biddingNumber} ${input.projectCode}-${input.cargoCode}-${input.vesselCode}-${input.shipmentNumber}-${input.documentCode}-A ${base}${extension}`;
  if (result.length > 260) throw badRequest('Generated filename is too long.');
  return result;
}

export function normalizeShipment(value: string): string {
  if (!/^\d{1,2}$/.test(value))
    throw badRequest('Shipment number must contain one or two digits.');
  return value.padStart(2, '0');
}

function safeOriginalName(value: string): string {
  const name = basename(value).trim();
  if (!name || name.length > 260)
    throw badRequest('Uploaded filename is invalid.');
  return name;
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
function conflict(message: string): AppException {
  return new AppException({
    code: AppErrorCode.Conflict,
    status: HttpStatus.CONFLICT,
    message,
  });
}
function notFound(message = 'Bid was not found.'): AppException {
  return new AppException({
    code: AppErrorCode.NotFound,
    status: HttpStatus.NOT_FOUND,
    message,
  });
}
