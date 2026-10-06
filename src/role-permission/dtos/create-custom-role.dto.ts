import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';
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

  @ApiProperty({ format: 'uuid', isArray: true })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayUnique()
  @IsUUID('4', { each: true })
  permissionIds!: string[];
}
