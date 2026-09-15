import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Put,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiParam, ApiSecurity, ApiTags } from '@nestjs/swagger';
import { AccessTokenGuard } from '../common/security/access-token.guard';
import { AuthenticationGuard } from '../common/security/authentication.guard';
import { SystemAdminGuard } from '../common/security/system-admin.guard';
import {
  ApiStandardBadRequestResponse,
  ApiStandardArrayResponse,
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
  @ApiOperation({ summary: 'List roles with their tenant permission grants' })
  @ApiStandardArrayResponse(RoleResponseDto)
  findRoles() {
    return this.service.findRoles();
  }

  @Get('role/:id')
  @ResponseMessage('Role returned successfully')
  @ApiOperation({ summary: 'Get a role with its tenant permission grants' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiStandardOkResponse(RoleResponseDto)
  @ApiStandardNotFoundResponse('Role was not found')
  findRole(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.findRole(id);
  }

  @Put('role/:id/permission')
  @ResponseMessage('Role permissions updated successfully')
  @ApiOperation({
    summary: 'Replace the complete permission set for a role in this tenant',
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
    summary: 'List UI-visible workflow permission definitions',
  })
  @ApiStandardArrayResponse(PermissionResponseDto)
  findPermissions() {
    return this.service.findPermissions();
  }

  @Get('permission/:id')
  @ResponseMessage('Permission returned successfully')
  @ApiOperation({ summary: 'Get a workflow permission definition' })
  @ApiStandardOkResponse(PermissionResponseDto)
  @ApiStandardNotFoundResponse('Permission was not found')
  findPermission(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.findPermission(id);
  }
}
