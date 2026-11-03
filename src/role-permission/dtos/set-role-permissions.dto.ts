import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayUnique,
  IsArray,
  IsEnum,
  IsUUID,
  ValidateIf,
} from 'class-validator';
import {
  CUSTOM_ROLE_SCOPES,
  type CustomRoleScope,
} from '../providers/custom-role-policy';

export class SetRolePermissionsDto {
  @ApiPropertyOptional({
    format: 'uuid',
    isArray: true,
    description: 'Omit to preserve current grants when changing scope.',
  })
  @ValidateIf(
    (input: SetRolePermissionsDto) =>
      input.permissionIds !== undefined || input.scope === undefined,
  )
  @IsArray()
  @ArrayUnique()
  @IsUUID('4', { each: true })
  permissionIds?: string[];

  @ApiPropertyOptional({
    enum: CUSTOM_ROLE_SCOPES,
    description:
      'Optional replacement scope for a custom role. System-role scope cannot be changed.',
  })
  @ValidateIf((input: SetRolePermissionsDto) => input.scope !== undefined)
  @IsEnum(CUSTOM_ROLE_SCOPES)
  scope?: CustomRoleScope;
}
