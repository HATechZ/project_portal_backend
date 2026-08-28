import { ApiProperty } from '@nestjs/swagger';
import { ArrayUnique, IsArray, IsEnum } from 'class-validator';
import { WorkflowActionCode } from '../../generated/prisma/client';

export class SetRolePermissionsDto {
  @ApiProperty({ enum: WorkflowActionCode, isArray: true })
  @IsArray()
  @ArrayUnique()
  @IsEnum(WorkflowActionCode, { each: true })
  permissionCodes!: WorkflowActionCode[];
}
