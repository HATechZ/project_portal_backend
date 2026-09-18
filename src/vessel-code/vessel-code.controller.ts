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
  VesselCodeInputDto,
  VesselCodeQueryDto,
  UpdateVesselCodeDto,
} from './dtos/vessel-code.dto';
import { VesselCodeService } from './vessel-code.service';
@ApiTags('vessel-codes')
@ApiSecurity('bearer')
@Controller('vessel-codes')
@UseGuards(
  AccessTokenGuard,
  TenantContextGuard,
  AuthenticationGuard,
  ObjectScopeGuard,
  PermissionsGuard,
)
@Permissions(WorkflowActionCode.UPDATE_SETTINGS)
export class VesselCodeController {
  constructor(private readonly service: VesselCodeService) {}
  @Get()
  @ApiOperation({ summary: 'List all vessel codes' })
  findAll(@Query() q: VesselCodeQueryDto) {
    return this.service.findAll(q.includeInactive);
  }
  @Get(':id')
  @ApiOperation({ summary: 'Get vessel code by ID' })
  @ApiParam({ name: 'id', description: 'Vessel Code OptionValue ID' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.findOne(id);
  }
  @Post()
  @ApiOperation({ summary: 'Create a new vessel code' })
  create(@Body() i: VesselCodeInputDto, @Req() r: ObjectScopeRequest) {
    return this.service.create(i, r.actorScope!);
  }
  @Patch(':id')
  @ApiOperation({ summary: 'Update vessel code by ID' })
  @ApiParam({ name: 'id', description: 'Vessel Code OptionValue ID' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() i: UpdateVesselCodeDto,
    @Req() r: ObjectScopeRequest,
  ) {
    return this.service.update(id, i, r.actorScope!);
  }
  @Patch(':id/deactivate')
  @ApiOperation({ summary: 'Deactivate vessel code by ID' })
  @ApiParam({ name: 'id', description: 'Vessel Code OptionValue ID' })
  deactivate(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() r: ObjectScopeRequest,
  ) {
    return this.service.deactivate(id, r.actorScope!);
  }
  @Patch(':id/reactivate')
  @ApiOperation({ summary: 'Reactivate vessel code by ID' })
  @ApiParam({ name: 'id', description: 'Vessel Code OptionValue ID' })
  reactivate(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() r: ObjectScopeRequest,
  ) {
    return this.service.reactivate(id, r.actorScope!);
  }
}
