import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiSecurity, ApiTags } from '@nestjs/swagger';
import { ActiveUser } from '../common/security/active-user.decorator';
import { AccessTokenGuard } from '../common/security/access-token.guard';
import { AuthenticationGuard } from '../common/security/authentication.guard';
import type { SessionUser } from '../common/security/session.types';
import { TenantContextGuard } from '../common/tenant/tenant-context.guard';
import {
  ApiStandardArrayResponse,
  ApiStandardForbiddenResponse,
  ApiStandardOkResponse,
  ApiStandardUnauthorizedResponse,
} from '../common/decorators/api-standard-response.decorator';
import { ResponseMessage } from '../common/decorators/response-message.decorator';
import { ActorProfileService } from './actor-profile.service';
import { ActorProfileResponseDto } from './dtos';

@ApiTags('actor-profile')
@ApiSecurity('bearer')
@Controller()
@UseGuards(AccessTokenGuard, TenantContextGuard, AuthenticationGuard)
@ApiStandardUnauthorizedResponse()
export class ActorProfileController {
  constructor(private readonly service: ActorProfileService) {}

  @Get('actor-profiles')
  @ApiOperation({ summary: "List the authenticated User's actor profiles" })
  @ApiStandardArrayResponse(ActorProfileResponseDto)
  @ResponseMessage('Actor profiles returned successfully')
  findForUser(@ActiveUser() user: SessionUser) {
    return this.service.findForUser(user.id);
  }

  @Post('actor-profiles/:id/activate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Choose the active acting profile' })
  @ApiStandardOkResponse(ActorProfileResponseDto)
  @ApiStandardForbiddenResponse('Actor profile is unavailable')
  @ResponseMessage('Actor profile activated successfully')
  activate(
    @Param('id', ParseUUIDPipe) id: string,
    @ActiveUser() user: SessionUser,
  ) {
    return this.service.activate(id, user.id);
  }
}
