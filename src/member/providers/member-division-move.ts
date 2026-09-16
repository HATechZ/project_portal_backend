import { HttpStatus } from '@nestjs/common';
import { AppErrorCode } from '../../common/exceptions/app-error-code';
import { AppException } from '../../common/exceptions/app-exception';
import {
  MemberRecord,
  MemberRelationsRepository,
  MemberRepository,
} from '../repositories';
import { memberNotFound } from './member.errors';

/**
 * A Member may only move to a Division in its own Company, and not while it
 * still holds active Team relations in the Division it is leaving.
 */
export async function assertDivisionMove(
  repositories: {
    repository: MemberRepository;
    relations: MemberRelationsRepository;
  },
  member: MemberRecord,
  companyId: string,
  divisionId: string,
): Promise<void> {
  if (!(await repositories.repository.findDivision(divisionId, companyId))) {
    throw memberNotFound(divisionId);
  }
  if (
    member.divisionId !== divisionId &&
    (await repositories.relations.hasCrossDivisionTeamLinks(
      member.id,
      divisionId,
    ))
  ) {
    throw new AppException({
      code: AppErrorCode.Conflict,
      status: HttpStatus.CONFLICT,
      message:
        'This member cannot be moved because they have active team assignments in another division. Remove those assignments first.',
    });
  }
}
