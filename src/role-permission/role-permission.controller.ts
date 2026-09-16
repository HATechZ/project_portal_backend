import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Put,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiParam, ApiSecurity, ApiTags } from '@nestjs/swagger';
import { AccessTokenGuard } from '../common/security/access-token.guard';
import { AuthenticationGuard } from '../common/security/authentication.guard';
import { SystemAdminGuard } from '../common/security/system-admin.guard';
import {
  ApiStandardBadRequestResponse,
  ApiStandardArrayResponse,
  ApiStandardCreatedResponse,
  ApiStandardForbiddenResponse,
  ApiStandardNotFoundResponse,
  ApiStandardOkResponse,
  ApiStandardUnauthorizedResponse,
} from '../common/decorators/api-standard-response.decorator';
import { TenantContextGuard } from '../common/tenant/tenant-context.guard';
import { ResponseMessage } from '../common/decorators/response-message.decorator';
import {
  PermissionResponseDto,
  RoleResponseDto,
  SetRolePermissionsDto,
  CreateCustomRoleDto,
} from './dtos';
import { RolePermissionService } from './role-permission.service';

@ApiTags('role & permission')
@ApiSecurity('bearer')
@Controller()
@UseGuards(
  AccessTokenGuard,
  TenantContextGuard,
  AuthenticationGuard,
  SystemAdminGuard,
)
@ApiStandardBadRequestResponse()
@ApiStandardUnauthorizedResponse()
@ApiStandardForbiddenResponse('System administrator access required')
export class RolePermissionController {
  constructor(private readonly service: RolePermissionService) {}

  @Get('role')
  @ResponseMessage('Roles returned successfully')
  @ApiOperation({ summary: 'List available roles' })
  @ApiStandardArrayResponse(RoleResponseDto)
  findRoles() {
    return this.service.findRoles();
  }

  @Post('role')
  @ResponseMessage('Custom role created successfully')
  @ApiOperation({ summary: 'Create a custom role' })
  @ApiStandardCreatedResponse(RoleResponseDto)
  createRole(@Body() input: CreateCustomRoleDto) {
    return this.service.createCustomRole(input);
  }

  @Get('role/:id')
  @ResponseMessage('Role returned successfully')
  @ApiOperation({ summary: 'Get role details' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiStandardOkResponse(RoleResponseDto)
  @ApiStandardNotFoundResponse('Role was not found')
  findRole(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.findRole(id);
  }

  @Put('role/:id/permission')
  @ResponseMessage('Role permissions updated successfully')
  @ApiOperation({
    summary: 'Update permissions for a role',
    description:
      'This operation performs full replacement. Permission codes omitted from the request are revoked for this tenant and role.',
  })
  @ApiStandardOkResponse(RoleResponseDto, 'Role permissions replaced')
  @ApiStandardNotFoundResponse('Role was not found')
  setRolePermissions(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() input: SetRolePermissionsDto,
  ) {
    return this.service.setRolePermissions(id, input);
  }

  @Get('permission')
  @ResponseMessage('Permissions returned successfully')
  @ApiOperation({
    summary: 'List available permissions',
  })
  @ApiStandardArrayResponse(PermissionResponseDto)
  findPermissions(
    @Query('customRole') customRole?: string,
    @Query('scope') scope?: string,
  ) {
    return this.service.findPermissions(customRole === 'true', scope);
  }

  @Get('permission/:id')
  @ResponseMessage('Permission returned successfully')
  @ApiOperation({ summary: 'Get permission details' })
  @ApiStandardOkResponse(PermissionResponseDto)
  @ApiStandardNotFoundResponse('Permission was not found')
  findPermission(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.findPermission(id);
  }
}
