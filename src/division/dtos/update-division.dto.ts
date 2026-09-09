import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
  ValidateIf,
} from 'class-validator';

export class UpdateDivisionDto {
  // DivisionService enforces at least one defined update field.
  @ApiPropertyOptional({ minLength: 1, maxLength: 180 })
  @ValidateIf((_object, value: unknown) => value !== undefined)
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MinLength(1)
  @MaxLength(180)
  name?: string;

  @ApiPropertyOptional({ minLength: 1, maxLength: 30 })
  @ValidateIf((_object, value: unknown) => value !== undefined)
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MinLength(1)
  @MaxLength(30)
  abbr?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @Transform(({ value }: { value: unknown }) =>
    value === '' ? undefined : value,
  )
  @ValidateIf((_object, value: unknown) => value !== undefined)
  @IsUUID()
  divisionTypeId?: string;
}
