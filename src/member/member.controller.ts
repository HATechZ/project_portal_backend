import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiNoContentResponse,
  ApiOperation,
  ApiParam,
  ApiSecurity,
  ApiTags,
} from '@nestjs/swagger';
import {
  ApiStandardBadRequestResponse,
  ApiStandardConflictResponse,
  ApiStandardCreatedResponse,
  ApiStandardForbiddenResponse,
  ApiStandardNotFoundResponse,
  ApiStandardOkResponse,
  ApiStandardUnauthorizedResponse,
} from '../common/decorators/api-standard-response.decorator';
import { ResponseMessage } from '../common/decorators/response-message.decorator';
import { AccessTokenGuard } from '../common/security/access-token.guard';
import { AuthenticationGuard } from '../common/security/authentication.guard';
import { ObjectScopeGuard } from '../common/security/object-scope.guard';
import type { ObjectScopeRequest } from '../common/security/object-scope.guard';
import { Permissions } from '../common/security/permissions.decorator';
import { PermissionsGuard } from '../common/security/permissions.guard';
import { ActiveUser } from '../common/security/active-user.decorator';
import type { SessionUser } from '../common/security/session.types';
import { ApiPaginatedResponse } from '../common/swagger/api-paginated-response.decorator';
import { TenantContextGuard } from '../common/tenant/tenant-context.guard';
import { WorkflowActionCode } from '../generated/prisma/client';
import {
  CreateMemberDto,
  MemberAccessLinkDto,
  MemberQueryDto,
  MemberResponseDto,
  UpdateMemberDto,
} from './dtos';
import { MemberService } from './member.service';

@ApiTags('member')
@ApiSecurity('bearer')
@Controller('member')
@UseGuards(
  AccessTokenGuard,
  TenantContextGuard,
  AuthenticationGuard,
  ObjectScopeGuard,
  PermissionsGuard,
)
@Permissions(WorkflowActionCode.ADD_MEMBER)
@ApiStandardBadRequestResponse()
@ApiStandardUnauthorizedResponse()
@ApiStandardForbiddenResponse('Member access is outside actor scope')
@ApiStandardNotFoundResponse('Member was not found')
@ApiStandardConflictResponse('Member request conflicts with current data')
export class MemberController {
  constructor(private readonly memberService: MemberService) {}

  @Post()
  @ResponseMessage('Member created successfully')
  @ApiOperation({ summary: 'Create Member' })
  @ApiStandardCreatedResponse(MemberResponseDto, 'Member created')
  create(
    @Body() input: CreateMemberDto,
    @Req() request: ObjectScopeRequest,
    @ActiveUser() activeUser: SessionUser,
  ) {
    return this.memberService.create(input, request.actorScope!, activeUser.id);
  }

  @Get()
  @ResponseMessage('Members returned successfully')
  @ApiOperation({ summary: 'List Members' })
  @ApiPaginatedResponse(MemberResponseDto)
  findAll(@Query() query: MemberQueryDto, @Req() request: ObjectScopeRequest) {
    return this.memberService.findAll(query, request.actorScope!);
  }

  @Get(':id')
  @ResponseMessage('Member returned successfully')
  @ApiOperation({ summary: 'Get a Member by ID' })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  @ApiStandardOkResponse(MemberResponseDto, 'Member returned')
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() request: ObjectScopeRequest,
  ) {
    return this.memberService.findOne(id, request.actorScope!);
  }

  @Patch(':id')
  @ResponseMessage('Member updated successfully')
  @ApiOperation({ summary: 'Update a Member' })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  @ApiStandardOkResponse(MemberResponseDto, 'Member updated')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() input: UpdateMemberDto,
    @Req() request: ObjectScopeRequest,
  ) {
    return this.memberService.update(id, input, request.actorScope!);
  }

  @Delete(':id')
  @HttpCode(204)
  @ResponseMessage('Member deleted successfully')
  @ApiOperation({ summary: 'Delete a Member' })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  @ApiNoContentResponse({ description: 'Member deleted' })
  delete(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() request: ObjectScopeRequest,
  ) {
    return this.memberService.delete(id, request.actorScope!);
  }

  @Put(':id/access-link')
  @ResponseMessage('Member access linked successfully')
  @ApiOperation({ summary: 'Link existing User access to a Member' })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  @ApiStandardOkResponse(MemberResponseDto, 'Member access linked')
  linkAccess(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() input: MemberAccessLinkDto,
    @Req() request: ObjectScopeRequest,
  ) {
    return this.memberService.linkAccess(id, input, request.actorScope!);
  }
}
