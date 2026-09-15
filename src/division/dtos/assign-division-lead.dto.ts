import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class AssignDivisionLeadDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  memberId!: string;
}
