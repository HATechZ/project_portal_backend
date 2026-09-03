import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CompanyTypeResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'Engineering Consultant' })
  name!: string;

  @ApiPropertyOptional({ nullable: true })
  description!: string | null;
}

export class CompanyResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'Haque & Sons Ltd.' })
  name!: string;

  @ApiProperty({ example: 'HSL' })
  abbr!: string;

  @ApiProperty({ example: 'haque-and-sons' })
  workspaceSlug!: string;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  companyTypeId!: string | null;

  @ApiPropertyOptional({ type: () => CompanyTypeResponseDto, nullable: true })
  companyType!: CompanyTypeResponseDto | null;

  @ApiProperty({ example: true })
  isActive!: boolean;

  @ApiProperty({ format: 'date-time' })
  createdAt!: Date;

  @ApiProperty({ format: 'date-time' })
  updatedAt!: Date;
}
