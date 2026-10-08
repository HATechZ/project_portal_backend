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
} from '@nestjs/common';
import { ApiNoContentResponse, ApiOperation, ApiParam } from '@nestjs/swagger';
import {
  ApiStandardArrayResponse,
  ApiStandardCreatedResponse,
  ApiStandardOkResponse,
} from '../common/decorators/api-standard-response.decorator';
import { ResponseMessage } from '../common/decorators/response-message.decorator';
import { FinalPermissions } from '../common/security/final-permissions.decorator';
import { ActiveUser } from '../common/security/active-user.decorator';
import type { SessionUser } from '../common/security/session.types';
import { PermissionCode } from '../generated/prisma/client';
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
  @FinalPermissions(PermissionCode.CREATE_MEMBER)
  @ResponseMessage('Member created successfully')
  @ApiOperation({ summary: 'Create Member' })
  @ApiStandardCreatedResponse(MemberResponseDto, 'Member created')
  create(@Body() input: CreateMemberDto, @ActiveUser() user: SessionUser) {
    return this.memberService.create(input, user.id);
  }

  @Get()
  @FinalPermissions(PermissionCode.VIEW_MEMBERS)
  @ResponseMessage('Members returned successfully')
  @ApiOperation({ summary: 'List Members' })
  @ApiPaginatedResponse(MemberResponseDto)
  findAll(@Query() query: MemberQueryDto) {
    return this.memberService.findAll(query);
  }

  @Get(':id')
  @FinalPermissions(PermissionCode.VIEW_MEMBERS)
  @ResponseMessage('Member returned successfully')
  @ApiOperation({ summary: 'Get a Member by ID' })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  @ApiStandardOkResponse(MemberResponseDto, 'Member returned')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.memberService.findOne(id);
  }

  @Get(':id/divisions')
  @FinalPermissions(PermissionCode.VIEW_MEMBERS)
  @ResponseMessage('Led Divisions returned successfully')
  @ApiOperation({
    summary: 'List Divisions this Member leads',
    description:
      'Active leadership only; revoked rows are never returned. Empty array ' +
      'when the Member leads no Division.',
  })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  @ApiStandardArrayResponse(LedDivisionResponseDto, 'Led Divisions returned')
  findLedDivisions(@Param('id', ParseUUIDPipe) id: string) {
    return this.memberService.findLedDivisions(id);
  }

  @Patch(':id')
  @FinalPermissions(PermissionCode.UPDATE_MEMBER)
  @ResponseMessage('Member updated successfully')
  @ApiOperation({ summary: 'Update a Member' })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  @ApiStandardOkResponse(MemberResponseDto, 'Member updated')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() input: UpdateMemberDto,
  ) {
    return this.memberService.update(id, input);
  }

  @Delete(':id')
  @FinalPermissions(PermissionCode.REMOVE_MEMBER)
  @HttpCode(204)
  @ResponseMessage('Member removed successfully')
  @ApiOperation({
    summary: 'Remove a member',
    description:
      'Removes the Member from active organization use and revokes Member access. Historical records are preserved.',
  })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  @ApiNoContentResponse({
    description: 'Member removed from active organization',
  })
  delete(@Param('id', ParseUUIDPipe) id: string) {
    return this.memberService.delete(id);
  }

  @Put(':id/access-link')
  @FinalPermissions(PermissionCode.LINK_MEMBER_ACCESS)
  @ResponseMessage('Member access linked successfully')
  @ApiOperation({ summary: 'Link existing User access to a Member' })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  @ApiStandardOkResponse(MemberResponseDto, 'Member access linked')
  linkAccess(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() input: MemberAccessLinkDto,
  ) {
    return this.memberService.linkAccess(id, input);
  }
}
