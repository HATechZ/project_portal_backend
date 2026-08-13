import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateUserDto {
  @ApiProperty({ example: 'Jane Doe', maxLength: 160 })
  @IsString()
  @MaxLength(160)
  fullName!: string;

  @ApiProperty({ example: 'jane@example.com' })
  @IsEmail()
  @MaxLength(320)
  email!: string;

  @ApiPropertyOptional({ example: 'https://example.com/avatar.jpg' })
  @IsOptional()
  @IsString()
  avatarUrl?: string;
}
