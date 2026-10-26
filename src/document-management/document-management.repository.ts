import { Injectable } from '@nestjs/common';
import { RequestContext } from '../common/context/request-context';
import type { SessionActor } from '../common/security/session.types';
import {
  relatedWorkRequestVisibilityWhere,
  workRequestVisibilityWhere,
} from '../common/security/work-request-visibility';
import { BaseRepository } from '../infra/prisma/base.repository';
import { UnitOfWorkService } from '../infra/prisma/unit-of-work.service';

type Owner = 'BID' | 'PROJECT' | 'WORK_REQUEST';

type VersionRow = {
  id: string;
  storageKey: string;
  originalFileName: string;
  generatedFileName: string | null;
  uploadedFileName: string | null;
  mimeType: string;
  fileSizeBytes: bigint;
  versionNumber: number;
  revisionCode: string;
  uploadedAt: Date;
  uploadedByActorId: string;
  uploadedByActor?: { label: string };
};

export type ExactDocumentVersion = VersionRow & {
  owner: Owner;
  parentId: string;
  documentId: string;
  documentCode: string | null;
  documentCodeId: string | null;
  workRequestId: string | null;
  sourceKind: 'BID' | 'PROJECT' | null;
  sourceId: string | null;
  sourceLabel?: string;
  documentName?: string | null;
  documentCodeSortOrder?: number;
  uploadedByLabel?: string;
};

/**
 * The single Documents 10.2 read boundary. Every internal query starts with
 * tenant and parent visibility; external reads use immutable C1 item membership.
 */
@Injectable()
export class DocumentManagementRepository extends BaseRepository {
  constructor(uow: UnitOfWorkService) {
    super(uow);
  }

