import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  ArrayNotContains,
  ArrayUnique,
  IsArray,
  IsEnum,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { DocumentGroupCode } from '../../generated/prisma/client';

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

  @ApiPropertyOptional({
    enum: DocumentGroupCode,
    isArray: true,
    description:
      'Non-GENERAL Document Code groups allowed for this Division. GENERAL is implicit for eligible uploads.',
  })
  @ValidateIf((_object, value: unknown) => value !== undefined)
  @IsArray()
  @ArrayUnique()
  @ArrayNotContains([DocumentGroupCode.GENERAL])
  @IsEnum(DocumentGroupCode, { each: true })
  documentGroups?: DocumentGroupCode[];
}
