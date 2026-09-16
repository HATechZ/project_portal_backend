import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ApiErrorDto {
  @ApiProperty({ example: 'NOT_FOUND' })
  code!: string;

  @ApiProperty({
    example: 'User not found. Check the selected user and try again.',
  })
  message!: string;

  @ApiPropertyOptional({ description: 'Additional error context' })
  details?: unknown;
}

export class ApiErrorMetaDto {
  @ApiPropertyOptional({ example: 'c4c23a61-ffbb-4b27-9756-98382f74594b' })
  requestId?: string;

  @ApiProperty({ format: 'date-time', example: '2026-08-20T10:30:00.000Z' })
  timestamp!: string;
}

export class ApiErrorResponseDto {
  @ApiProperty({ example: false })
  success!: false;

  @ApiProperty({ type: ApiErrorDto })
  error!: ApiErrorDto;

  @ApiProperty({ type: ApiErrorMetaDto })
  meta!: ApiErrorMetaDto;
}
