import { Injectable } from '@nestjs/common';
import { RequestContext } from '../../common/context/request-context';
import { BaseRepository } from '../../infra/prisma/base.repository';
import { UnitOfWorkService } from '../../infra/prisma/unit-of-work.service';
import { MemberDeleteBlocker } from './member.records';

@Injectable()
export class MemberRelationsRepository extends BaseRepository {
  constructor(unitOfWork: UnitOfWorkService) {
    super(unitOfWork);
  }

  async findDeleteBlockers(
    id: string,
    companyId: string,
  ): Promise<MemberDeleteBlocker[]> {
    const tenantId = RequestContext.requireTenantId();
    return this.transaction(async (db) => {
      const where = { id, tenantId, companyId };
      const [
        actorProfilesByMemberId,
        divisionLeadsByMemberId,
        teamsByLeadMemberId,
        teamMembersByMemberId,
        workRequestAssignmentsByMemberId,
        workflowInfoRequestsByRequestedByMemberId,
        workflowInfoRequestsByTargetMemberId,
        workRequestRevisionRequestsByRequestedToMemberId,
      ] = await Promise.all([
        db.member.findFirst({
          where: { ...where, actorProfilesByMemberId: { some: {} } },
          select: { id: true },
        }),
        db.member.findFirst({
          where: { ...where, divisionLeadsByMemberId: { some: {} } },
          select: { id: true },
        }),
        db.member.findFirst({
          where: { ...where, teamsByLeadMemberId: { some: {} } },
          select: { id: true },
        }),
        db.member.findFirst({
          where: { ...where, teamMembersByMemberId: { some: {} } },
          select: { id: true },
        }),
        db.member.findFirst({
          where: { ...where, workRequestAssignmentsByMemberId: { some: {} } },
          select: { id: true },
        }),
        db.member.findFirst({
          where: {
            ...where,
            workflowInfoRequestsByRequestedByMemberId: { some: {} },
          },
          select: { id: true },
        }),
        db.member.findFirst({
          where: {
            ...where,
            workflowInfoRequestsByTargetMemberId: { some: {} },
          },
          select: { id: true },
        }),
        db.member.findFirst({
          where: {
            ...where,
            workRequestRevisionRequestsByRequestedToMemberId: { some: {} },
          },
          select: { id: true },
        }),
      ]);
      return [
        actorProfilesByMemberId ? 'actorProfilesByMemberId' : null,
        divisionLeadsByMemberId ? 'divisionLeadsByMemberId' : null,
        teamsByLeadMemberId ? 'teamsByLeadMemberId' : null,
        teamMembersByMemberId ? 'teamMembersByMemberId' : null,
        workRequestAssignmentsByMemberId
          ? 'workRequestAssignmentsByMemberId'
          : null,
        workflowInfoRequestsByRequestedByMemberId
          ? 'workflowInfoRequestsByRequestedByMemberId'
          : null,
        workflowInfoRequestsByTargetMemberId
          ? 'workflowInfoRequestsByTargetMemberId'
          : null,
        workRequestRevisionRequestsByRequestedToMemberId
          ? 'workRequestRevisionRequestsByRequestedToMemberId'
          : null,
      ].filter((blocker): blocker is MemberDeleteBlocker => blocker !== null);
    });
  }

  hasCrossDivisionTeamLinks(
    id: string,
    nextDivisionId: string,
  ): Promise<boolean> {
    const tenantId = RequestContext.requireTenantId();
    return this.transaction(async (db) => {
      const [ledTeam, activeMembership] = await Promise.all([
        db.team.findFirst({
          where: {
            tenantId,
            leadMemberId: id,
            divisionId: { not: nextDivisionId },
          },
          select: { id: true },
        }),
        db.teamMember.findFirst({
          where: {
            tenantId,
            memberId: id,
            leftAt: null,
            team: { divisionId: { not: nextDivisionId } },
          },
          select: { id: true },
        }),
      ]);
      return ledTeam !== null || activeMembership !== null;
    });
  }
}
