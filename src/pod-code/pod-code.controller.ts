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
import {
  ApiStandardArrayResponse,
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
import { TenantContextGuard } from '../common/tenant/tenant-context.guard';
import { WorkflowActionCode } from '../generated/prisma/client';
import {
  PodCodeInputDto,
  PodCodeQueryDto,
  PodCodeResponseDto,
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
@ApiStandardBadRequestResponse()
@ApiStandardUnauthorizedResponse()
@ApiStandardForbiddenResponse()
export class PodCodeController {
  constructor(private readonly service: PodCodeService) {}
  @Get()
  @ApiOperation({ summary: 'List all POD codes' })
  @ResponseMessage('POD codes returned successfully')
  @ApiStandardArrayResponse(PodCodeResponseDto, 'POD codes returned')
  findAll(@Query() q: PodCodeQueryDto) {
    return this.service.findAll(q.includeInactive);
  }
  @Get('deactivated')
  @ApiOperation({ summary: 'List deactivated POD codes' })
  @ResponseMessage('Deactivated POD codes returned successfully')
  @ApiStandardArrayResponse(
    PodCodeResponseDto,
    'Deactivated POD codes returned',
  )
  findDeactivated() {
    return this.service.findDeactivated();
  }
  @Get(':id')
  @ApiOperation({ summary: 'Get POD code by ID' })
  @ApiParam({ name: 'id', description: 'POD Code OptionValue ID' })
  @ResponseMessage('POD code returned successfully')
  @ApiStandardOkResponse(PodCodeResponseDto, 'POD code returned')
  @ApiStandardNotFoundResponse('POD code was not found')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.findOne(id);
  }
  @Post()
  @ApiOperation({ summary: 'Create a new POD code' })
  @ResponseMessage('POD code created successfully')
  @ApiStandardCreatedResponse(PodCodeResponseDto, 'POD code created')
  @ApiStandardConflictResponse('A POD code with the same name already exists')
  create(@Body() i: PodCodeInputDto, @Req() r: ObjectScopeRequest) {
    return this.service.create(i, r.actorScope!);
  }
  @Patch(':id')
  @ApiOperation({ summary: 'Update POD code by ID' })
  @ApiParam({ name: 'id', description: 'POD Code OptionValue ID' })
  @ResponseMessage('POD code updated successfully')
  @ApiStandardOkResponse(PodCodeResponseDto, 'POD code updated')
  @ApiStandardNotFoundResponse('POD code was not found')
  @ApiStandardConflictResponse(
    'POD code update conflicts with its current state',
  )
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
  @ResponseMessage('POD code deactivated successfully')
  @ApiStandardOkResponse(PodCodeResponseDto, 'POD code deactivated')
  @ApiStandardNotFoundResponse('POD code was not found')
  @ApiStandardConflictResponse('POD code is already inactive')
  deactivate(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() r: ObjectScopeRequest,
  ) {
    return this.service.deactivate(id, r.actorScope!);
  }
  @Patch(':id/reactivate')
  @ApiOperation({ summary: 'Reactivate POD code by ID' })
  @ApiParam({ name: 'id', description: 'POD Code OptionValue ID' })
  @ResponseMessage('POD code reactivated successfully')
  @ApiStandardOkResponse(PodCodeResponseDto, 'POD code reactivated')
  @ApiStandardNotFoundResponse('POD code was not found')
  @ApiStandardConflictResponse('POD code is already active')
  reactivate(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() r: ObjectScopeRequest,
  ) {
    return this.service.reactivate(id, r.actorScope!);
  }
}
