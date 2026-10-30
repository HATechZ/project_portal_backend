import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmpty,
  IsIn,
  IsNotEmpty,
  IsOptional,
  ValidateIf,
} from 'class-validator';
import { PermissionCategory } from '../../generated/prisma/client';
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

  @ApiPropertyOptional({
    enum: PermissionCategory,
    description:
      'Optional work-area filter. It is valid only with customRole=true and scope; the response still contains only permissions compatible with that scope.',
  })
  @ValidateIf((query: PermissionQueryDto) => query.customRole !== 'true')
  @IsEmpty({ message: 'module requires customRole=true.' })
  @ValidateIf((query: PermissionQueryDto) => query.customRole === 'true')
  @IsIn(Object.values(PermissionCategory))
  module?: PermissionCategory;
}
