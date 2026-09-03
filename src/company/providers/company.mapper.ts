import { CompanyResponseDto, CompanyTypeResponseDto } from '../dtos';
import { CompanyRecord, CompanyTypeRecord } from '../repositories';

export function toCompanyTypeResponse(
  companyType: CompanyTypeRecord,
): CompanyTypeResponseDto {
  return {
    id: companyType.id,
    name: companyType.name,
    description: companyType.description,
  };
}

export function toCompanyResponse(company: CompanyRecord): CompanyResponseDto {
  return {
    id: company.id,
    name: company.name,
    abbr: company.abbr,
    workspaceSlug: company.workspaceSlug,
    companyTypeId: company.companyTypeId,
    companyType: company.companyType
      ? toCompanyTypeResponse(company.companyType)
      : null,
    isActive: company.isActive,
    createdAt: company.createdAt,
    updatedAt: company.updatedAt,
  };
}
