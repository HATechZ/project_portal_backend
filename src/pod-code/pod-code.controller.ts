import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
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
import { FinalPermissions } from '../common/security/final-permissions.decorator';
import { FinalPermissionsGuard } from '../common/security/final-permissions.guard';
import { TenantContextGuard } from '../common/tenant/tenant-context.guard';
import { PermissionCode } from '../generated/prisma/client';
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
  FinalPermissionsGuard,
)
@ApiStandardBadRequestResponse()
@ApiStandardUnauthorizedResponse()
@ApiStandardForbiddenResponse()
export class PodCodeController {
  constructor(private readonly service: PodCodeService) {}
  @Get()
  @FinalPermissions(PermissionCode.VIEW_REFERENCE_DATA)
  @ApiOperation({ summary: 'List all POD codes' })
  @ResponseMessage('POD codes returned successfully')
  @ApiStandardArrayResponse(PodCodeResponseDto, 'POD codes returned')
  findAll(@Query() q: PodCodeQueryDto) {
    return this.service.findAll(q.includeInactive);
  }
  @Get('deactivated')
  @FinalPermissions(PermissionCode.VIEW_REFERENCE_DATA)
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
  @FinalPermissions(PermissionCode.VIEW_REFERENCE_DATA)
  @ApiOperation({ summary: 'Get POD code by ID' })
  @ApiParam({ name: 'id', description: 'POD Code OptionValue ID' })
  @ResponseMessage('POD code returned successfully')
  @ApiStandardOkResponse(PodCodeResponseDto, 'POD code returned')
  @ApiStandardNotFoundResponse('POD code was not found')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.findOne(id);
  }
  @Post()
  @FinalPermissions(PermissionCode.CREATE_REFERENCE_DATA_OPTION)
  @ApiOperation({ summary: 'Create a new POD code' })
  @ResponseMessage('POD code created successfully')
  @ApiStandardCreatedResponse(PodCodeResponseDto, 'POD code created')
  @ApiStandardConflictResponse('A POD code with the same name already exists')
  create(@Body() i: PodCodeInputDto) {
    return this.service.create(i);
  }
  @Patch(':id')
  @FinalPermissions(PermissionCode.UPDATE_REFERENCE_DATA_OPTION)
  @ApiOperation({ summary: 'Update POD code by ID' })
  @ApiParam({ name: 'id', description: 'POD Code OptionValue ID' })
  @ResponseMessage('POD code updated successfully')
  @ApiStandardOkResponse(PodCodeResponseDto, 'POD code updated')
  @ApiStandardNotFoundResponse('POD code was not found')
  @ApiStandardConflictResponse(
    'POD code update conflicts with its current state',
  )
  update(@Param('id', ParseUUIDPipe) id: string, @Body() i: UpdatePodCodeDto) {
    return this.service.update(id, i);
  }
  @Patch(':id/deactivate')
  @FinalPermissions(PermissionCode.DEACTIVATE_REFERENCE_DATA_OPTION)
  @ApiOperation({ summary: 'Deactivate POD code by ID' })
  @ApiParam({ name: 'id', description: 'POD Code OptionValue ID' })
  @ResponseMessage('POD code deactivated successfully')
  @ApiStandardOkResponse(PodCodeResponseDto, 'POD code deactivated')
  @ApiStandardNotFoundResponse('POD code was not found')
  @ApiStandardConflictResponse('POD code is already inactive')
  deactivate(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.deactivate(id);
  }
  @Patch(':id/reactivate')
  @FinalPermissions(PermissionCode.REACTIVATE_REFERENCE_DATA_OPTION)
  @ApiOperation({ summary: 'Reactivate POD code by ID' })
  @ApiParam({ name: 'id', description: 'POD Code OptionValue ID' })
  @ResponseMessage('POD code reactivated successfully')
  @ApiStandardOkResponse(PodCodeResponseDto, 'POD code reactivated')
  @ApiStandardNotFoundResponse('POD code was not found')
  @ApiStandardConflictResponse('POD code is already active')
  reactivate(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.reactivate(id);
  }
}
