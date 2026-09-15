import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class UpdateClientDto {
  @ApiPropertyOptional({ minLength: 1, maxLength: 180 })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(180)
  name?: string;
}
