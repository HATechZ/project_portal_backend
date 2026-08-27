import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateCompanyDto {
  @ApiProperty({ example: 'Haque & Sons Ltd.', maxLength: 180 })
  @IsString()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @MinLength(1)
  @MaxLength(180)
  name!: string;

  @ApiProperty({ example: 'HSL', maxLength: 30 })
  @IsString()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @MinLength(1)
  @MaxLength(30)
  abbr!: string;

  @ApiPropertyOptional({
    format: 'uuid',
    nullable: true,
    description: 'Optional normalized company type reference.',
  })
  @IsOptional()
  @IsUUID()
  companyTypeId?: string | null;
}
