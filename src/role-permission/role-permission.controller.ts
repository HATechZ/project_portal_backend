import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseBoolPipe,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiNoContentResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiSecurity,
  ApiTags,
} from '@nestjs/swagger';
import { ActiveUser } from '../common/security/active-user.decorator';
import { AccessTokenGuard } from '../common/security/access-token.guard';
import { AuthenticationGuard } from '../common/security/authentication.guard';
import { SystemAdminGuard } from '../common/security/system-admin.guard';
import type { SessionUser } from '../common/security/session.types';
import {
  ApiStandardBadRequestResponse,
  ApiStandardArrayResponse,
  ApiStandardConflictResponse,
  ApiStandardCreatedResponse,
  ApiStandardForbiddenResponse,
  ApiStandardNotFoundResponse,
  ApiStandardOkResponse,
  ApiStandardUnauthorizedResponse,
} from '../common/decorators/api-standard-response.decorator';
import { TenantContextGuard } from '../common/tenant/tenant-context.guard';
import { ResponseMessage } from '../common/decorators/response-message.decorator';
import {
  AssignUserRoleDto,
  PermissionResponseDto,
  RoleResponseDto,
  SetRolePermissionsDto,
  UserRoleAssignmentResponseDto,
} from './dtos';
import { RolePermissionService } from './role-permission.service';

@ApiTags('role & permission')
@ApiSecurity({ bearer: [], tenant: [] })
@Controller()
@UseGuards(
  TenantContextGuard,
  AccessTokenGuard,
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

  @Get('user/:userId/role')
  @ResponseMessage('User roles returned successfully')
  @ApiOperation({ summary: "List a user's role assignments" })
  @ApiQuery({ name: 'includeRevoked', required: false, type: Boolean })
  @ApiStandardArrayResponse(UserRoleAssignmentResponseDto)
  @ApiStandardNotFoundResponse('User was not found')
  findUserRoles(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Query('includeRevoked', new ParseBoolPipe({ optional: true }))
    includeRevoked = false,
  ) {
    return this.service.findUserRoles(userId, includeRevoked);
  }

  @Post('user/:userId/role')
  @ResponseMessage('Role assigned successfully')
  @ApiOperation({ summary: 'Assign a role to a user' })
  @ApiStandardCreatedResponse(UserRoleAssignmentResponseDto, 'Role assigned')
  @ApiStandardNotFoundResponse('User or role was not found')
  @ApiStandardConflictResponse('The user already has this role')
  assignUserRole(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Body() input: AssignUserRoleDto,
    @ActiveUser() activeUser: SessionUser,
  ) {
    return this.service.assignUserRole(userId, input, activeUser.id);
  }

  @Delete('user/:userId/role/:roleId')
  @ResponseMessage('Role revoked successfully')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Revoke an active role assignment' })
  @ApiNoContentResponse({ description: 'Role revoked' })
  @ApiStandardNotFoundResponse('User, role, or active assignment was not found')
  @ApiStandardConflictResponse(
    'Cannot revoke your own or the final active administrator role',
  )
  revokeUserRole(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Param('roleId', ParseUUIDPipe) roleId: string,
    @ActiveUser() activeUser: SessionUser,
  ) {
    return this.service.revokeUserRole(userId, roleId, activeUser.id);
  }
}
