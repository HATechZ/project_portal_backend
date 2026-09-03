import { Inject, Injectable } from '@nestjs/common';
import {
  PASSWORD_HASHER,
  type PasswordHasher,
} from '../infra/crypto/password-hasher.port';
import { CompanySignupDto, CompanySignupResponseDto } from './dtos';
import { CompanySignupRepository } from './repositories';

@Injectable()
export class CompanySignupService {
  constructor(
    private readonly repository: CompanySignupRepository,
    @Inject(PASSWORD_HASHER) private readonly passwordHasher: PasswordHasher,
  ) {}

  async signup(input: CompanySignupDto): Promise<CompanySignupResponseDto> {
    const passwordHash = await this.passwordHasher.hash(input.admin.password);
    const result = await this.repository.provision({
      companyName: input.company.name,
      companyAbbr: input.company.abbr,
      companyTypeId: input.company.companyTypeId,
      adminFullName: input.admin.fullName,
      adminEmail: input.admin.email,
      adminPasswordHash: passwordHash,
      adminCountry: input.admin.country,
      adminPhone: input.admin.phone,
    });
    return {
      company: {
        id: result.companyId,
        name: input.company.name,
        abbr: input.company.abbr,
        companyTypeId: input.company.companyTypeId,
      },
      admin: {
        id: result.userId,
        fullName: input.admin.fullName,
        email: input.admin.email,
        country: input.admin.country,
        phone: input.admin.phone,
      },
    };
  }
}
