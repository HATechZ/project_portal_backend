import { ApiProperty } from '@nestjs/swagger';

export class ActorProfileResponseDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ format: 'uuid' }) roleId!: string;
  @ApiProperty() roleCode!: string;
  @ApiProperty() label!: string;
  @ApiProperty({ format: 'uuid', nullable: true }) memberId!: string | null;
  @ApiProperty({ format: 'uuid', nullable: true })
  clientContactId!: string | null;
  @ApiProperty() isDefault!: boolean;
  @ApiProperty() isActive!: boolean;
}
