import { HttpStatus, Injectable } from '@nestjs/common';
import type { SessionActor } from '../../common/security/session.types';
import { AppErrorCode } from '../../common/exceptions/app-error-code';
import { AppException } from '../../common/exceptions/app-exception';
import { UnitOfWorkService } from '../../infra/prisma/unit-of-work.service';
import { WorkRequestAssignmentHistoryResponseDto } from '../dtos/work-request.dto';
import { WorkRequestAssignmentReadRepository } from '../repositories/work-request-assignment-read.repository';
import { WorkRequestReadRepository } from '../repositories/work-request-read.repository';

@Injectable()
export class WorkRequestAssignmentHistoryProvider {
  constructor(
    private readonly uow: UnitOfWorkService,
    private readonly reads: WorkRequestReadRepository,
    private readonly historyReads: WorkRequestAssignmentReadRepository,
  ) {}

  async history(
    id: string,
    actor: SessionActor,
  ): Promise<WorkRequestAssignmentHistoryResponseDto[]> {
    return this.uow.execute(async () => {
      const record = await this.reads.find(id, actor);
      if (!record)
        throw new AppException({
          code: AppErrorCode.NotFound,
          status: HttpStatus.NOT_FOUND,
          message: 'Work Request was not found.',
        });
      return (await this.historyReads.history(id)).map((assignment) => ({
        id: assignment.id,
        level: assignment.level,
        divisionId: assignment.divisionId,
        teamId: assignment.teamId,
        memberId: assignment.memberId,
        assignedAt: assignment.assignedAt,
        unassignedAt: assignment.unassignedAt,
        replacedAt: assignment.replacedAt,
        note: assignment.note,
        assignee: assignment.member
          ? { id: assignment.member.id, label: assignment.member.name }
          : null,
        assignedBy: assignment.assignedByActor,
        responsibleRecipients:
          assignment.unassignedAt || assignment.replacedAt
            ? []
            : (assignment.division?.divisionLeadsByDivisionId ?? []).flatMap(
                ({ member }) =>
                  member.actorProfilesByMemberId.map((profile) => ({
                    actorId: profile.id,
                    memberId: member.id,
                    label: profile.label,
                    displayName: member.name,
                  })),
              ),
      }));
    });
  }
}
