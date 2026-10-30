import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  CustomRoleScope,
  PermissionActionType,
  PermissionCategory,
  PermissionCode,
} from '../../generated/prisma/client';

export class PermissionResponseDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ enum: PermissionCode }) code!: PermissionCode;
  @ApiProperty() displayName!: string;
  @ApiPropertyOptional({ nullable: true }) description!: string | null;
  @ApiProperty({ enum: PermissionCategory }) category!: PermissionCategory;
  @ApiProperty({
    enum: PermissionCategory,
    description:
      'Permission work area. This is catalogue metadata only and never grants authorization.',
  })
  module!: PermissionCategory;
  @ApiProperty({ enum: PermissionActionType })
  actionType!: PermissionActionType;
  @ApiProperty() resource!: string;
  @ApiProperty({ enum: CustomRoleScope, isArray: true })
  compatibleScopes!: CustomRoleScope[];
}

export class RoleResponseDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty() code!: string;
  @ApiProperty() name!: string;
  @ApiPropertyOptional({ nullable: true }) description!: string | null;
  @ApiProperty() isSystemRole!: boolean;
  @ApiPropertyOptional({
    enum: CustomRoleScope,
    nullable: true,
  })
  scope!: string | null;
  @ApiProperty({ format: 'date-time' }) createdAt!: Date;
  @ApiProperty({ type: () => PermissionResponseDto, isArray: true })
  permissions!: PermissionResponseDto[];
}

export class UserRoleAssignmentResponseDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ format: 'uuid' }) userId!: string;
  @ApiProperty({ format: 'uuid' }) roleId!: string;
  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  teamId!: string | null;
  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  assignedByUserId!: string | null;
  @ApiProperty({ format: 'date-time' }) assignedAt!: Date;
  @ApiPropertyOptional({ format: 'date-time', nullable: true })
  revokedAt!: Date | null;
  @ApiProperty({ type: () => RoleResponseDto }) role!: RoleResponseDto;
}
