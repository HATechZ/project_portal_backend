import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class MemberDivisionSummaryDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty()
  abbr!: string;
}

export class MemberUserSummaryDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  fullName!: string;

  @ApiProperty()
  email!: string;
}

export class MemberResponseDto {
  @ApiProperty()
  id!: string;

  @ApiPropertyOptional({ nullable: true })
  userId!: string | null;

  @ApiProperty()
  companyId!: string;

  @ApiProperty()
  divisionId!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty()
  email!: string;

  @ApiProperty()
  roleTitle!: string;

  @ApiProperty()
  isActive!: boolean;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;

  @ApiPropertyOptional({ type: MemberDivisionSummaryDto })
  division?: MemberDivisionSummaryDto;

  @ApiPropertyOptional({ type: MemberUserSummaryDto, nullable: true })
  user?: MemberUserSummaryDto | null;
}
