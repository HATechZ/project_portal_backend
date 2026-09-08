import { ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { IsBoolean, ValidateIf } from 'class-validator';
import { CreateUserDto } from './create-user.dto';

export class UpdateUserDto extends PartialType(CreateUserDto, {
  skipNullProperties: false,
}) {
  @ApiPropertyOptional({ description: 'Whether the user may authenticate' })
  @ValidateIf((_object, value: unknown) => value !== undefined)
  @IsBoolean()
  isActive?: boolean;
}
