import { Transform } from 'class-transformer';
import {
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  IsInt,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export class CreateProjectDto {
  @ApiProperty()
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(220)
  name!: string;
  @ApiProperty({ format: 'uuid' }) @IsUUID() clientId!: string;
}
const multipartArray = ({ value }: { value: unknown }) =>
  value === undefined || value === ''
    ? undefined
    : Array.isArray(value)
      ? value
      : [value];
export class CreateProjectMultipartDto {
  @ApiProperty({ example: 'Offshore Installation Project' })
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(220)
  name!: string;
  @ApiProperty({ format: 'uuid' }) @IsUUID() clientId!: string;
  @ApiPropertyOptional({
    type: String,
    format: 'uuid',
    isArray: true,
    description: 'One Document Code ID for each uploaded file, in file order.',
  })
  @IsOptional()
  @Transform(multipartArray)
  @IsUUID(undefined, { each: true })
  documentCodeOptionIds?: string[];
}
export class ProjectDocumentInputDto {
  @ApiProperty({ minimum: 0 }) @IsInt() @Min(0) fileIndex!: number;
  @ApiProperty({ format: 'uuid' }) @IsUUID() documentCodeOptionId!: string;
}
export class UpdateProjectDto {
  @ApiPropertyOptional()
  @IsOptional()
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(220)
  name?: string;
}
export class ReclassifyProjectDocumentDto {
  @ApiProperty({ format: 'uuid' }) @IsUUID() documentCodeOptionId!: string;
}
export class ReclassifiedProjectDocumentResponseDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty() originalFileName!: string;
  @ApiPropertyOptional({ nullable: true }) generatedFileName!: string | null;
  @ApiProperty({ format: 'uuid' }) documentCodeOptionId!: string;
}
export class ProjectFileMetadataDto {
  @ApiProperty({ format: 'uuid' }) @IsUUID() documentCodeOptionId!: string;
}
export class ProjectResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() name!: string;
  @ApiProperty() clientId!: string;
  @ApiProperty() status!: string;
  @ApiProperty() fileCount!: number;
  @ApiProperty({ type: () => ProjectDocumentResponseDto, isArray: true })
  documents!: ProjectDocumentResponseDto[];
  @ApiProperty() createdAt!: Date;
  @ApiProperty() updatedAt!: Date;
}
export class ProjectDocumentResponseDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ format: 'uuid' }) documentCodeOptionId!: string;
  @ApiProperty() originalFileName!: string;
  @ApiPropertyOptional({ nullable: true }) generatedFileName!: string | null;
  @ApiProperty() storageKey!: string;
  @ApiProperty() mimeType!: string;
  @ApiProperty() size!: number;
}
