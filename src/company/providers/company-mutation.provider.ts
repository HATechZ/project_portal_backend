import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client';
import { CreateCompanyDto, CompanyResponseDto } from '../dtos';
import { CompanyRepository } from '../repositories';
import { toCompanyResponse } from './company.mapper';

@Injectable()
export class CompanyMutationProvider {
  constructor(private readonly repository: CompanyRepository) {}

  async create(input: CreateCompanyDto): Promise<CompanyResponseDto> {
    const companyTypeId = input.companyTypeId ?? null;
    if (
      companyTypeId &&
      !(await this.repository.findCompanyType(companyTypeId))
    ) {
      throw new BadRequestException(
        `Company type with ID ${companyTypeId} was not found`,
      );
    }

    try {
      return toCompanyResponse(
        await this.repository.create({
          name: input.name.trim(),
          abbr: input.abbr.trim(),
          companyTypeId,
          isActive: true,
        }),
      );
    } catch (error) {
      this.handlePersistenceError(error);
    }
  }

  private handlePersistenceError(error: unknown): never {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2002') {
        throw new ConflictException(
          'A company with this abbreviation already exists',
        );
      }
      if (error.code === 'P2003') {
        throw new BadRequestException('Company type was not found');
      }
    }
    throw error;
  }
}