  async exact(
    versionId: string,
    actor: SessionActor,
  ): Promise<ExactDocumentVersion | null> {
    const tenantId = RequestContext.requireTenantId();
    return this.transaction(async (db) => {
      if (actor.clientContact) {
        const contact = actor.clientContact;
        if (!contact.isActive || !contact.client.isActive) return null;
        const packaged = await db.workRequestV1ClientSubmissionItem.findFirst({
          where: {
            tenantId,
            // Membership is exact: a sibling version is never implicitly visible.
            documentVersionId: versionId,
            submission: {
              workRequest: {
                OR: [
                  { bid: { is: { clientId: contact.clientId } } },
                  { directProject: { is: { clientId: contact.clientId } } },
                ],
              },
            },
          },
          include: {
            documentVersion: {
              include: {
                document: {
                  include: {
                    documentCode: true,
                    workRequest: {
                      include: {
                        bid: { include: { client: true } },
                        directProject: { include: { client: true } },
                      },
                    },
                  },
                },
                uploadedByActor: { select: { label: true } },
              },
            },
          },
        });
        return packaged
          ? map(
              'WORK_REQUEST',
              packaged.documentVersion.document.workRequestId,
              packaged.documentVersion.workRequestV1DocumentId,
              packaged.documentVersion,
              {
                documentCode:
                  packaged.documentVersion.document.documentCodeSnapshot,
                documentCodeId:
                  packaged.documentVersion.document.documentCodeId,
                workRequestId: packaged.documentVersion.document.workRequestId,
                sourceKind: packaged.documentVersion.document.workRequest.bidId
                  ? 'BID'
                  : 'PROJECT',
                sourceId:
                  packaged.documentVersion.document.workRequest.bidId ??
                  packaged.documentVersion.document.workRequest.directProjectId,
                sourceLabel: packaged.documentVersion.document.workRequest.bid
                  ? bidLabel(packaged.documentVersion.document.workRequest.bid)
                  : packaged.documentVersion.document.workRequest.directProject
                    ? projectLabel(
                        packaged.documentVersion.document.workRequest
                          .directProject,
                      )
                    : undefined,
                documentName:
                  packaged.documentVersion.document.documentNameSnapshot,
                documentCodeSortOrder:
                  packaged.documentVersion.document.documentCode?.sortOrder,
              },
            )
          : null;
      }

      const related = relatedWorkRequestVisibilityWhere(actor);
      const bid = await db.bidDocumentVersion.findFirst({
        where: {
          id: versionId,
          tenantId,
          bidDocument: {
            bid: {
              is: {
                ...(related ? { workRequestsV1: { some: related } } : {}),
              },
            },
          },
        },
        include: {
          bidDocument: {
            include: {
              bid: { include: { client: true } },
              documentCode: true,
            },
          },
          uploadedByActor: { select: { label: true } },
        },
      });
      if (bid)
        return map('BID', bid.bidDocument.bidId, bid.bidDocumentId, bid, {
          documentCode: bid.bidDocument.documentCodeSnapshot,
          documentCodeId: bid.bidDocument.documentCodeId,
          workRequestId: null,
          sourceKind: 'BID',
          sourceId: bid.bidDocument.bidId,
          sourceLabel: bidLabel(bid.bidDocument.bid),
          documentName: bid.bidDocument.documentNameSnapshot,
          documentCodeSortOrder: bid.bidDocument.documentCode?.sortOrder,
        });

      const project = await db.directProjectDocumentVersion.findFirst({
        where: {
          id: versionId,
          tenantId,
          directProjectDocument: {
            directProject: {
              is: {
                ...(related ? { workRequestsV1: { some: related } } : {}),
              },
            },
          },
        },
        include: {
          directProjectDocument: {
            include: {
              directProject: { include: { client: true } },
              documentCode: true,
            },
          },
          uploadedByActor: { select: { label: true } },
        },
      });
      if (project)
        return map(
          'PROJECT',
          project.directProjectDocument.directProjectId,
          project.directProjectDocumentId,
          project,
          {
            documentCode: project.directProjectDocument.documentCodeSnapshot,
            documentCodeId: project.directProjectDocument.documentCodeId,
            workRequestId: null,
            sourceKind: 'PROJECT',
            sourceId: project.directProjectDocument.directProjectId,
            sourceLabel: projectLabel(
              project.directProjectDocument.directProject,
            ),
            documentName: project.directProjectDocument.documentNameSnapshot,
            documentCodeSortOrder:
              project.directProjectDocument.documentCode?.sortOrder,
          },
        );

      const work = await db.workRequestV1DocumentVersion.findFirst({
        where: {
          id: versionId,
          tenantId,
          document: {
            workRequest: { is: workRequestVisibilityWhere(actor) },
          },
        },
        include: {
          document: {
            include: {
              workRequest: {
                include: {
                  bid: { include: { client: true } },
                  directProject: { include: { client: true } },
                },
              },
              documentCode: true,
            },
          },
          uploadedByActor: { select: { label: true } },
        },
      });
      return work
        ? map(
            'WORK_REQUEST',
            work.document.workRequestId,
            work.workRequestV1DocumentId,
            work,
            {
              documentCode: work.document.documentCodeSnapshot,
              documentCodeId: work.document.documentCodeId,
              workRequestId: work.document.workRequestId,
              sourceKind: work.document.workRequest.bidId ? 'BID' : 'PROJECT',
              sourceId:
                work.document.workRequest.bidId ??
                work.document.workRequest.directProjectId,
              sourceLabel: work.document.workRequest.bid
                ? bidLabel(work.document.workRequest.bid)
                : work.document.workRequest.directProject
                  ? projectLabel(work.document.workRequest.directProject)
                  : undefined,
              documentName: work.document.documentNameSnapshot,
              documentCodeSortOrder: undefined,
            },
          )
        : null;
    });
  }

