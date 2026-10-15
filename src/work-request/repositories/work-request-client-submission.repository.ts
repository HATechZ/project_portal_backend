import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import {
  WorkRequestV1AssignmentLevelCode,
  WorkRequestV1StateCode,
} from '../../generated/prisma/client';
import { RequestContext } from '../../common/context/request-context';
import { BaseRepository } from '../../infra/prisma/base.repository';
import { UnitOfWorkService } from '../../infra/prisma/unit-of-work.service';

@Injectable()
export class WorkRequestClientSubmissionRepository extends BaseRepository {
  constructor(uow: UnitOfWorkService) {
    super(uow);
  }

  prepare(workRequestId: string) {
    const tenantId = RequestContext.requireTenantId();
    return this.transaction((db) =>
      db.workRequestV1.findFirst({
        where: { id: workRequestId, tenantId },
        select: {
          bid: {
            select: { clientId: true, client: { select: { companyId: true } } },
          },
          directProject: {
            select: { clientId: true, client: { select: { companyId: true } } },
          },
          events: {
            take: 1,
            orderBy: [{ occurredAt: 'desc' }, { id: 'desc' }],
            select: { resultingState: true },
          },
          assignments: {
            where: { unassignedAt: null, replacedAt: null },
            select: { level: true, memberId: true },
          },
          clientSubmissions: {
            orderBy: { submissionNumber: 'desc' },
            take: 1,
            include: { decision: true },
          },
        },
      }),
    );
  }
  versions(workRequestId: string, ids: string[]) {
    const tenantId = RequestContext.requireTenantId();
    return this.transaction((db) =>
      db.workRequestV1DocumentVersion.findMany({
        where: { tenantId, id: { in: ids }, document: { workRequestId } },
        select: { id: true },
      }),
    );
  }
  memberCapabilities(memberId: string) {
    const tenantId = RequestContext.requireTenantId();
    return this.transaction(async (db) => {
      const member = await db.member.findFirst({
        where: { id: memberId, tenantId, isActive: true },
        select: {
          user: {
            select: {
              isActive: true,
              userRolesByUserId: {
                where: { tenantId, revokedAt: null },
                select: {
                  role: {
                    select: {
                      isActive: true,
                      customScope: true,
                      rolePermissions: {
                        where: { tenantId, revokedAt: null },
                        select: {
                          permission: {
                            select: {
                              code: true,
                              scopeCompatibilities: { select: { scope: true } },
                            },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      });
      if (!member?.user?.isActive) return [];
      const codes = new Set<string>();
      for (const grant of member.user.userRolesByUserId)
        for (const permission of grant.role.rolePermissions)
          if (
            grant.role.isActive &&
            (grant.role.customScope === null ||
              permission.permission.scopeCompatibilities.some(
                ({ scope }) => scope === grant.role.customScope,
              ))
          )
            codes.add(permission.permission.code);
      return [...codes];
    });
  }
  createSubmission(input: {
    workRequestId: string;
    actorId: string;
    versionIds: string[];
    note?: string;
    idempotencyKey?: string;
    correlationId?: string;
    resubmission: boolean;
  }) {
    const tenantId = RequestContext.requireTenantId();
    return this.transaction(async (db) => {
      const number =
        (await db.workRequestV1ClientSubmission.count({
          where: { tenantId, workRequestId: input.workRequestId },
        })) + 1;
      const at = new Date();
      const submission = await db.workRequestV1ClientSubmission.create({
        data: {
          id: randomUUID(),
          tenantId,
          workRequestId: input.workRequestId,
          submissionNumber: number,
          createdByActorId: input.actorId,
          submittedByActorId: input.actorId,
          submittedAt: at,
          items: {
            create: input.versionIds.map((documentVersionId, position) => ({
              id: randomUUID(),
              tenantId,
              documentVersionId,
              position,
            })),
          },
        },
        include: { items: true },
      });
      const event = await db.workRequestV1Event.create({
        data: {
          id: randomUUID(),
          tenantId,
          workRequestId: input.workRequestId,
          action: input.resubmission
            ? 'CLIENT_REVISION_RESUBMITTED'
            : 'CLIENT_REVIEW_SUBMITTED',
          priorState: WorkRequestV1StateCode.FINAL_RELEASE,
          resultingState: WorkRequestV1StateCode.CLIENT_REVIEW,
          responsibilityLevel: WorkRequestV1AssignmentLevelCode.EXTERNAL_REVIEW,
          performedByActorId: input.actorId,
          occurredAt: at,
          note: input.note,
          idempotencyKey: input.idempotencyKey,
          correlationId: input.correlationId,
          clientSubmissionId: submission.id,
        },
      });
      return { submission, event };
    });
  }
  decide(input: {
    workRequestId: string;
    submissionId: string;
    actorId: string;
    decision: 'ACCEPT' | 'REJECT' | 'REQUEST_REVISION';
    note?: string;
    idempotencyKey?: string;
    correlationId?: string;
  }) {
    const tenantId = RequestContext.requireTenantId();
    return this.transaction(async (db) => {
      const at = new Date();
      const decision = await db.workRequestV1ClientDecision.create({
        data: {
          id: randomUUID(),
          tenantId,
          workRequestId: input.workRequestId,
          submissionId: input.submissionId,
          decision: input.decision,
          decidedByActorId: input.actorId,
          note: input.note,
          decidedAt: at,
          idempotencyKey: input.idempotencyKey,
          correlationId: input.correlationId,
        },
      });
      const state =
        input.decision === 'ACCEPT'
          ? WorkRequestV1StateCode.ACCEPTED
          : input.decision === 'REJECT'
            ? WorkRequestV1StateCode.REJECTED
            : WorkRequestV1StateCode.CLIENT_REVISION_REQUESTED;
      const event = await db.workRequestV1Event.create({
        data: {
          id: randomUUID(),
          tenantId,
          workRequestId: input.workRequestId,
          action: `CLIENT_${input.decision}`,
          priorState: WorkRequestV1StateCode.CLIENT_REVIEW,
          resultingState: state,
          performedByActorId: input.actorId,
          occurredAt: at,
          note: input.note,
          idempotencyKey: input.idempotencyKey,
          correlationId: input.correlationId,
          clientSubmissionId: input.submissionId,
          clientDecisionId: decision.id,
        },
      });
      return { decision, state, event };
    });
  }
  route(input: {
    workRequestId: string;
    actorId: string;
    destination: WorkRequestV1AssignmentLevelCode;
    clientSubmissionId: string;
    clientDecisionId: string;
    note?: string;
    idempotencyKey?: string;
    correlationId?: string;
  }) {
    const tenantId = RequestContext.requireTenantId();
    const state = {
      MEMBER: WorkRequestV1StateCode.MEMBER_ASSIGNED,
      CHECKING: WorkRequestV1StateCode.CHECKING_REVIEW,
      APPROVAL: WorkRequestV1StateCode.APPROVAL_REVIEW,
      FINAL_REVIEW: WorkRequestV1StateCode.FINAL_REVIEW,
    }[input.destination];
    return this.transaction((db) =>
      db.workRequestV1Event.create({
        data: {
          id: randomUUID(),
          tenantId,
          workRequestId: input.workRequestId,
          action: 'CLIENT_REVISION_ROUTED',
          priorState: WorkRequestV1StateCode.CLIENT_REVISION_REQUESTED,
          resultingState: state,
          responsibilityLevel: WorkRequestV1AssignmentLevelCode.EXTERNAL_REVIEW,
          performedByActorId: input.actorId,
          occurredAt: new Date(),
          note: input.note,
          idempotencyKey: input.idempotencyKey,
          correlationId: input.correlationId,
          clientSubmissionId: input.clientSubmissionId,
          clientDecisionId: input.clientDecisionId,
        },
      }),
    );
  }
  list(workRequestId: string) {
    const tenantId = RequestContext.requireTenantId();
    return this.transaction((db) =>
      db.workRequestV1ClientSubmission.findMany({
        where: { tenantId, workRequestId },
        orderBy: { submissionNumber: 'asc' },
        include: { items: true, decision: true },
      }),
    );
  }
  findEventByIdempotencyKey(key: string) {
    const tenantId = RequestContext.requireTenantId();
    return this.transaction((db) =>
      db.workRequestV1Event.findFirst({
        where: { tenantId, idempotencyKey: key },
        select: { id: true },
      }),
    );
  }
}
