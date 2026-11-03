import { ApiProperty } from '@nestjs/swagger';

export class EligibleMemberTeamDto {
  @ApiProperty({ format: 'uuid' }) teamId!: string;
  @ApiProperty() name!: string;
}

export class EligibleMemberMembershipDto extends EligibleMemberTeamDto {
  @ApiProperty({ nullable: true, type: String }) teamRole!: string | null;
  @ApiProperty() isTeamLead!: boolean;
}

export class EligibleMemberResponseDto {
  @ApiProperty({ format: 'uuid' }) memberId!: string;
  @ApiProperty() name!: string;
  @ApiProperty() email!: string;
  @ApiProperty() isTeamLead!: boolean;
  @ApiProperty({ type: () => EligibleMemberMembershipDto, isArray: true })
  activeTeamMemberships!: EligibleMemberMembershipDto[];
  @ApiProperty({ type: () => EligibleMemberTeamDto, isArray: true })
  ledTeams!: EligibleMemberTeamDto[];
}
