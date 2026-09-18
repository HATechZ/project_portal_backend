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
  ObjectScopeGuard,
  PermissionsGuard,
)
@Permissions(WorkflowActionCode.UPDATE_SETTINGS)
@ApiStandardBadRequestResponse()
@ApiStandardUnauthorizedResponse()
@ApiStandardForbiddenResponse()
export class CargoCodeController {
  constructor(private readonly service: CargoCodeService) {}
  @Get()
  @ApiOperation({ summary: 'List all cargo codes' })
  @ResponseMessage('Cargo codes returned successfully')
  @ApiStandardArrayResponse(CargoCodeResponseDto, 'Cargo codes returned')
  findAll(@Query() q: CargoCodeQueryDto) {
    return this.service.findAll(q.includeInactive);
  }
  @Get(':id')
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
  create(@Body() i: CargoCodeInputDto, @Req() r: ObjectScopeRequest) {
    return this.service.create(i, r.actorScope!);
  }
  @Patch(':id')
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
    @Req() r: ObjectScopeRequest,
  ) {
    return this.service.update(id, i, r.actorScope!);
  }
  @Patch(':id/deactivate')
  @ApiOperation({ summary: 'Deactivate cargo code by ID' })
  @ApiParam({ name: 'id', description: 'Cargo Code OptionValue ID' })
  @ResponseMessage('Cargo code deactivated successfully')
  @ApiStandardOkResponse(CargoCodeResponseDto, 'Cargo code deactivated')
  @ApiStandardNotFoundResponse('Cargo code was not found')
  @ApiStandardConflictResponse('Cargo code is already inactive')
  deactivate(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() r: ObjectScopeRequest,
  ) {
    return this.service.deactivate(id, r.actorScope!);
  }
  @Patch(':id/reactivate')
  @ApiOperation({ summary: 'Reactivate cargo code by ID' })
  @ApiParam({ name: 'id', description: 'Cargo Code OptionValue ID' })
  @ResponseMessage('Cargo code reactivated successfully')
  @ApiStandardOkResponse(CargoCodeResponseDto, 'Cargo code reactivated')
  @ApiStandardNotFoundResponse('Cargo code was not found')
  @ApiStandardConflictResponse('Cargo code is already active')
  reactivate(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() r: ObjectScopeRequest,
  ) {
    return this.service.reactivate(id, r.actorScope!);
  }
}
