import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class AssignTeamLeadDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  leadMemberId!: string;
}
