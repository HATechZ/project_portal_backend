import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { WorkflowActionCode } from '../../generated/prisma/client';
import {
  CUSTOM_ROLE_SCOPES,
  type CustomRoleScope,
} from '../providers/custom-role-policy';

export class CreateCustomRoleDto {
  @ApiProperty({ example: 'HR Coordinator' })
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name!: string;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ enum: CUSTOM_ROLE_SCOPES })
  @IsEnum(CUSTOM_ROLE_SCOPES)
  scope!: CustomRoleScope;

  @ApiProperty({ enum: WorkflowActionCode, isArray: true })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayUnique()
  @IsEnum(WorkflowActionCode, { each: true })
  permissionCodes!: WorkflowActionCode[];
}
