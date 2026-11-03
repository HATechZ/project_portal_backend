import { EligibleMemberResponseDto } from '../dtos/eligible-member-response.dto';
import { EligibleMemberRecord } from '../repositories/member-eligibility.records';

export function toEligibleMember(
  member: EligibleMemberRecord,
): EligibleMemberResponseDto {
  return {
    memberId: member.id,
    name: member.name,
    email: member.email,
    isTeamLead: member.teamsByLeadMemberId.length > 0,
    activeTeamMemberships: member.teamMembersByMemberId.map(
      ({ team, teamRole }) => ({
        teamId: team.id,
        name: team.name,
        teamRole,
        isTeamLead: team.leadMemberId === member.id,
      }),
    ),
    ledTeams: member.teamsByLeadMemberId.map(({ id, name }) => ({
      teamId: id,
      name,
    })),
  };
}
