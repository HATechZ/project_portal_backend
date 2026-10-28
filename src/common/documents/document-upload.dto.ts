import { Transform } from 'class-transformer';
import { IsDefined, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

const array = ({ value }: { value: unknown }) =>
  Array.isArray(value)
    ? value.map((item) => (typeof item === 'string' ? item : String(item)))
    : value === undefined || value === ''
      ? []
      : [value as string];

export class DocumentUploadMultipartDto {
  @ApiProperty({ type: String, format: 'uuid', isArray: true })
  @IsDefined()
  @Transform(array)
  @IsUUID(undefined, { each: true })
  documentCodeIds!: string[];

  @ApiPropertyOptional({ type: String, isArray: true, maxLength: 10000 })
  @IsOptional()
  @Transform(array)
  @IsString({ each: true })
  @MaxLength(10000, { each: true })
  descriptions?: string[];

  @ApiPropertyOptional({ type: String, isArray: true, maxLength: 10 })
  @IsOptional()
  @Transform(array)
  @IsString({ each: true })
  @MaxLength(10, { each: true })
  shipmentNumbers?: string[];
}
