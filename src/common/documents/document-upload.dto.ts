import { Transform } from 'class-transformer';
import { IsDefined, IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

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
}
