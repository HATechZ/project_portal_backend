import { TeamMemberResponseDto, TeamResponseDto } from '../dtos';
import { TeamMemberRecord, TeamRecord } from '../repositories';

export function toTeamResponse(team: TeamRecord): TeamResponseDto {
  return {
    id: team.id,
    companyId: team.companyId,
    divisionId: team.divisionId,
    name: team.name,
    leadMemberId: team.leadMemberId,
    leadMember: team.leadMember,
    isActive: team.isActive,
    createdAt: team.createdAt,
    updatedAt: team.updatedAt,
  };
}

export function toTeamMemberResponse(
  record: TeamMemberRecord,
): TeamMemberResponseDto {
  return {
    id: record.id,
    teamId: record.teamId,
    memberId: record.memberId,
    teamRole: record.teamRole,
    joinedAt: record.joinedAt,
    leftAt: record.leftAt,
    member: record.member,
  };
}
