import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiNoContentResponse,
  ApiOperation,
  ApiParam,
  ApiSecurity,
  ApiTags,
} from '@nestjs/swagger';
import {
  ApiStandardBadRequestResponse,
  ApiStandardConflictResponse,
  ApiStandardCreatedResponse,
  ApiStandardForbiddenResponse,
  ApiStandardNotFoundResponse,
  ApiStandardOkResponse,
  ApiStandardUnauthorizedResponse,
} from '../common/decorators/api-standard-response.decorator';
import { ResponseMessage } from '../common/decorators/response-message.decorator';
import { PaginationQueryDto } from '../common/pagination/dtos/pagination-query.dto';
import { AccessTokenGuard } from '../common/security/access-token.guard';
import { AuthenticationGuard } from '../common/security/authentication.guard';
import { FinalPermissions } from '../common/security/final-permissions.decorator';
import { FinalPermissionsGuard } from '../common/security/final-permissions.guard';
import { ApiPaginatedResponse } from '../common/swagger/api-paginated-response.decorator';
import { TenantContextGuard } from '../common/tenant/tenant-context.guard';
import { PermissionCode } from '../generated/prisma/client';
import { DivisionService } from './division.service';
import {
  CreateDivisionDto,
  DivisionResponseDto,
  UpdateDivisionDto,
} from './dtos';

@ApiTags('division')
@ApiSecurity('bearer')
@Controller('division')
@UseGuards(
  AccessTokenGuard,
  TenantContextGuard,
  AuthenticationGuard,
  FinalPermissionsGuard,
)
@ApiStandardBadRequestResponse()
@ApiStandardUnauthorizedResponse()
@ApiStandardForbiddenResponse('explicit permission required')
@ApiStandardNotFoundResponse('Division was not found')
@ApiStandardConflictResponse('Division request conflicts with current data')
export class DivisionController {
  constructor(private readonly divisionService: DivisionService) {}

  @Post()
  @FinalPermissions(PermissionCode.CREATE_DIVISION)
  @ResponseMessage('Division created successfully')
  @ApiOperation({ summary: 'Create a Division' })
  @ApiStandardCreatedResponse(DivisionResponseDto, 'Division created')
  create(@Body() input: CreateDivisionDto) {
    return this.divisionService.create(input);
  }

  @Get()
  @FinalPermissions(PermissionCode.VIEW_DIVISIONS)
  @ResponseMessage('Divisions returned successfully')
  @ApiOperation({ summary: 'List Divisions' })
  @ApiPaginatedResponse(DivisionResponseDto)
  findAll(@Query() query: PaginationQueryDto) {
    return this.divisionService.findAll(query);
  }

  @Get(':id')
  @FinalPermissions(PermissionCode.VIEW_DIVISIONS)
  @ResponseMessage('Division returned successfully')
  @ApiOperation({ summary: 'Get a Division by ID' })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  @ApiStandardOkResponse(DivisionResponseDto, 'Division returned')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.divisionService.findOne(id);
  }

  @Patch(':id')
  @FinalPermissions(PermissionCode.UPDATE_DIVISION)
  @ResponseMessage('Division updated successfully')
  @ApiOperation({ summary: 'Update a Division' })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  @ApiStandardOkResponse(DivisionResponseDto, 'Division updated')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() input: UpdateDivisionDto,
  ) {
    return this.divisionService.update(id, input);
  }

  @Delete(':id')
  @FinalPermissions(PermissionCode.DELETE_DIVISION)
  @HttpCode(204)
  @ResponseMessage('Division deleted successfully')
  @ApiOperation({ summary: 'Delete a Division' })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  @ApiNoContentResponse({ description: 'Division deleted' })
  delete(@Param('id', ParseUUIDPipe) id: string) {
    return this.divisionService.delete(id);
  }
}
