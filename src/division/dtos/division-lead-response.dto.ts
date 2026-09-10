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
}
