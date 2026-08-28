import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class RefreshTokenDto {
  @ApiProperty({
    description: 'Opaque refresh token returned by login or refresh',
  })
  @IsString()
  @MinLength(40)
  refreshToken!: string;
}
