import { Transform } from 'class-transformer';
import {
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;
const array = ({ value }: { value: unknown }) =>
  value === undefined || value === ''
    ? undefined
    : Array.isArray(value)
      ? value
      : [value];

export const WORK_REQUEST_PRIORITIES = ['Low', 'Medium', 'High'] as const;
export type WorkRequestPriority = (typeof WORK_REQUEST_PRIORITIES)[number];

export class CreateWorkRequestDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  bidId?: string;
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  projectId?: string;
  @ApiProperty()
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(260)
  title!: string;
  @ApiProperty({ enum: WORK_REQUEST_PRIORITIES })
  @IsIn(WORK_REQUEST_PRIORITIES)
  priority!: WorkRequestPriority;
  @ApiPropertyOptional()
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(10000)
  notes?: string;
  @ApiPropertyOptional({ type: String, format: 'uuid', isArray: true })
  @IsOptional()
  @Transform(array)
  @IsUUID(undefined, { each: true })
  documentCodeIds?: string[];
}

export class UpdateWorkRequestDto {
  @ApiPropertyOptional()
  @IsOptional()
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(260)
  title?: string;
  @ApiPropertyOptional({ enum: WORK_REQUEST_PRIORITIES })
  @IsOptional()
  @IsIn(WORK_REQUEST_PRIORITIES)
  priority?: WorkRequestPriority;
  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(10000)
  notes?: string;
}

export class WorkRequestResponseDto {
  @ApiProperty() id!: string;
  @ApiPropertyOptional({ format: 'uuid' }) bidId!: string | null;
  @ApiPropertyOptional({ format: 'uuid' }) projectId!: string | null;
  @ApiProperty() title!: string;
  @ApiProperty({ enum: WORK_REQUEST_PRIORITIES })
  priority!: WorkRequestPriority;
  @ApiPropertyOptional() notes!: string | null;
  @ApiProperty({ type: Object, nullable: true }) creator!: {
    id: string;
    label: string;
  } | null;
  @ApiProperty() currentState!: string;
  @ApiProperty({ type: [Object] }) documents!: {
    id: string;
    documentCodeId: string | null;
    documentCode: string | null;
    originalFileName: string;
    generatedFileName: string | null;
    mimeType: string;
    size: number;
  }[];
  @ApiProperty({ type: [Object] }) availableActions!: unknown[];
  @ApiProperty() createdAt!: Date;
  @ApiProperty() updatedAt!: Date;
}
