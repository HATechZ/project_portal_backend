import {
  DivisionLeadDetailDto,
  DivisionLeadResponseDto,
  DivisionResponseDto,
  DivisionTypeResponseDto,
} from '../dtos';
import {
  DivisionLeadAssignmentRecord,
  DivisionLeadRecord,
  DivisionRecord,
  DivisionTypeRecord,
} from '../repositories';

export function toDivisionTypeResponse(
  divisionType: DivisionTypeRecord,
): DivisionTypeResponseDto {
  return {
    id: divisionType.id,
    name: divisionType.name,
    description: divisionType.description,
  };
}

export function toDivisionResponse(
  division: DivisionRecord,
): DivisionResponseDto {
  return {
    id: division.id,
    name: division.name,
    abbr: division.abbr,
    divisionTypeId: division.divisionTypeId,
    divisionType: division.divisionType
      ? toDivisionTypeResponse(division.divisionType)
      : null,
    isActive: division.isActive,
    createdAt: division.createdAt,
    updatedAt: division.updatedAt,
  };
}

export function toDivisionLeadResponse(
  record: DivisionLeadAssignmentRecord,
): DivisionLeadResponseDto {
  return {
    division: record.division,
    member: record.member,
    roleCode: record.roleCode,
    userRoleActive: record.userRoleActive,
    actorProfileLinked: record.actorProfileLinked,
    assignedAt: record.assignedAt,
    revokedIncumbent: record.revokedIncumbent,
    idempotent: record.idempotent,
  };
}

export function toDivisionLeadDetail(
  record: DivisionLeadRecord,
): DivisionLeadDetailDto {
  return {
    member: record.member,
    assignedAt: record.assignedAt,
    assignedByUserId: record.assignedByUserId,
  };
}
