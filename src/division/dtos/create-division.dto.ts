import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
  ValidateIf,
} from 'class-validator';

export class CreateDivisionDto {
  @ApiProperty({ minLength: 1, maxLength: 180 })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MinLength(1)
  @MaxLength(180)
  name!: string;

  @ApiProperty({ minLength: 1, maxLength: 30 })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MinLength(1)
  @MaxLength(30)
  abbr!: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @Transform(({ value }: { value: unknown }) =>
    value === '' ? undefined : value,
  )
  @ValidateIf((_object, value: unknown) => value !== undefined)
  @IsUUID()
  divisionTypeId?: string;
}
