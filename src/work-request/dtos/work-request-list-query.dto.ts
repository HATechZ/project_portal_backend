import { IsIn, IsOptional } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationQueryDto } from '../../common/pagination/dtos/pagination-query.dto';

export const WORK_REQUEST_LIFECYCLES = ['active', 'archived', 'all'] as const;
export type WorkRequestLifecycleFilter =
  (typeof WORK_REQUEST_LIFECYCLES)[number];

export class WorkRequestListQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: WORK_REQUEST_LIFECYCLES, default: 'active' })
  @IsOptional()
  @IsIn(WORK_REQUEST_LIFECYCLES)
  lifecycle: WorkRequestLifecycleFilter = 'active';
}
