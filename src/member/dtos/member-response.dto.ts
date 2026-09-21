import { ApiProperty } from '@nestjs/swagger';

export class MemberResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty({ format: 'uuid', nullable: true })
  userId!: string | null;

  @ApiProperty()
  companyId!: string;

  @ApiProperty()
  divisionId!: string;

  @ApiProperty()
  designationId!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty()
  email!: string;

  @ApiProperty()
  designation!: string;

  @ApiProperty()
  isActive!: boolean;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;
}
