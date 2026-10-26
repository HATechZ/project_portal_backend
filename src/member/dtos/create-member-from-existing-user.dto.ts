import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class CreateMemberFromExistingUserDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  userId!: string;

  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  actorProfileId!: string;

  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  divisionId!: string;

  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  designationId!: string;

  @ApiPropertyOptional({ maxLength: 60 })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsOptional()
  @IsString()
  @MaxLength(60)
  phone?: string;
}
