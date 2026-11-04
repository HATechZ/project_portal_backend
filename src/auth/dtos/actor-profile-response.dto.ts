import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CustomRoleScope } from '../../generated/prisma/client';

export class ActorProfileResponseDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ format: 'uuid' }) roleId!: string;
  @ApiProperty({
    description: 'Display label only; it does not authorize requests.',
  })
  roleCode!: string;
  @ApiPropertyOptional({ enum: CustomRoleScope, nullable: true })
  roleScope!: CustomRoleScope | null;
  @ApiProperty() label!: string;
  @ApiProperty({ format: 'uuid', nullable: true }) memberId!: string | null;
  @ApiProperty({ format: 'uuid', nullable: true })
  clientContactId!: string | null;
  @ApiProperty() isDefault!: boolean;
  @ApiProperty({
    description:
      'True for the one profile used as the acting authorization context. This mirrors isDefault; isActive is lifecycle availability only.',
  })
  isCurrent!: boolean;
  @ApiProperty({
    description:
      'True only for the protected Staff starter fallback profile. This is not an authorization field.',
  })
  isFallback!: boolean;
  @ApiProperty() isActive!: boolean;
}
