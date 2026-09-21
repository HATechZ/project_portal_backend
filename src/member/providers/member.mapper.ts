import { MemberResponseDto } from '../dtos';
import { MemberRecord } from '../repositories';

export function toMemberResponse(member: MemberRecord): MemberResponseDto {
  return {
    id: member.id,
    userId: member.userId,
    companyId: member.companyId,
    divisionId: member.divisionId,
    designationId: member.designationId,
    name: member.name,
    email: member.email,
    designation: member.designation.name,
    isActive: member.isActive,
    createdAt: member.createdAt,
    updatedAt: member.updatedAt,
  };
}
