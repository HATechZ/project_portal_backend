import { ApiProperty } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  Equals,
  IsBoolean,
  IsByteLength,
  IsEmail,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export class CompanySignupCompanyDto {
  @ApiProperty({ example: 'Tech Marine Solutions Ltd', maxLength: 180 })
  @IsString()
  @Transform(trim)
  @MinLength(1)
  @MaxLength(180)
  name!: string;

  @ApiProperty({ example: 'TMS', maxLength: 30 })
  @IsString()
  @Transform(trim)
  @MinLength(1)
  @MaxLength(30)
  abbr!: string;

  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  companyTypeId!: string;
}

export class CompanySignupAdminDto {
  @ApiProperty({ example: 'Nayeem Rahman', maxLength: 160 })
  @IsString()
  @Transform(trim)
  @MinLength(1)
  @MaxLength(160)
  fullName!: string;

  @ApiProperty({ example: 'nayeem@techmarine.com', maxLength: 255 })
  @IsEmail()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @MaxLength(255)
  email!: string;

  @ApiProperty({ minLength: 8, maxLength: 72 })
  @IsString()
  @IsByteLength(8, 72)
  password!: string;

  @ApiProperty({ example: 'Bangladesh', maxLength: 100 })
  @IsString()
  @Transform(trim)
  @MinLength(1)
  @MaxLength(100)
  country!: string;

  @ApiProperty({ example: '+880 1711-234567', maxLength: 60 })
  @IsString()
  @Transform(trim)
  @MinLength(1)
  @MaxLength(60)
  phone!: string;
}

export class CompanySignupDto {
  @ApiProperty({ type: CompanySignupCompanyDto })
  @ValidateNested()
  @Type(() => CompanySignupCompanyDto)
  company!: CompanySignupCompanyDto;

  @ApiProperty({ type: CompanySignupAdminDto })
  @ValidateNested()
  @Type(() => CompanySignupAdminDto)
  admin!: CompanySignupAdminDto;

  @ApiProperty({ example: true })
  @IsBoolean()
  @Equals(true)
  termsAccepted!: true;
}
