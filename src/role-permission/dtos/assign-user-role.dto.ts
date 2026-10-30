import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsUUID } from 'class-validator';

export class AssignUserRoleDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  roleId!: string;

  @ApiPropertyOptional({
    format: 'uuid',
    description:
      'Not supported. Organizational responsibility is derived from the active ActorProfile and current Team membership, never stored on a role grant.',
  })
  @IsOptional()
  @IsUUID()
  teamId?: string;
}
