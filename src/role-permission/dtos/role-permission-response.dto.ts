import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ActorRoleCode,
  WorkflowActionCode,
} from '../../generated/prisma/client';

export class PermissionResponseDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ enum: WorkflowActionCode }) code!: WorkflowActionCode;
  @ApiProperty() name!: string;
  @ApiPropertyOptional({ nullable: true }) description!: string | null;
  @ApiProperty() isUserVisible!: boolean;
  @ApiProperty() isRevisionAction!: boolean;
  @ApiProperty() isInfoRequestAction!: boolean;
  @ApiProperty() isAssignmentAction!: boolean;
  @ApiProperty() isTerminalAction!: boolean;
}

export class RoleResponseDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ enum: ActorRoleCode }) code!: ActorRoleCode;
  @ApiProperty() name!: string;
  @ApiPropertyOptional({ nullable: true }) description!: string | null;
  @ApiProperty() isSystemRole!: boolean;
  @ApiProperty({ format: 'date-time' }) createdAt!: Date;
  @ApiProperty({ type: () => PermissionResponseDto, isArray: true })
  permissions!: PermissionResponseDto[];
}

export class UserRoleAssignmentResponseDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ format: 'uuid' }) userId!: string;
  @ApiProperty({ format: 'uuid' }) roleId!: string;
  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  assignedByUserId!: string | null;
  @ApiProperty({ format: 'date-time' }) assignedAt!: Date;
  @ApiPropertyOptional({ format: 'date-time', nullable: true })
  revokedAt!: Date | null;
  @ApiProperty({ type: () => RoleResponseDto }) role!: RoleResponseDto;
}
