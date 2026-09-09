import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class DivisionTypeResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'Technical' })
  name!: string;

  @ApiPropertyOptional({ nullable: true })
  description!: string | null;
}

export class DivisionResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'Engineering' })
  name!: string;

  @ApiProperty({ example: 'ENG' })
  abbr!: string;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  divisionTypeId!: string | null;

  @ApiPropertyOptional({ type: () => DivisionTypeResponseDto, nullable: true })
  divisionType!: DivisionTypeResponseDto | null;

  @ApiProperty({ example: true })
  isActive!: boolean;

  @ApiProperty({ format: 'date-time' })
  createdAt!: Date;

  @ApiProperty({ format: 'date-time' })
  updatedAt!: Date;
}
