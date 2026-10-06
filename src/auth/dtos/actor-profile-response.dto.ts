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
  @ApiProperty() isActive!: boolean;
}
