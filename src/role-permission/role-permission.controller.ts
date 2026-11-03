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
import { FinalPermissions } from '../common/security/final-permissions.decorator';
import { FinalPermissionsGuard } from '../common/security/final-permissions.guard';
import { PermissionCode } from '../generated/prisma/client';
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
  PermissionQueryDto,
  RoleResponseDto,
  SetRolePermissionsDto,
  CreateCustomRoleDto,
} from './dtos';
import { RolePermissionService } from './role-permission.service';
import { RoleScopeCatalogueResponseDto } from './dtos/role-scope-catalogue-response.dto';

@ApiTags('role & permission')
@ApiSecurity('bearer')
@Controller()
@UseGuards(
  AccessTokenGuard,
  TenantContextGuard,
  AuthenticationGuard,
  FinalPermissionsGuard,
)
@ApiStandardBadRequestResponse()
@ApiStandardUnauthorizedResponse()
@ApiStandardForbiddenResponse('explicit permission required')
export class RolePermissionController {
  constructor(private readonly service: RolePermissionService) {}

  @Get('role')
  @FinalPermissions(PermissionCode.VIEW_ROLES)
  @ResponseMessage('Roles returned successfully')
  @ApiOperation({ summary: 'List available roles' })
  @ApiStandardArrayResponse(RoleResponseDto)
  findRoles() {
    return this.service.findRoles();
  }

  @Post('role')
  @FinalPermissions(PermissionCode.CREATE_ROLE)
  @ResponseMessage('Custom role created successfully')
  @ApiOperation({ summary: 'Create a custom role' })
  @ApiStandardCreatedResponse(RoleResponseDto)
  createRole(@Body() input: CreateCustomRoleDto) {
    return this.service.createCustomRole(input);
  }

  @Get('role/scope')
  @FinalPermissions(PermissionCode.VIEW_ROLES)
  @ResponseMessage('Role scopes returned successfully')
  @ApiOperation({
    summary: 'List supported role scopes',
    description:
      'System scope catalogue for Create Role and Manage Role Permissions, independent of existing roles. Use permission compatibleScopes to determine which permissions support each scope.',
  })
  @ApiStandardOkResponse(RoleScopeCatalogueResponseDto)
  findRoleScopes() {
    return this.service.findRoleScopes();
  }

  @Get('role/:id')
  @FinalPermissions(PermissionCode.VIEW_ROLES)
  @ResponseMessage('Role returned successfully')
  @ApiOperation({ summary: 'Get role details' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiStandardOkResponse(RoleResponseDto)
  @ApiStandardNotFoundResponse('Role was not found')
  findRole(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.findRole(id);
  }

  @Put('role/:id/permission')
  @FinalPermissions(PermissionCode.UPDATE_ROLE)
  @ResponseMessage('Role permissions updated successfully')
  @ApiOperation({
    summary: 'Update permissions for a role',
    description:
      'Updates a tenant custom role scope and optionally replaces its permissions atomically. Omit permissionIds to retain and revalidate current grants. Incompatible permissions or existing assignment bindings return validation details. System roles are bootstrap-managed.',
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
  @FinalPermissions(PermissionCode.VIEW_ROLES)
  @ResponseMessage('Permissions returned successfully')
  @ApiOperation({
    summary: 'List available permissions',
    description:
      'Use customRole=true with a system-defined scope to receive only permissions compatible with that exact scope. Each permission exposes module (the persisted work-area category) and compatibleScopes. Optionally supply module to select one work area. Without customRole=true, the final permission catalogue is returned.',
  })
  @ApiStandardArrayResponse(PermissionResponseDto)
  findPermissions(@Query() query: PermissionQueryDto) {
    return this.service.findPermissions(
      query.customRole === 'true',
      query.scope,
      query.module,
    );
  }

  @Get('permission/:id')
  @FinalPermissions(PermissionCode.VIEW_ROLES)
  @ResponseMessage('Permission returned successfully')
  @ApiOperation({ summary: 'Get permission details' })
  @ApiStandardOkResponse(PermissionResponseDto)
  @ApiStandardNotFoundResponse('Permission was not found')
  findPermission(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.findPermission(id);
  }
}
