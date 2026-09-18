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
import { ResponseMessage } from '../common/decorators/response-message.decorator';
import { AccessTokenGuard } from '../common/security/access-token.guard';
import { AuthenticationGuard } from '../common/security/authentication.guard';
import { ObjectScopeGuard } from '../common/security/object-scope.guard';
import type { ObjectScopeRequest } from '../common/security/object-scope.guard';
import { Permissions } from '../common/security/permissions.decorator';
import { PermissionsGuard } from '../common/security/permissions.guard';
import { TenantContextGuard } from '../common/tenant/tenant-context.guard';
import { WorkflowActionCode } from '../generated/prisma/client';
import {
  PolCodeInputDto,
  PolCodeQueryDto,
  UpdatePolCodeDto,
} from './dtos/pol-code.dto';
import { PolCodeService } from './pol-code.service';
@ApiTags('pol-codes')
@ApiSecurity('bearer')
@Controller('pol-codes')
@UseGuards(
  AccessTokenGuard,
  TenantContextGuard,
  AuthenticationGuard,
  ObjectScopeGuard,
  PermissionsGuard,
)
@Permissions(WorkflowActionCode.UPDATE_SETTINGS)
export class PolCodeController {
  constructor(private readonly service: PolCodeService) {}
  @Get()
  @ApiOperation({ summary: 'List all POL codes' })
  findAll(@Query() q: PolCodeQueryDto) {
    return this.service.findAll(q.includeInactive);
  }
  @Get(':id')
  @ApiOperation({ summary: 'Get POL code by ID' })
  @ApiParam({ name: 'id', description: 'POL Code OptionValue ID' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.findOne(id);
  }
  @Post()
  @ApiOperation({ summary: 'Create a new POL code' })
  @ResponseMessage('POL code created successfully')
  create(@Body() input: PolCodeInputDto, @Req() req: ObjectScopeRequest) {
    return this.service.create(input, req.actorScope!);
  }
  @Patch(':id')
  @ApiOperation({ summary: 'Update POL code by ID' })
  @ApiParam({ name: 'id', description: 'POL Code OptionValue ID' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() input: UpdatePolCodeDto,
    @Req() req: ObjectScopeRequest,
  ) {
    return this.service.update(id, input, req.actorScope!);
  }
  @Patch(':id/deactivate')
  @ApiOperation({ summary: 'Deactivate POL code by ID' })
  @ApiParam({ name: 'id', description: 'POL Code OptionValue ID' })
  deactivate(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: ObjectScopeRequest,
  ) {
    return this.service.deactivate(id, req.actorScope!);
  }
  @Patch(':id/reactivate')
  @ApiOperation({ summary: 'Reactivate POL code by ID' })
  @ApiParam({ name: 'id', description: 'POL Code OptionValue ID' })
  reactivate(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: ObjectScopeRequest,
  ) {
    return this.service.reactivate(id, req.actorScope!);
  }
}
