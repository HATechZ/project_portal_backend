import { IsArray, IsOptional, IsUUID } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class WorkRequestDocumentDownloadDto {
  @ApiPropertyOptional({
    type: String,
    format: 'uuid',
    isArray: true,
    description:
      'Exact Work Request document-version IDs. Omit or provide [] to download all versions belonging to the Work Request.',
  })
  @IsOptional()
  @IsArray()
  @IsUUID(undefined, { each: true })
  documentVersionIds?: string[];
}