  async search(
    query: string | undefined,
    actor: SessionActor,
  ): Promise<ExactDocumentVersion[]> {
    // C1 users receive exact immutable package items through exact() only.
    if (actor.clientContact) return [];

    const tenantId = RequestContext.requireTenantId();
    return this.transaction(async (db) => {
      const related = relatedWorkRequestVisibilityWhere(actor);
      const [bids, projects, work] = await Promise.all([
        db.bidDocumentVersion.findMany({
          where: {
            tenantId,
            bidDocument: {
              bid: {
                is: {
                  ...(related ? { workRequestsV1: { some: related } } : {}),
                },
              },
            },
          },
          include: {
            bidDocument: {
              include: {
                bid: { include: { client: true } },
                documentCode: true,
              },
            },
            uploadedByActor: { select: { label: true } },
          },
        }),
        db.directProjectDocumentVersion.findMany({
          where: {
            tenantId,
            directProjectDocument: {
              directProject: {
                is: {
                  ...(related ? { workRequestsV1: { some: related } } : {}),
                },
              },
            },
          },
          include: {
            directProjectDocument: {
              include: {
                directProject: { include: { client: true } },
                documentCode: true,
              },
            },
            uploadedByActor: { select: { label: true } },
          },
        }),
        db.workRequestV1DocumentVersion.findMany({
          where: {
            tenantId,
            document: {
              workRequest: { is: workRequestVisibilityWhere(actor) },
            },
          },
          include: {
            document: {
              include: {
                workRequest: {
                  include: {
                    bid: { include: { client: true } },
                    directProject: { include: { client: true } },
                  },
                },
                documentCode: true,
              },
            },
            uploadedByActor: { select: { label: true } },
          },
        }),
      ]);
      return [
        ...bids.map((value) =>
          map('BID', value.bidDocument.bidId, value.bidDocumentId, value, {
            documentCode: value.bidDocument.documentCodeSnapshot,
            documentCodeId: value.bidDocument.documentCodeId,
            workRequestId: null,
            sourceKind: 'BID',
            sourceId: value.bidDocument.bidId,
            sourceLabel: bidLabel(value.bidDocument.bid),
            documentName: value.bidDocument.documentNameSnapshot,
            documentCodeSortOrder: value.bidDocument.documentCode?.sortOrder,
          }),
        ),
        ...projects.map((value) =>
          map(
            'PROJECT',
            value.directProjectDocument.directProjectId,
            value.directProjectDocumentId,
            value,
            {
              documentCode: value.directProjectDocument.documentCodeSnapshot,
              documentCodeId: value.directProjectDocument.documentCodeId,
              workRequestId: null,
              sourceKind: 'PROJECT',
              sourceId: value.directProjectDocument.directProjectId,
              sourceLabel: projectLabel(
                value.directProjectDocument.directProject,
              ),
              documentName: value.directProjectDocument.documentNameSnapshot,
              documentCodeSortOrder:
                value.directProjectDocument.documentCode?.sortOrder,
            },
          ),
        ),
        ...work.map((value) =>
          map(
            'WORK_REQUEST',
            value.document.workRequestId,
            value.workRequestV1DocumentId,
            value,
            {
              documentCode: value.document.documentCodeSnapshot,
              documentCodeId: value.document.documentCodeId,
              workRequestId: value.document.workRequestId,
              sourceKind: value.document.workRequest.bidId ? 'BID' : 'PROJECT',
              sourceId:
                value.document.workRequest.bidId ??
                value.document.workRequest.directProjectId,
              sourceLabel: value.document.workRequest.bid
                ? bidLabel(value.document.workRequest.bid)
                : value.document.workRequest.directProject
                  ? projectLabel(value.document.workRequest.directProject)
                  : undefined,
              documentName: value.document.documentNameSnapshot,
              documentCodeSortOrder: value.document.documentCode?.sortOrder,
            },
          ),
        ),
      ].sort(
        (left, right) =>
          right.uploadedAt.getTime() - left.uploadedAt.getTime() ||
          right.id.localeCompare(left.id),
      );
    });
  }

  async timezone(): Promise<string> {
    const tenantId = RequestContext.requireTenantId();
    return this.transaction(async (db) => {
      const config = await db.portalConfig.findFirst({
        where: { tenantId },
        select: { defaultTimezone: true },
      });
      return config?.defaultTimezone ?? 'UTC';
    });
  }
}

function bidLabel(bid: {
  biddingNumber: string;
  name: string;
  client: { name: string };
}): string {
  return `${bid.biddingNumber} - ${bid.client.name} - ${bid.name}`;
}
function projectLabel(project: {
  projectCode: string | null;
  name: string;
  client: { name: string };
}): string {
  return `${project.projectCode ?? ''} - ${project.client.name} - ${project.name}`;
}

function map(
  owner: Owner,
  parentId: string,
  documentId: string,
  value: VersionRow,
  metadata: Pick<
    ExactDocumentVersion,
    | 'documentCode'
    | 'documentCodeId'
    | 'workRequestId'
    | 'sourceKind'
    | 'sourceId'
    | 'sourceLabel'
    | 'documentName'
    | 'documentCodeSortOrder'
  > = {
    documentCode: null,
    documentCodeId: null,
    workRequestId: null,
    sourceKind: null,
    sourceId: null,
  },
): ExactDocumentVersion {
  return {
    owner,
    parentId,
    documentId,
    ...metadata,
    ...value,
    uploadedByLabel: value.uploadedByActor?.label,
  };
}
