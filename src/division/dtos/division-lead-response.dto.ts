import { ApiProperty } from '@nestjs/swagger';
import { ActorRoleCode } from '../../generated/prisma/client';

export class DivisionLeadDivisionDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty()
  abbr!: string;
}

export class DivisionLeadMemberDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty()
  email!: string;

  @ApiProperty({ format: 'uuid' })
  userId!: string;
}

export class DivisionLeadMemberSummaryDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty()
  email!: string;
}

export class DivisionLeadRevokedIncumbentDto {
  @ApiProperty({ type: DivisionLeadMemberSummaryDto })
  member!: DivisionLeadMemberSummaryDto;

  @ApiProperty({ format: 'date-time' })
  revokedAt!: Date;
}

export class DivisionLeadResponseDto {
  @ApiProperty({ type: DivisionLeadDivisionDto })
  division!: DivisionLeadDivisionDto;

  @ApiProperty({ type: DivisionLeadMemberDto })
  member!: DivisionLeadMemberDto;

  @ApiProperty({ enum: ActorRoleCode, enumName: 'ActorRoleCode' })
  roleCode!: ActorRoleCode;

  @ApiProperty()
  userRoleActive!: boolean;

  @ApiProperty()
  actorProfileLinked!: boolean;

  @ApiProperty({ format: 'date-time' })
  assignedAt!: Date;

  @ApiProperty({
    type: DivisionLeadRevokedIncumbentDto,
    nullable: true,
    description: 'The Lead this assignment retired, or null if there was none.',
  })
  revokedIncumbent!: DivisionLeadRevokedIncumbentDto | null;

  @ApiProperty({
    description: 'True when the Member already led this Division; no write.',
  })
  idempotent!: boolean;
}

/** The current active Lead of a Division. */
export class DivisionLeadDetailDto {
  @ApiProperty({ type: DivisionLeadMemberSummaryDto })
  member!: DivisionLeadMemberSummaryDto;

  @ApiProperty({ format: 'date-time' })
  assignedAt!: Date;

  @ApiProperty({ format: 'uuid' })
  assignedByUserId!: string;
}
