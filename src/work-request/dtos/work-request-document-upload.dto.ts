import { Transform } from 'class-transformer';
import { IsDefined, IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { WorkRequestDocumentMetadataDto } from './work-request.dto';

const array = ({ value }: { value: unknown }) =>
  Array.isArray(value)
    ? value.map((item) => (typeof item === 'string' ? item : String(item)))
    : value === undefined || value === ''
      ? []
      : [value as string];

/** Multipart contract for new Work Request logical documents only. */
export class WorkRequestDocumentUploadMultipartDto extends WorkRequestDocumentMetadataDto {
  @ApiProperty({ type: String, format: 'uuid', isArray: true })
  @IsDefined()
  @Transform(array)
  @IsUUID(undefined, { each: true })
  documentCodeIds!: string[];
}
