import { Transform } from 'class-transformer';
import {
  IsIn,
  IsArray,
  ArrayNotEmpty,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  WorkflowActionCode,
  WorkRequestRouteRevisionClassification,
  WorkRequestV1AssignmentLevelCode,
} from '../../generated/prisma/client';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;
const optionalTrim = ({ value }: { value: unknown }) => {
  if (typeof value !== 'string') return value;
  const normalized = value.trim();
  return normalized === '' ? undefined : normalized;
};
const array = ({ value }: { value: unknown }) =>
  value === undefined || value === ''
    ? undefined
    : Array.isArray(value)
      ? value
      : [value];

export const WORK_REQUEST_PRIORITIES = ['Low', 'Medium', 'High'] as const;
export type WorkRequestPriority = (typeof WORK_REQUEST_PRIORITIES)[number];

export class WorkRequestDocumentMetadataDto {
  @ApiPropertyOptional({
    type: String,
    isArray: true,
    description:
      'Optional repeated values positionally mapped to files. Blank values are stored as null.',
  })
  @IsOptional()
  @Transform(array)
  @IsString({ each: true })
  @MaxLength(10000, { each: true })
  descriptions?: string[];

  @ApiPropertyOptional({
    type: String,
    isArray: true,
    description:
      'Optional repeated values positionally mapped to files. Blank values are stored as null.',
  })
  @IsOptional()
  @Transform(array)
  @IsString({ each: true })
  @MaxLength(10, { each: true })
  shipmentNumbers?: string[];
}

export class CreateWorkRequestDto extends WorkRequestDocumentMetadataDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @Transform(optionalTrim)
  @IsOptional()
  @IsUUID()
  bidId?: string;
  @ApiPropertyOptional({ format: 'uuid' })
  @Transform(optionalTrim)
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
  @Transform(optionalTrim)
  @IsString()
  @MaxLength(10000)
  notes?: string;
  @ApiPropertyOptional({ type: String, format: 'uuid', isArray: true })
  @IsOptional()
  @Transform(array)
  @IsUUID(undefined, { each: true })
  documentCodeIds?: string[];
  @ApiProperty({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  originatingDivisionId?: string;
  @ApiPropertyOptional({
    format: 'uuid',
    description:
      'Required only when a tenant_super_admin without a Member context creates a route-based Work Request; binds an active Lead of originatingDivisionId.',
  })
  @IsOptional()
  @IsUUID()
  responsibleOriginatingDivisionLeadId?: string;
  @ApiProperty({ type: String, format: 'uuid', isArray: true, minItems: 1 })
  @Transform(array)
  @IsOptional()
  @IsArray()
  @ArrayNotEmpty()
  @IsUUID(undefined, { each: true })
  intermediateDivisionIds?: string[];
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

export class AmendWorkRequestRouteDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  baseRouteVersionId!: string;
  @ApiProperty({ type: String, format: 'uuid', isArray: true })
  @Transform(array)
  @IsArray()
  @IsUUID(undefined, { each: true })
  intermediateDivisionIds!: string[];
}

export class DefineWorkRequestTeamSequenceDto {
  @ApiProperty({ type: String, format: 'uuid', isArray: true, minItems: 1 })
  @Transform(array)
  @IsArray()
  @ArrayNotEmpty()
  @IsUUID(undefined, { each: true })
  teamIds!: string[];
}

export class DefineWorkRequestMemberSequenceDto {
  @ApiProperty({ type: String, format: 'uuid', isArray: true, minItems: 1 })
  @Transform(array)
  @IsArray()
  @ArrayNotEmpty()
  @IsUUID(undefined, { each: true })
  memberIds!: string[];
}

export class AppendWorkRequestMemberStepDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  memberId!: string;
}

export class RequestWorkRequestRouteRevisionDto {
  @ApiProperty({ enum: WorkRequestRouteRevisionClassification })
  @IsEnum(WorkRequestRouteRevisionClassification)
  classification!: WorkRequestRouteRevisionClassification;
  @ApiProperty({
    format: 'uuid',
    description: 'Exact active source Actor Profile ID.',
  })
  @IsUUID()
  sourceActorId!: string;
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  sourceMemberStepId?: string;
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  sourceTeamStepId?: string;
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  sourceDivisionCycleId?: string;
  @ApiProperty()
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(10000)
  reason!: string;
}

export class ResubmitWorkRequestRouteRevisionDto {
  @ApiPropertyOptional({ description: 'Optional correction note.' })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(10000)
  note?: string;
}

/** Phase 6 route-private communication.  This deliberately is not the V1/C2
 * request/respond DTO: a send fans out immutable pair messages. */
