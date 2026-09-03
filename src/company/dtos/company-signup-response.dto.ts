import { ApiProperty } from '@nestjs/swagger';

export class CompanySignupCompanyResponseDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty() name!: string;
  @ApiProperty() abbr!: string;
  @ApiProperty({ format: 'uuid' }) companyTypeId!: string;
}

export class CompanySignupAdminResponseDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty() fullName!: string;
  @ApiProperty() email!: string;
  @ApiProperty() country!: string;
  @ApiProperty() phone!: string;
}

export class CompanySignupResponseDto {
  @ApiProperty({ type: CompanySignupCompanyResponseDto })
  company!: CompanySignupCompanyResponseDto;

  @ApiProperty({ type: CompanySignupAdminResponseDto })
  admin!: CompanySignupAdminResponseDto;
}
