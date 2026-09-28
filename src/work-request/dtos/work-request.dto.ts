import { Transform } from 'class-transformer';
import {
  IsIn,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { WorkflowActionCode } from '../../generated/prisma/client';

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
  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(10000)
  notes?: string;
}

class WorkRequestAssignmentDto {
  @ApiPropertyOptional({ description: 'Optional assignment note.' })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(10000)
  note?: string;
}

export class AssignDivisionDto extends WorkRequestAssignmentDto {
  @ApiProperty({ format: 'uuid', description: 'Division ID' })
  @IsUUID()
  divisionId!: string;
}

export class AssignTeamDto extends WorkRequestAssignmentDto {
  @ApiProperty({ format: 'uuid', description: 'Team ID' })
  @IsUUID()
  teamId!: string;
}

export class AssignMemberDto extends WorkRequestAssignmentDto {
  @ApiProperty({ format: 'uuid', description: 'Member ID' })
  @IsUUID()
  memberId!: string;
}

export class WorkRequestAssignmentResponseDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty() level!: string;
  @ApiPropertyOptional({ format: 'uuid' }) divisionId!: string | null;
  @ApiPropertyOptional({ format: 'uuid' }) teamId!: string | null;
  @ApiPropertyOptional({ format: 'uuid' }) memberId!: string | null;
  @ApiProperty() assignedAt!: Date;
  @ApiProperty() currentState!: string;
}

export class WorkRequestWorkflowNoteDto {
  @ApiPropertyOptional({ description: 'Optional workflow note.' })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(10000)
  note?: string;
}

export class CreateWorkRequestInfoRequestDto {
  @ApiProperty({ format: 'uuid', description: 'Target Actor Profile ID' })
  @IsUUID()
  targetActorId!: string;

  @ApiProperty({ description: 'Clarification message.' })
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(10000)
  message!: string;
}

export class RespondWorkRequestInfoRequestDto {
  @ApiProperty({ description: 'Clarification response message.' })
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(10000)
  message!: string;
}

export class WorkRequestInfoResponseDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ format: 'uuid' }) respondedByActorId!: string;
  @ApiProperty() message!: string;
  @ApiProperty() respondedAt!: Date;
}

export class WorkRequestInfoRequestDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ format: 'uuid' }) requestedByActorId!: string;
  @ApiProperty({ format: 'uuid' }) targetActorId!: string;
  @ApiProperty() message!: string;
  @ApiProperty({ enum: ['OPEN', 'RESPONDED', 'CANCELLED', 'SUPERSEDED'] })
  status!: string;
  @ApiProperty() stateAtRequest!: string;
  @ApiProperty() requestedAt!: Date;
  @ApiPropertyOptional() closedAt!: Date | null;
  @ApiProperty({ type: [WorkRequestInfoResponseDto] })
  responses!: WorkRequestInfoResponseDto[];
}

export class WorkRequestActionDto extends WorkRequestWorkflowNoteDto {
  @ApiPropertyOptional({ format: 'uuid', description: 'Workflow Action ID' })
  @IsOptional()
  @IsUUID()
  actionId?: string;
  @ApiPropertyOptional({ description: 'Stable Workflow Action Code' })
  @IsOptional()
  @IsEnum(WorkflowActionCode)
  actionCode?: WorkflowActionCode;
}

export class WorkRequestWorkflowResponseDto {
  @ApiProperty({ format: 'uuid' }) eventId!: string;
  @ApiProperty() action!: string;
  @ApiProperty() currentState!: string;
  @ApiProperty() occurredAt!: Date;
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