export class SendWorkRequestRouteMessageDto {
  @ApiProperty({ type: String, format: 'uuid', isArray: true, minItems: 1 })
  @Transform(array)
  @IsArray()
  @ArrayNotEmpty()
  @IsUUID(undefined, { each: true })
  recipientActorIds!: string[];

  @ApiProperty()
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(10000)
  message!: string;

  @ApiPropertyOptional({ type: String, format: 'uuid', isArray: true })
  @IsOptional()
  @Transform(array)
  @IsUUID(undefined, { each: true })
  documentVersionIds?: string[];
}

export class ReplyWorkRequestRouteMessageDto {
  @ApiProperty()
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(10000)
  message!: string;

  @ApiPropertyOptional({ type: String, format: 'uuid', isArray: true })
  @IsOptional()
  @Transform(array)
  @IsUUID(undefined, { each: true })
  documentVersionIds?: string[];
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

export class AssignReviewerDto extends AssignMemberDto {
  @ApiProperty({ enum: ['CHECKING', 'APPROVAL', 'FINAL_REVIEW'] })
  @IsEnum(['CHECKING', 'APPROVAL', 'FINAL_REVIEW'])
  level!: Extract<
    WorkRequestV1AssignmentLevelCode,
    'CHECKING' | 'APPROVAL' | 'FINAL_REVIEW'
  >;
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

export class WorkRequestAssignmentHistoryResponseDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ enum: WorkRequestV1AssignmentLevelCode }) level!: string;
  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  divisionId!: string | null;
  @ApiPropertyOptional({ format: 'uuid', nullable: true }) teamId!:
    string | null;
  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  memberId!: string | null;
  @ApiProperty({ format: 'date-time' }) assignedAt!: Date;
  @ApiPropertyOptional({ format: 'date-time', nullable: true })
  unassignedAt!: Date | null;
  @ApiPropertyOptional({ format: 'date-time', nullable: true })
  replacedAt!: Date | null;
  @ApiPropertyOptional({ nullable: true }) note!: string | null;
  @ApiPropertyOptional({
    nullable: true,
    type: Object,
    description:
      'Safe target Member display projection for member-targeted assignments.',
  })
  assignee!: { id: string; label: string } | null;
  @ApiProperty({ type: Object }) assignedBy!: { id: string; label: string };
}

export class WorkRequestEventResponseDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty() action!: string;
  @ApiPropertyOptional({ nullable: true }) priorState!: string | null;
  @ApiPropertyOptional({ nullable: true }) resultingState!: string | null;
  @ApiPropertyOptional({
    enum: WorkRequestV1AssignmentLevelCode,
    nullable: true,
  })
  responsibilityLevel!: WorkRequestV1AssignmentLevelCode | null;
  @ApiPropertyOptional({ nullable: true }) note!: string | null;
  @ApiProperty({ format: 'date-time' }) occurredAt!: Date;
  @ApiProperty({ type: Object }) performedBy!: { id: string; label: string };
}

export class WorkRequestAvailableActionResponseDto {
  @ApiProperty({ description: 'Backend-derived executable action code.' })
  code!: string;
  @ApiProperty() label!: string;
  @ApiProperty() targetKind!: string;
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
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  parentInfoRequestId?: string;
  @ApiProperty({ format: 'uuid', description: 'Target Actor Profile ID' })
  @IsUUID()
  targetActorId!: string;

  @ApiProperty({ description: 'Clarification message.' })
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(10000)
  message!: string;

  @ApiPropertyOptional({ type: String, format: 'uuid', isArray: true })
  @IsOptional()
  @IsUUID(undefined, { each: true })
  documentVersionIds?: string[];
}

export class RespondWorkRequestInfoRequestDto {
  @ApiProperty({ description: 'Clarification response message.' })
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(10000)
  message!: string;

  @ApiPropertyOptional({ type: String, format: 'uuid', isArray: true })
  @IsOptional()
  @IsUUID(undefined, { each: true })
  documentVersionIds?: string[];
}

export class WorkRequestInfoParticipantDto {
  @ApiProperty({ format: 'uuid' }) actorId!: string;
  @ApiProperty({ enum: ['INTERNAL_MEMBER', 'EXTERNAL_CLIENT_CONTACT'] })
  type!: 'INTERNAL_MEMBER' | 'EXTERNAL_CLIENT_CONTACT';
}

export class WorkRequestInfoAttachmentDto {
  @ApiProperty({ format: 'uuid' }) documentVersionId!: string;
}

export class WorkRequestInfoResponseDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ type: WorkRequestInfoParticipantDto })
  responder!: WorkRequestInfoParticipantDto;
  @ApiProperty() message!: string;
  @ApiProperty() respondedAt!: Date;
  @ApiProperty({ type: [WorkRequestInfoAttachmentDto] })
  attachments!: WorkRequestInfoAttachmentDto[];
}

export class WorkRequestInfoRequestDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ type: WorkRequestInfoParticipantDto })
  requester!: WorkRequestInfoParticipantDto;
  @ApiProperty({ type: WorkRequestInfoParticipantDto })
  target!: WorkRequestInfoParticipantDto;
  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  parentInfoRequestId!: string | null;
  @ApiProperty() message!: string;
  @ApiProperty({ enum: ['OPEN', 'RESPONDED', 'CANCELLED', 'SUPERSEDED'] })
  status!: string;
  @ApiProperty() stateAtRequest!: string;
  @ApiProperty() requestedAt!: Date;
  @ApiPropertyOptional() closedAt!: Date | null;
  @ApiProperty({ type: [WorkRequestInfoAttachmentDto] })
  attachments!: WorkRequestInfoAttachmentDto[];
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

export class CreateWorkRequestClientSubmissionDto extends WorkRequestWorkflowNoteDto {
  @ApiProperty({ type: String, format: 'uuid', isArray: true })
  @IsArray()
  @ArrayNotEmpty()
  @IsUUID(undefined, { each: true })
  documentVersionIds!: string[];
}

export class WorkRequestClientDecisionDto extends WorkRequestWorkflowNoteDto {
  @ApiProperty({ enum: ['ACCEPT', 'REJECT', 'REQUEST_REVISION'] })
  @IsIn(['ACCEPT', 'REJECT', 'REQUEST_REVISION'])
  decision!: 'ACCEPT' | 'REJECT' | 'REQUEST_REVISION';
}

export class RouteWorkRequestClientRevisionDto extends WorkRequestWorkflowNoteDto {
  @ApiProperty({ enum: ['MEMBER', 'CHECKING', 'APPROVAL', 'FINAL_REVIEW'] })
  @IsIn(['MEMBER', 'CHECKING', 'APPROVAL', 'FINAL_REVIEW'])
  destination!: 'MEMBER' | 'CHECKING' | 'APPROVAL' | 'FINAL_REVIEW';
}

export class RequestWorkRequestReconsiderationDto extends WorkRequestWorkflowNoteDto {}

export class DecideWorkRequestReconsiderationDto extends WorkRequestWorkflowNoteDto {
  @ApiProperty({ enum: ['ACCEPT', 'DENY'] })
  @IsIn(['ACCEPT', 'DENY'])
  decision!: 'ACCEPT' | 'DENY';
}

export class WorkRequestClientSubmissionResponseDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty() submissionNumber!: number;
  @ApiPropertyOptional({ format: 'date-time', nullable: true })
  submittedAt!: Date | null;
  @ApiProperty({ type: [String] }) documentVersionIds!: string[];
  @ApiPropertyOptional({ type: Object, nullable: true }) decision!: {
    id: string;
    decision: 'ACCEPT' | 'REJECT' | 'REQUEST_REVISION';
    decidedAt: Date;
  } | null;
}

export class WorkRequestClientDecisionResponseDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ enum: ['ACCEPT', 'REJECT', 'REQUEST_REVISION'] })
  decision!: string;
  @ApiProperty({ format: 'date-time' }) decidedAt!: Date;
  @ApiProperty() currentState!: string;
}

export class WorkRequestClientRevisionRouteResponseDto {
  @ApiProperty({ format: 'uuid' }) eventId!: string;
  @ApiProperty({ enum: ['MEMBER', 'CHECKING', 'APPROVAL', 'FINAL_REVIEW'] })
  destination!: string;
  @ApiProperty() currentState!: string;
  @ApiProperty({ format: 'date-time' }) occurredAt!: Date;
}

export class WorkRequestResponseDto {
  @ApiProperty() id!: string;
  @ApiPropertyOptional({ format: 'uuid' }) bidId!: string | null;
  @ApiPropertyOptional({ format: 'uuid' }) projectId!: string | null;
  @ApiProperty({ nullable: true }) shipmentNumber!: string | null;
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
    description: string | null;
    shipmentNumber: string | null;
    generatedFileName: string | null;
    mimeType: string;
    size: number;
    lastUpdatedAt: Date | null;
  }[];
  @ApiProperty({ type: [Object] }) availableActions!: unknown[];
  @ApiProperty() createdAt!: Date;
  @ApiProperty() updatedAt!: Date;
}
