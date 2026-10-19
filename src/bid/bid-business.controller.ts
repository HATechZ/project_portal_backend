import { Body, Controller, Get, Param, ParseUUIDPipe, Post, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiSecurity, ApiTags } from '@nestjs/swagger';
import { ApiStandardCreatedResponse, ApiStandardOkResponse } from '../common/decorators/api-standard-response.decorator';
import { ResponseMessage } from '../common/decorators/response-message.decorator';
import { ActiveActor } from '../common/security/active-actor.decorator';
import { AccessTokenGuard } from '../common/security/access-token.guard';
import { AuthenticationGuard } from '../common/security/authentication.guard';
import { FinalPermissions } from '../common/security/final-permissions.decorator';
import { FinalPermissionsGuard } from '../common/security/final-permissions.guard';
import type { SessionActor } from '../common/security/session.types';
import { TenantContextGuard } from '../common/tenant/tenant-context.guard';
import { PermissionCode } from '../generated/prisma/client';
import { BidBusinessService } from './bid-business.service';
import { BidArchivedReviewRequestDto, BidBusinessCommandResponseDto, BidBusinessHistoryResponseDto, BidBusinessReadinessResponseDto, BidBusinessOutcomeInput, DecideBidBusinessOutcomeDto, RestoreBidDto } from './dtos/bid-business.dto';

/** HTTP-only C3 boundary; all lifecycle decisions remain in BidBusinessService. */
@ApiTags('bids')
@ApiSecurity('bearer')
@Controller('bids')
@UseGuards(AccessTokenGuard, TenantContextGuard, AuthenticationGuard, FinalPermissionsGuard)
export class BidBusinessController {
  constructor(private readonly service: BidBusinessService) {}

  @Get(':id/business-readiness')
  @FinalPermissions(PermissionCode.VIEW_BID)
  @ApiOperation({ summary: 'Get current Bid business readiness' })
  @ResponseMessage('Bid business readiness returned successfully')
  @ApiStandardOkResponse(BidBusinessReadinessResponseDto)
  readiness(@Param('id', ParseUUIDPipe) id: string, @ActiveActor() actor: SessionActor) {
    return this.service.readiness(id, actor);
  }

  @Post(':id/business-outcome')
  @FinalPermissions(PermissionCode.DECIDE_BID_OUTCOME)
  @ApiOperation({ summary: 'Record a Bid business outcome' })
  @ResponseMessage('Bid business outcome recorded successfully')
  @ApiStandardCreatedResponse(BidBusinessCommandResponseDto)
  outcome(@Param('id', ParseUUIDPipe) id: string, @Body() input: DecideBidBusinessOutcomeDto, @ActiveActor() actor: SessionActor) {
    return input.outcome === BidBusinessOutcomeInput.WON
      ? this.service.win({ bidId: id, note: input.note }, actor)
      : this.service.reject({ bidId: id, note: input.note }, actor);
  }

  @Get(':id/conversion')
  @FinalPermissions(PermissionCode.VIEW_BID)
  @ApiOperation({ summary: 'Get immutable Bid business and conversion history' })
  @ResponseMessage('Bid conversion history returned successfully')
  @ApiStandardOkResponse(BidBusinessHistoryResponseDto)
  history(@Param('id', ParseUUIDPipe) id: string, @ActiveActor() actor: SessionActor) {
    return this.service.history(id, actor);
  }

  @Post(':id/archived-review-requests')
  @FinalPermissions(PermissionCode.REQUEST_ARCHIVED_BID_REVIEW)
  @ApiOperation({ summary: 'Request review of an archived Bid' })
  @ResponseMessage('Archived Bid review requested successfully')
  @ApiStandardCreatedResponse(BidBusinessCommandResponseDto)
  requestReview(@Param('id', ParseUUIDPipe) id: string, @Body() input: BidArchivedReviewRequestDto, @ActiveActor() actor: SessionActor) {
    return this.service.requestArchivedReview({ bidId: id, note: input.note }, actor);
  }

  @Post(':id/restore')
  @FinalPermissions(PermissionCode.RESTORE_BID)
  @ApiOperation({ summary: 'Restore an archived Bid into its next business cycle' })
  @ResponseMessage('Bid restored successfully')
  @ApiStandardCreatedResponse(BidBusinessCommandResponseDto)
  restore(@Param('id', ParseUUIDPipe) id: string, @Body() input: RestoreBidDto, @ActiveActor() actor: SessionActor) {
    return this.service.restore({ bidId: id, note: input.note }, actor);
  }
}
