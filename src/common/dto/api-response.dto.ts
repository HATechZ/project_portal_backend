import { ApiProperty } from '@nestjs/swagger';

export class ApiResponseDto<T> {
  @ApiProperty({ example: true })
  success!: boolean;

  @ApiProperty({ example: 'Request successful' })
  message!: string;

  @ApiProperty({ description: 'Response payload' })
  data!: T;

  @ApiProperty({ format: 'date-time', example: '2026-08-20T10:30:00.000Z' })
  timestamp!: string;
}
