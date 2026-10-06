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
  CargoCodeInputDto,
  CargoCodeQueryDto,
  CargoCodeResponseDto,
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
  FinalPermissionsGuard,
)
@ApiStandardBadRequestResponse()
@ApiStandardUnauthorizedResponse()
@ApiStandardForbiddenResponse()
export class CargoCodeController {
  constructor(private readonly service: CargoCodeService) {}
  @Get()
  @FinalPermissions(PermissionCode.VIEW_REFERENCE_DATA)
  @ApiOperation({ summary: 'List all cargo codes' })
  @ResponseMessage('Cargo codes returned successfully')
  @ApiStandardArrayResponse(CargoCodeResponseDto, 'Cargo codes returned')
  findAll(@Query() q: CargoCodeQueryDto) {
    return this.service.findAll(q.includeInactive);
  }
  @Get('deactivated')
  @FinalPermissions(PermissionCode.VIEW_REFERENCE_DATA)
  @ApiOperation({ summary: 'List deactivated cargo codes' })
  @ResponseMessage('Deactivated cargo codes returned successfully')
  @ApiStandardArrayResponse(
    CargoCodeResponseDto,
    'Deactivated cargo codes returned',
  )
  findDeactivated() {
    return this.service.findDeactivated();
  }
  @Get(':id')
  @FinalPermissions(PermissionCode.VIEW_REFERENCE_DATA)
  @ApiOperation({ summary: 'Get cargo code by ID' })
  @ApiParam({ name: 'id', description: 'Cargo Code OptionValue ID' })
  @ResponseMessage('Cargo code returned successfully')
  @ApiStandardOkResponse(CargoCodeResponseDto, 'Cargo code returned')
  @ApiStandardNotFoundResponse('Cargo code was not found')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.findOne(id);
  }
  @Post()
  @ApiOperation({ summary: 'Create a new cargo code' })
  @ResponseMessage('Cargo code created successfully')
  @ApiStandardCreatedResponse(CargoCodeResponseDto, 'Cargo code created')
  @ApiStandardConflictResponse(
    'A cargo code with the same name or code already exists',
  )
  @FinalPermissions(PermissionCode.CREATE_REFERENCE_DATA_OPTION)
  create(@Body() i: CargoCodeInputDto) {
    return this.service.create(i);
  }
  @Patch(':id')
  @FinalPermissions(PermissionCode.UPDATE_REFERENCE_DATA_OPTION)
  @ApiOperation({ summary: 'Update cargo code by ID' })
  @ApiParam({ name: 'id', description: 'Cargo Code OptionValue ID' })
  @ResponseMessage('Cargo code updated successfully')
  @ApiStandardOkResponse(CargoCodeResponseDto, 'Cargo code updated')
  @ApiStandardNotFoundResponse('Cargo code was not found')
  @ApiStandardConflictResponse(
    'Cargo code update conflicts with its current state',
  )
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() i: UpdateCargoCodeDto,
  ) {
    return this.service.update(id, i);
  }
  @Patch(':id/deactivate')
  @ApiOperation({ summary: 'Deactivate cargo code by ID' })
  @ApiParam({ name: 'id', description: 'Cargo Code OptionValue ID' })
  @ResponseMessage('Cargo code deactivated successfully')
  @ApiStandardOkResponse(CargoCodeResponseDto, 'Cargo code deactivated')
  @ApiStandardNotFoundResponse('Cargo code was not found')
  @ApiStandardConflictResponse('Cargo code is already inactive')
  @FinalPermissions(PermissionCode.DEACTIVATE_REFERENCE_DATA_OPTION)
  deactivate(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.deactivate(id);
  }
  @Patch(':id/reactivate')
  @ApiOperation({ summary: 'Reactivate cargo code by ID' })
  @ApiParam({ name: 'id', description: 'Cargo Code OptionValue ID' })
  @ResponseMessage('Cargo code reactivated successfully')
  @ApiStandardOkResponse(CargoCodeResponseDto, 'Cargo code reactivated')
  @ApiStandardNotFoundResponse('Cargo code was not found')
  @ApiStandardConflictResponse('Cargo code is already active')
  @FinalPermissions(PermissionCode.REACTIVATE_REFERENCE_DATA_OPTION)
  reactivate(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.reactivate(id);
  }
}
