import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { Prisma } from '../../generated/prisma/client';
import { PaginationArgs } from '../../common/pagination/paginate';
import { BaseRepository } from '../../infra/prisma/base.repository';
import { UnitOfWorkService } from '../../infra/prisma/unit-of-work.service';

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
export class CompanyRepository extends BaseRepository {
  constructor(unitOfWork: UnitOfWorkService) {
    super(unitOfWork);
  }

  findAll({ skip, take }: PaginationArgs): Promise<CompanyRecord[]> {
    return this.transaction((db) =>
      db.company.findMany({
        orderBy: [{ name: 'asc' }, { id: 'asc' }],
        skip,
        take,
        select: companySelect,
      }),
    );
  }

  count(): Promise<number> {
    return this.transaction((db) => db.company.count());
  }

  findById(id: string): Promise<CompanyRecord | null> {
    return this.transaction((db) =>
      db.company.findUnique({ where: { id }, select: companySelect }),
    );
  }

  findCompanyType(id: string): Promise<CompanyTypeRecord | null> {
    return this.transaction((db) =>
      db.companyType.findUnique({ where: { id }, select: companyTypeSelect }),
    );
  }

  findCompanyTypes(): Promise<CompanyTypeRecord[]> {
    return this.referenceRead((db) =>
      db.$queryRaw<CompanyTypeRecord[]>(Prisma.sql`
      SELECT id, name, description
      FROM public.company_types
      ORDER BY name ASC, id ASC
    `),
    );
  }

  create(data: Omit<Prisma.CompanyUncheckedCreateInput, 'id' | 'tenantId'>) {
    const scopedData: Partial<Prisma.CompanyUncheckedCreateInput> = { ...data };
    delete scopedData.id;
    delete scopedData.tenantId;
    return this.transaction((db) =>
      db.company.create({
        data: {
          id: randomUUID(),
          ...scopedData,
        } as Prisma.CompanyUncheckedCreateInput,
        select: companySelect,
      }),
    );
  }
}
