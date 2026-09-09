import { DivisionResponseDto, DivisionTypeResponseDto } from '../dtos';
import { DivisionRecord, DivisionTypeRecord } from '../repositories';

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
