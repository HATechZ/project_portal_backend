import { Type } from 'class-transformer';
import { Transform } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEmail,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
  ValidateNested,
  ValidateIf,
} from 'class-validator';

export class CreateClientPrimaryContactDto {
  @ApiProperty({ minLength: 1, maxLength: 160 })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MinLength(1)
  @MaxLength(160)
  name!: string;

  @ApiProperty({ maxLength: 255 })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsEmail()
  @MaxLength(255)
  email!: string;

  @ApiPropertyOptional({ maxLength: 140 })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsOptional()
  @IsString()
  @MaxLength(140)
  designation?: string;

  @ApiPropertyOptional({ maxLength: 60 })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsOptional()
  @IsString()
  @MaxLength(60)
  phone?: string;
}

export class CreateClientDto {
  @ApiProperty({ minLength: 1, maxLength: 180 })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MinLength(1)
  @MaxLength(180)
  name!: string;

  @ApiProperty({ type: CreateClientPrimaryContactDto })
  @ValidateNested()
  @Type(() => CreateClientPrimaryContactDto)
  primaryContact!: CreateClientPrimaryContactDto;

  @ApiProperty()
  @IsBoolean()
  enablePortalAccess!: boolean;

  @ApiPropertyOptional({
    format: 'uuid',
    description:
      'Required when portal access is enabled. Must identify an active tenant-created client or client_contact scoped role.',
  })
  @ValidateIf((input: CreateClientDto) => input.enablePortalAccess)
  @IsUUID()
  portalRoleId?: string;
}
