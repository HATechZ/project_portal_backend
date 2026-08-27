import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { Prisma } from '../../generated/prisma/client';
import { PaginationArgs } from '../../common/pagination/paginate';
import { PrismaService } from '../../infra/prisma/prisma.service';

export const companyTypeSelect = {
  id: true,
  name: true,
  description: true,
} satisfies Prisma.CompanyTypeSelect;

export const companySelect = {
  id: true,
  name: true,
  abbr: true,
  companyTypeId: true,
  companyType: { select: companyTypeSelect },
  isActive: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.CompanySelect;

export type CompanyRecord = Prisma.CompanyGetPayload<{
  select: typeof companySelect;
}>;

export type CompanyTypeRecord = Prisma.CompanyTypeGetPayload<{
  select: typeof companyTypeSelect;
}>;

@Injectable()
export class CompanyRepository {
  constructor(private readonly prisma: PrismaService) {}

  findAll({ skip, take }: PaginationArgs): Promise<CompanyRecord[]> {
    return this.prisma.scoped.company.findMany({
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
      skip,
      take,
      select: companySelect,
    });
  }

  count(): Promise<number> {
    return this.prisma.scoped.company.count();
  }

  findById(id: string): Promise<CompanyRecord | null> {
    return this.prisma.scoped.company.findUnique({
      where: { id },
      select: companySelect,
    });
  }

  findCompanyType(id: string): Promise<CompanyTypeRecord | null> {
    return this.prisma.companyType.findUnique({
      where: { id },
      select: companyTypeSelect,
    });
  }

  findCompanyTypes(): Promise<CompanyTypeRecord[]> {
    return this.prisma.companyType.findMany({
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
      select: companyTypeSelect,
    });
  }

  create(data: Omit<Prisma.CompanyUncheckedCreateInput, 'id' | 'tenantId'>) {
    const scopedData: Partial<Prisma.CompanyUncheckedCreateInput> = { ...data };
    delete scopedData.id;
    delete scopedData.tenantId;
    return this.prisma.scoped.company.create({
      data: {
        id: randomUUID(),
        ...scopedData,
      } as Prisma.CompanyUncheckedCreateInput,
      select: companySelect,
    });
  }
}
