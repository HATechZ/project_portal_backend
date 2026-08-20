import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';

export class LoginDto {
  @ApiProperty({ example: 'jane@example.com' })
  @IsEmail()
  @MaxLength(320)
  email!: string;

  @ApiProperty({ example: 'secret7', minLength: 6, maxLength: 8 })
  @IsString()
  @MinLength(6)
  @MaxLength(8)
  password!: string;
}
