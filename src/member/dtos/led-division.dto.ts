import { ApiProperty } from '@nestjs/swagger';

/** A Division this Member actively leads (04.1.1). */
export class LedDivisionResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty()
  abbr!: string;

  @ApiProperty({ format: 'date-time' })
  assignedAt!: Date;
}
