import { Transform } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;
const code = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim().toUpperCase() : value;
export class VesselCodeInputDto {
  @ApiProperty()
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(180)
  name!: string;
  @ApiProperty()
  @Transform(code)
  @IsString()
  @MinLength(1)
  @MaxLength(40)
  code!: string;
}
export class UpdateVesselCodeDto {
  @ApiPropertyOptional()
  @Transform(trim)
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(180)
  name?: string;
  @ApiPropertyOptional()
  @Transform(code)
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(40)
  code?: string;
}
export class VesselCodeQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    value === 'true' ? true : value === 'false' ? false : value,
  )
  @IsBoolean()
  includeInactive?: boolean;
}
