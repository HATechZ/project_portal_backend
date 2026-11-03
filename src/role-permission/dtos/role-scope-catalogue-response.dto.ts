import { ApiProperty } from '@nestjs/swagger';
import {
  CUSTOM_ROLE_SCOPES,
  type CustomRoleScope,
} from '../providers/custom-role-policy';

export class RoleScopeCatalogueResponseDto {
  @ApiProperty({ enum: CUSTOM_ROLE_SCOPES, isArray: true })
  scopes!: CustomRoleScope[];
}
