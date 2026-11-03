import { Get, Query } from '@nestjs/common';
import { ApiOperation } from '@nestjs/swagger';
import { ApiStandardArrayResponse } from '../common/decorators/api-standard-response.decorator';
import { ResponseMessage } from '../common/decorators/response-message.decorator';
import { ActiveActor } from '../common/security/active-actor.decorator';
import type { SessionActor } from '../common/security/session.types';
import { FinalPermissions } from '../common/security/final-permissions.decorator';
import { PermissionCode } from '../generated/prisma/client';
import { MemberApiController } from './member-api.decorator';
import { MemberEligibilityQueryDto } from './dtos/member-eligibility-query.dto';
import { EligibleMemberResponseDto } from './dtos/eligible-member-response.dto';
import { MemberEligibilityService } from './member-eligibility.service';

@MemberApiController()
export class MemberEligibilityController {
  constructor(private readonly service: MemberEligibilityService) {}

  @Get('eligible')
  @FinalPermissions(PermissionCode.VIEW_MEMBERS)
  @ResponseMessage('Eligible members returned successfully')
  @ApiOperation({
    summary: 'List active same-Division assignment candidates',
    description:
      'Supply divisionId for Division Lead, or teamId for Team Lead/Member. Existing Team memberships do not exclude candidates.',
  })
  @ApiStandardArrayResponse(EligibleMemberResponseDto)
  findEligible(
    @Query() query: MemberEligibilityQueryDto,
    @ActiveActor() actor: SessionActor,
  ) {
    return this.service.findEligible(query, actor);
  }
}
