import { Transform } from 'class-transformer';
import { IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

const optionalTrim = ({ value }: { value: unknown }) => {
  if (typeof value !== 'string') return value;
  const normalized = value.trim();
  return normalized === '' ? undefined : normalized;
};

export class ArchiveWorkRequestDto {
  @ApiPropertyOptional()
  @IsOptional()
  @Transform(optionalTrim)
  @IsString()
  @MaxLength(10000)
  reason?: string;
}

export class WorkRequestLifecycleResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({
    type: Object,
    example: {
      status: 'archived',
      archivedAt: '2026-11-12T00:00:00.000Z',
      archivedByActorId: '00000000-0000-4000-8000-000000000000',
      reason: null,
    },
  })
  lifecycle!: {
    status: 'active' | 'archived';
    archivedAt: Date | null;
    archivedByActorId: string | null;
    reason: string | null;
  };
}
