import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class TeamMemberSummaryDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty()
  email!: string;

  @ApiProperty()
  designation!: string;
}

export class TeamLeadSummaryDto extends TeamMemberSummaryDto {}

export class TeamResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  companyId!: string;

  @ApiProperty()
  divisionId!: string;

  @ApiProperty()
  name!: string;

  @ApiPropertyOptional({ nullable: true })
  leadMemberId!: string | null;

  @ApiPropertyOptional({ type: TeamLeadSummaryDto, nullable: true })
  leadMember?: TeamLeadSummaryDto | null;

  @ApiProperty()
  isActive!: boolean;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;
}

export class TeamMemberResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  teamId!: string;

  @ApiProperty()
  memberId!: string;

  @ApiPropertyOptional({ nullable: true })
  teamRole!: string | null;

  @ApiProperty()
  joinedAt!: Date;

  @ApiPropertyOptional({ nullable: true })
  leftAt!: Date | null;

  @ApiProperty({ type: TeamMemberSummaryDto })
  member!: TeamMemberSummaryDto;
}
