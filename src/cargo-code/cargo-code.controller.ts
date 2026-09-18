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
  CargoCodeInputDto,
  CargoCodeQueryDto,
  UpdateCargoCodeDto,
} from './dtos/cargo-code.dto';
import { CargoCodeService } from './cargo-code.service';
@ApiTags('cargo-codes')
@ApiSecurity('bearer')
@Controller('cargo-codes')
@UseGuards(
  AccessTokenGuard,
  TenantContextGuard,
  AuthenticationGuard,
  ObjectScopeGuard,
  PermissionsGuard,
)
@Permissions(WorkflowActionCode.UPDATE_SETTINGS)
export class CargoCodeController {
  constructor(private readonly service: CargoCodeService) {}
  @Get()
  @ApiOperation({ summary: 'List all cargo codes' })
  findAll(@Query() q: CargoCodeQueryDto) {
    return this.service.findAll(q.includeInactive);
  }
  @Get(':id')
  @ApiOperation({ summary: 'Get cargo code by ID' })
  @ApiParam({ name: 'id', description: 'Cargo Code OptionValue ID' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.findOne(id);
  }
  @Post()
  @ApiOperation({ summary: 'Create a new cargo code' })
  create(@Body() i: CargoCodeInputDto, @Req() r: ObjectScopeRequest) {
    return this.service.create(i, r.actorScope!);
  }
  @Patch(':id')
  @ApiOperation({ summary: 'Update cargo code by ID' })
  @ApiParam({ name: 'id', description: 'Cargo Code OptionValue ID' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() i: UpdateCargoCodeDto,
    @Req() r: ObjectScopeRequest,
  ) {
    return this.service.update(id, i, r.actorScope!);
  }
  @Patch(':id/deactivate')
  @ApiOperation({ summary: 'Deactivate cargo code by ID' })
  @ApiParam({ name: 'id', description: 'Cargo Code OptionValue ID' })
  deactivate(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() r: ObjectScopeRequest,
  ) {
    return this.service.deactivate(id, r.actorScope!);
  }
  @Patch(':id/reactivate')
  @ApiOperation({ summary: 'Reactivate cargo code by ID' })
  @ApiParam({ name: 'id', description: 'Cargo Code OptionValue ID' })
  reactivate(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() r: ObjectScopeRequest,
  ) {
    return this.service.reactivate(id, r.actorScope!);
  }
}
