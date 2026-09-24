import { Transform } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

function code(value: unknown) {
  return typeof value === 'string' ? value.trim().toUpperCase() : value;
}

function name(value: unknown) {
  return typeof value === 'string' ? value.trim() : value;
}

export class EtcDocumentCodeInputDto {
  @ApiProperty({ minLength: 1, maxLength: 20 })
  @Transform(({ value }: { value: unknown }) => code(value))
  @IsString()
  @MinLength(1)
  @MaxLength(20)
  code!: string;

  @ApiProperty({ minLength: 1, maxLength: 180 })
  @Transform(({ value }: { value: unknown }) => name(value))
  @IsString()
  @MinLength(1)
  @MaxLength(180)
  name!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;
}

export class UpdateEtcDocumentCodeDto {
  @ApiPropertyOptional({ minLength: 1, maxLength: 20 })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => code(value))
  @IsString()
  @MinLength(1)
  @MaxLength(20)
  code?: string;

  @ApiPropertyOptional({ minLength: 1, maxLength: 180 })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => name(value))
  @IsString()
  @MinLength(1)
  @MaxLength(180)
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;
}

export class EtcDocumentCodeQueryDto {
  @ApiPropertyOptional({
    enum: ['active', 'inactive', 'all'],
    default: 'active',
  })
  @IsOptional()
  @IsIn(['active', 'inactive', 'all'])
  status: 'active' | 'inactive' | 'all' = 'active';
}

export class EtcDocumentCodeResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() code!: string;
  @ApiProperty() name!: string;
  @ApiPropertyOptional({ nullable: true }) description!: string | null;
  @ApiProperty() sortOrder!: number;
  @ApiProperty() isActive!: boolean;
  @ApiProperty() createdAt!: Date;
  @ApiProperty() updatedAt!: Date;
}
