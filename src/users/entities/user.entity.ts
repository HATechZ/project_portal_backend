import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class UserEntity {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'Jane Doe' })
  fullName!: string;

  @ApiProperty({ example: 'jane@example.com' })
  email!: string;

  @ApiPropertyOptional({
    example: 'https://example.com/avatar.jpg',
    nullable: true,
  })
  avatarUrl!: string | null;

  @ApiProperty() isActive!: boolean;

  @ApiPropertyOptional({ format: 'date-time', nullable: true })
  lastLoginAt!: Date | null;

  @ApiProperty({ example: '2026-08-12T06:00:00.000Z' })
  createdAt!: Date;

  @ApiProperty({ example: '2026-08-12T06:00:00.000Z' })
  updatedAt!: Date;
}
