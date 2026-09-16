import {
  Body,
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
} from '@nestjs/common';
import { ApiNoContentResponse, ApiOperation, ApiParam } from '@nestjs/swagger';
import {
  ApiStandardCreatedResponse,
  ApiStandardOkResponse,
} from '../common/decorators/api-standard-response.decorator';
import { ResponseMessage } from '../common/decorators/response-message.decorator';
import type { ObjectScopeRequest } from '../common/security/object-scope.guard';
import { ActiveUser } from '../common/security/active-user.decorator';
import type { SessionUser } from '../common/security/session.types';
import { ApiPaginatedResponse } from '../common/swagger/api-paginated-response.decorator';
import {
  CreateMemberDto,
  MemberAccessLinkDto,
  MemberQueryDto,
  LedDivisionResponseDto,
  MemberResponseDto,
  UpdateMemberDto,
} from './dtos';
import { MemberApiController } from './member-api.decorator';
import { MemberService } from './member.service';

@MemberApiController()
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

  @Get(':id/divisions')
  @ResponseMessage('Led Divisions returned successfully')
  @ApiOperation({
    summary: 'List Divisions this Member leads',
    description:
      'Active leadership only; revoked rows are never returned. Empty array ' +
      'when the Member leads no Division.',
  })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  @ApiStandardOkResponse(LedDivisionResponseDto, 'Led Divisions returned')
  findLedDivisions(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() request: ObjectScopeRequest,
  ) {
    return this.memberService.findLedDivisions(id, request.actorScope!);
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
  @ResponseMessage('Member removed successfully')
  @ApiOperation({
    summary: 'Remove a member',
    description: 'Removes the Member from active organization use and revokes Member access. Historical records are preserved.',
  })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  @ApiNoContentResponse({ description: 'Member removed from active organization' })
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
