import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CustomRoleScope } from '../../generated/prisma/client';

export class RoleOptionResponseDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty() code!: string;
  @ApiProperty() name!: string;
  @ApiPropertyOptional({ nullable: true }) description!: string | null;
  @ApiProperty() isSystemRole!: boolean;
  @ApiPropertyOptional({ enum: CustomRoleScope, nullable: true })
  scope!: string | null;
}
