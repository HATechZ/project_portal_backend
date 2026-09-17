import { TeamMemberResponseDto, TeamResponseDto } from '../dtos';
import { TeamMemberRecord, TeamRecord } from '../repositories';

export function toTeamResponse(team: TeamRecord): TeamResponseDto {
  return {
    id: team.id,
    companyId: team.companyId,
    divisionId: team.divisionId,
    name: team.name,
    leadMemberId: team.leadMemberId,
    leadMember: team.leadMember
      ? {
          id: team.leadMember.id,
          name: team.leadMember.name,
          email: team.leadMember.email,
          designation: team.leadMember.roleTitle,
        }
      : null,
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
    member: {
      id: record.member.id,
      name: record.member.name,
      email: record.member.email,
      designation: record.member.roleTitle,
    },
  };
}
