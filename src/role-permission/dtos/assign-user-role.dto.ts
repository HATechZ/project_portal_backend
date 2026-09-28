import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsUUID } from 'class-validator';

export class AssignUserRoleDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  roleId!: string;

  @ApiPropertyOptional({
    format: 'uuid',
    description:
      'Required only when assigning a TEAM-scoped custom role; forbidden for every other role.',
  })
  @IsOptional()
  @IsUUID()
  teamId?: string;
}
