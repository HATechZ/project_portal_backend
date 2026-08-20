import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  MinLength,
} from 'class-validator';
import { Transform } from 'class-transformer';

export class CreateUserDto {
  @ApiProperty({ example: 'Jane Doe', maxLength: 160 })
  @IsString()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @MinLength(1)
  @MaxLength(160)
  fullName!: string;

  @ApiProperty({ example: 'jane@example.com' })
  @IsEmail()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @MaxLength(255)
  email!: string;

  @ApiProperty({
    example: 'secret7',
    minLength: 6,
    maxLength: 8,
  })
  @IsString()
  @MinLength(6)
  @MaxLength(8)
  password!: string;

  @ApiPropertyOptional({
    example: 'https://example.com/avatar.jpg',
    nullable: true,
  })
  @IsOptional()
  @IsUrl({ require_protocol: true })
  @MaxLength(2048)
  avatarUrl?: string | null;
}
