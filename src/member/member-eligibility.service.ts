import { Injectable } from '@nestjs/common';
import { AppException } from '../common/exceptions/app-exception';
import { AppErrorCode } from '../common/exceptions/app-error-code';
import type { SessionActor } from '../common/security/session.types';
import { MemberEligibilityQueryDto } from './dtos/member-eligibility-query.dto';
import { MemberEligibilityRepository } from './repositories/member-eligibility.repository';
import { toEligibleMember } from './providers/member-eligibility.mapper';

@Injectable()
export class MemberEligibilityService {
  constructor(private readonly repository: MemberEligibilityRepository) {}

  async findEligible(query: MemberEligibilityQueryDto, actor: SessionActor) {
    if (!!query.divisionId === !!query.teamId)
      throw new AppException({
        code: AppErrorCode.BadRequest,
        message: 'Supply exactly one of divisionId or teamId.',
      });
    const target = await this.repository.findEligibilityTarget(
      query.divisionId,
      query.teamId,
    );
    if (!target)
      throw new AppException({
        code: AppErrorCode.NotFound,
        status: 404,
        message: 'Assignment target was not found.',
      });
    const scope = actor.role.customScope;
    const member = actor.member;
    const companyAccess =
      scope === 'company' || (actor.role.isSystemRole && scope === null);
    const memberAccess =
      member?.isActive &&
      member.company.isActive &&
      member.companyId === target.companyId;
    const divisionAccess =
      scope === 'division' &&
      memberAccess &&
      member.divisionLeadsByMemberId.some(
        ({ divisionId }) => divisionId === target.divisionId,
      );
    const teamAccess =
      scope === 'team' &&
      memberAccess &&
      !!query.teamId &&
      target.leadMemberId === member.id;
    if (!companyAccess && !divisionAccess && !teamAccess)
      throw new AppException({
        code: AppErrorCode.Forbidden,
        status: 403,
        message: 'Assignment target is outside your permitted resource scope.',
      });
    return (
      await this.repository.findEligibleMembers(
        target.companyId,
        target.divisionId,
      )
    ).map(toEligibleMember);
  }
}
