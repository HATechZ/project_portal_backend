import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayUnique,
  IsArray,
  IsEnum,
  IsOptional,
  IsUUID,
} from 'class-validator';
import {
  CUSTOM_ROLE_SCOPES,
  type CustomRoleScope,
} from '../providers/custom-role-policy';

export class SetRolePermissionsDto {
  @ApiProperty({ format: 'uuid', isArray: true })
  @IsArray()
  @ArrayUnique()
  @IsUUID('4', { each: true })
  permissionIds!: string[];

  @ApiPropertyOptional({
    enum: CUSTOM_ROLE_SCOPES,
    description:
      'Optional replacement scope for a custom role. System-role scope cannot be changed.',
  })
  @IsOptional()
  @IsEnum(CUSTOM_ROLE_SCOPES)
  scope?: CustomRoleScope;
}
