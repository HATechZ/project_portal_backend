import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsUUID, ValidateIf } from 'class-validator';

export class MemberEligibilityQueryDto {
  @ApiPropertyOptional({
    format: 'uuid',
    description: 'Target Division; supply exactly one of divisionId or teamId.',
  })
  @ValidateIf(
    (input: MemberEligibilityQueryDto) =>
      input.divisionId !== undefined || input.teamId === undefined,
  )
  @IsUUID()
  divisionId?: string;

  @ApiPropertyOptional({
    format: 'uuid',
    description: 'Target Team; its Division is resolved server-side.',
  })
  @ValidateIf(
    (input: MemberEligibilityQueryDto) =>
      input.teamId !== undefined || input.divisionId === undefined,
  )
  @IsUUID()
  teamId?: string;
}
