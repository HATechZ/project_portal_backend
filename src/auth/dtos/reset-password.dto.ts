import { ApiProperty } from '@nestjs/swagger';
import { IsByteLength, IsString, MaxLength, MinLength } from 'class-validator';

export class ResetPasswordDto {
  @ApiProperty({ description: 'Opaque token from the password-reset email' })
  @IsString()
  @MinLength(40)
  @MaxLength(256)
  token!: string;

  @ApiProperty({ minLength: 8, maxLength: 72 })
  @IsString()
  @IsByteLength(8, 72)
  newPassword!: string;
}
