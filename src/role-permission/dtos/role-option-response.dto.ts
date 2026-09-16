import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class RoleOptionResponseDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty() code!: string;
  @ApiProperty() name!: string;
  @ApiPropertyOptional({ nullable: true }) description!: string | null;
  @ApiProperty() isSystemRole!: boolean;
  @ApiPropertyOptional({ enum: ['division', 'company'], nullable: true })
  scope!: string | null;
}
