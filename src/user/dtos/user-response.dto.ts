import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class UserResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'Jane Doe' })
  fullName!: string;

  @ApiProperty({ example: 'jane@example.com' })
  email!: string;

  @ApiPropertyOptional({ example: 'Bangladesh', nullable: true })
  country!: string | null;

  @ApiPropertyOptional({ example: '+880 1711-234567', nullable: true })
  phone!: string | null;

  @ApiPropertyOptional({
    example: 'https://example.com/avatar.jpg',
    nullable: true,
  })
  avatarUrl!: string | null;

  @ApiProperty({ example: true })
  isActive!: boolean;

  @ApiPropertyOptional({ format: 'date-time', nullable: true })
  lastLoginAt!: Date | null;

  @ApiProperty({ format: 'date-time' })
  createdAt!: Date;

  @ApiProperty({ format: 'date-time' })
  updatedAt!: Date;
}
