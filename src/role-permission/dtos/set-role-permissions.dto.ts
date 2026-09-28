import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ArrayUnique, IsArray, IsEnum, IsOptional } from 'class-validator';
import { WorkflowActionCode } from '../../generated/prisma/client';
import {
  CUSTOM_ROLE_SCOPES,
  type CustomRoleScope,
} from '../providers/custom-role-policy';

export class SetRolePermissionsDto {
  @ApiProperty({ enum: WorkflowActionCode, isArray: true })
  @IsArray()
  @ArrayUnique()
  @IsEnum(WorkflowActionCode, { each: true })
  permissionCodes!: WorkflowActionCode[];

  @ApiPropertyOptional({
    enum: CUSTOM_ROLE_SCOPES,
    description:
      'Optional replacement scope for a custom role. System-role scope cannot be changed.',
  })
  @IsOptional()
  @IsEnum(CUSTOM_ROLE_SCOPES)
  scope?: CustomRoleScope;
}
