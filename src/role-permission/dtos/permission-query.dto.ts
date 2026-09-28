import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsNotEmpty, IsOptional, ValidateIf } from 'class-validator';
import { CUSTOM_ROLE_SCOPES, type CustomRoleScope } from '../providers';

export class PermissionQueryDto {
  @ApiPropertyOptional({
    enum: ['true', 'false'],
    description:
      'Set to true with scope to receive only custom-role permissions eligible for that exact scope.',
  })
  @IsOptional()
  @IsIn(['true', 'false'])
  customRole?: string;

  @ApiPropertyOptional({
    enum: CUSTOM_ROLE_SCOPES,
    description:
      'Required when customRole=true. Results include only permissions eligible for this selected custom-role scope.',
  })
  @ValidateIf((query: PermissionQueryDto) => query.customRole === 'true')
  @IsNotEmpty()
  @IsIn(CUSTOM_ROLE_SCOPES)
  scope?: CustomRoleScope;
}
