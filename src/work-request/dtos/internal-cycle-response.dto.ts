import { ApiProperty } from '@nestjs/swagger';

class WorkflowVisibilityDto {
  @ApiProperty() canViewMainWorkflow!: boolean;
  @ApiProperty() canViewInternalWorkflow!: boolean;
}

export class InternalWorkflowDto {
  @ApiProperty({ format: 'uuid' }) divisionId!: string;
  @ApiProperty() divisionName!: string;
  @ApiProperty({ format: 'uuid' }) divisionCycleId!: string;
  @ApiProperty({ format: 'uuid', nullable: true }) currentTeamStepId!:
    string | null;
  @ApiProperty({ type: [Object] }) steps!: Array<Record<string, unknown>>;
}

/** Additive fields on the existing Internal Cycle projection. Existing fields remain unchanged. */
export class InternalCycleResponseDto {
  @ApiProperty({ type: InternalWorkflowDto, nullable: true })
  internalWorkflow!: InternalWorkflowDto | null;

  @ApiProperty({ type: WorkflowVisibilityDto })
  workflowVisibility!: WorkflowVisibilityDto;
}

class AuthorizedInternalWorkflowDto {
  @ApiProperty({ format: 'uuid' }) divisionId!: string;
  @ApiProperty() divisionName!: string;
  @ApiProperty({ format: 'uuid' }) divisionCycleId!: string;
  @ApiProperty({ type: InternalWorkflowDto, nullable: true })
  internalWorkflow!: InternalWorkflowDto | null;
}

/** Actor-scoped discovery of reusable existing Internal Cycle projections. */
export class InternalCyclesResponseDto {
  @ApiProperty({ type: [AuthorizedInternalWorkflowDto] })
  authorizedInternalWorkflows!: AuthorizedInternalWorkflowDto[];
}
