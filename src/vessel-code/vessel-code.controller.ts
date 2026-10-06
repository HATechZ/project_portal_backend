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
  VesselCodeInputDto,
  VesselCodeQueryDto,
  VesselCodeResponseDto,
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
  FinalPermissionsGuard,
)
@ApiStandardBadRequestResponse()
@ApiStandardUnauthorizedResponse()
@ApiStandardForbiddenResponse()
export class VesselCodeController {
  constructor(private readonly service: VesselCodeService) {}
  @Get()
  @FinalPermissions(PermissionCode.VIEW_REFERENCE_DATA)
  @ApiOperation({ summary: 'List all vessel codes' })
  @ResponseMessage('Vessel codes returned successfully')
  @ApiStandardArrayResponse(VesselCodeResponseDto, 'Vessel codes returned')
  findAll(@Query() q: VesselCodeQueryDto) {
    return this.service.findAll(q.includeInactive);
  }
  @Get('deactivated')
  @FinalPermissions(PermissionCode.VIEW_REFERENCE_DATA)
  @ApiOperation({ summary: 'List deactivated vessel codes' })
  @ResponseMessage('Deactivated vessel codes returned successfully')
  @ApiStandardArrayResponse(
    VesselCodeResponseDto,
    'Deactivated vessel codes returned',
  )
  findDeactivated() {
    return this.service.findDeactivated();
  }
  @Get(':id')
  @FinalPermissions(PermissionCode.VIEW_REFERENCE_DATA)
  @ApiOperation({ summary: 'Get vessel code by ID' })
  @ApiParam({ name: 'id', description: 'Vessel Code OptionValue ID' })
  @ResponseMessage('Vessel code returned successfully')
  @ApiStandardOkResponse(VesselCodeResponseDto, 'Vessel code returned')
  @ApiStandardNotFoundResponse('Vessel code was not found')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.findOne(id);
  }
  @Post()
  @FinalPermissions(PermissionCode.CREATE_REFERENCE_DATA_OPTION)
  @ApiOperation({ summary: 'Create a new vessel code' })
  @ResponseMessage('Vessel code created successfully')
  @ApiStandardCreatedResponse(VesselCodeResponseDto, 'Vessel code created')
  @ApiStandardConflictResponse(
    'A vessel code with the same name or code already exists',
  )
  create(@Body() i: VesselCodeInputDto) {
    return this.service.create(i);
  }
  @Patch(':id')
  @FinalPermissions(PermissionCode.UPDATE_REFERENCE_DATA_OPTION)
  @ApiOperation({ summary: 'Update vessel code by ID' })
  @ApiParam({ name: 'id', description: 'Vessel Code OptionValue ID' })
  @ResponseMessage('Vessel code updated successfully')
  @ApiStandardOkResponse(VesselCodeResponseDto, 'Vessel code updated')
  @ApiStandardNotFoundResponse('Vessel code was not found')
  @ApiStandardConflictResponse(
    'Vessel code update conflicts with its current state',
  )
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() i: UpdateVesselCodeDto,
  ) {
    return this.service.update(id, i);
  }
  @Patch(':id/deactivate')
  @FinalPermissions(PermissionCode.DEACTIVATE_REFERENCE_DATA_OPTION)
  @ApiOperation({ summary: 'Deactivate vessel code by ID' })
  @ApiParam({ name: 'id', description: 'Vessel Code OptionValue ID' })
  @ResponseMessage('Vessel code deactivated successfully')
  @ApiStandardOkResponse(VesselCodeResponseDto, 'Vessel code deactivated')
  @ApiStandardNotFoundResponse('Vessel code was not found')
  @ApiStandardConflictResponse('Vessel code is already inactive')
  deactivate(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.deactivate(id);
  }
  @Patch(':id/reactivate')
  @FinalPermissions(PermissionCode.REACTIVATE_REFERENCE_DATA_OPTION)
  @ApiOperation({ summary: 'Reactivate vessel code by ID' })
  @ApiParam({ name: 'id', description: 'Vessel Code OptionValue ID' })
  @ResponseMessage('Vessel code reactivated successfully')
  @ApiStandardOkResponse(VesselCodeResponseDto, 'Vessel code reactivated')
  @ApiStandardNotFoundResponse('Vessel code was not found')
  @ApiStandardConflictResponse('Vessel code is already active')
  reactivate(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.reactivate(id);
  }
}
