import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiParam, ApiSecurity, ApiTags } from '@nestjs/swagger';
import { AccessTokenGuard } from '../common/security/access-token.guard';
import { AuthenticationGuard } from '../common/security/authentication.guard';
import { ObjectScopeGuard } from '../common/security/object-scope.guard';
import type { ObjectScopeRequest } from '../common/security/object-scope.guard';
import { Permissions } from '../common/security/permissions.decorator';
import { PermissionsGuard } from '../common/security/permissions.guard';
import { TenantContextGuard } from '../common/tenant/tenant-context.guard';
import { WorkflowActionCode } from '../generated/prisma/client';
import {
  PodCodeInputDto,
  PodCodeQueryDto,
  UpdatePodCodeDto,
} from './dtos/pod-code.dto';
import { PodCodeService } from './pod-code.service';
@ApiTags('pod-codes')
@ApiSecurity('bearer')
@Controller('pod-codes')
@UseGuards(
  AccessTokenGuard,
  TenantContextGuard,
  AuthenticationGuard,
  ObjectScopeGuard,
  PermissionsGuard,
)
@Permissions(WorkflowActionCode.UPDATE_SETTINGS)
export class PodCodeController {
  constructor(private readonly service: PodCodeService) {}
  @Get()
  @ApiOperation({ summary: 'List all POD codes' })
  findAll(@Query() q: PodCodeQueryDto) {
    return this.service.findAll(q.includeInactive);
  }
  @Get(':id')
  @ApiOperation({ summary: 'Get POD code by ID' })
  @ApiParam({ name: 'id', description: 'POD Code OptionValue ID' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.findOne(id);
  }
  @Post()
  @ApiOperation({ summary: 'Create a new POD code' })
  create(@Body() i: PodCodeInputDto, @Req() r: ObjectScopeRequest) {
    return this.service.create(i, r.actorScope!);
  }
  @Patch(':id')
  @ApiOperation({ summary: 'Update POD code by ID' })
  @ApiParam({ name: 'id', description: 'POD Code OptionValue ID' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() i: UpdatePodCodeDto,
    @Req() r: ObjectScopeRequest,
  ) {
    return this.service.update(id, i, r.actorScope!);
  }
  @Patch(':id/deactivate')
  @ApiOperation({ summary: 'Deactivate POD code by ID' })
  @ApiParam({ name: 'id', description: 'POD Code OptionValue ID' })
  deactivate(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() r: ObjectScopeRequest,
  ) {
    return this.service.deactivate(id, r.actorScope!);
  }
  @Patch(':id/reactivate')
  @ApiOperation({ summary: 'Reactivate POD code by ID' })
  @ApiParam({ name: 'id', description: 'POD Code OptionValue ID' })
  reactivate(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() r: ObjectScopeRequest,
  ) {
    return this.service.reactivate(id, r.actorScope!);
  }
}
