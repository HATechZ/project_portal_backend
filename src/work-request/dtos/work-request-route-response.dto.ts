import { ApiProperty } from '@nestjs/swagger';

class MainWorkflowVisibilityDto {
  @ApiProperty()
  canViewMainWorkflow!: boolean;
}

/** Additive actor-specific metadata on the existing Main Route projection. */
export class WorkRequestRouteResponseDto {
  @ApiProperty({ type: Object, nullable: true })
  projection!: Record<string, unknown> | null;

  @ApiProperty({ type: [Object] })
  steps!: Array<Record<string, unknown>>;

  @ApiProperty({ type: MainWorkflowVisibilityDto })
  workflowVisibility!: MainWorkflowVisibilityDto;
}
