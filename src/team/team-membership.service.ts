import { Injectable } from '@nestjs/common';
import {
  AddTeamMemberDto,
  TeamMemberQueryDto,
  TeamMemberResponseDto,
} from './dtos';
import { teamScopeConflict, toTeamMemberResponse } from './providers';
import { TeamMembershipRepository } from './repositories';
import { TeamService } from './team.service';

@Injectable()
export class TeamMembershipService {
  constructor(
    private readonly teamService: TeamService,
    private readonly membershipRepository: TeamMembershipRepository,
  ) {}

  async listMembers(
    id: string,
    query: TeamMemberQueryDto,
  ): Promise<TeamMemberResponseDto[]> {
    const company = await this.teamService.requireScopedCompany();
    await this.teamService.requireTeam(id, company.id);
    return (
      await this.membershipRepository.listMembers(id, query.includeEnded)
    ).map(toTeamMemberResponse);
  }

  async addMember(
    id: string,
    input: AddTeamMemberDto,
  ): Promise<TeamMemberResponseDto> {
    const company = await this.teamService.requireScopedCompany();
    const team = await this.teamService.requireTeam(id, company.id);
    await this.teamService.assertEligibleMember(
      input.memberId,
      company.id,
      team.divisionId,
    );
    if (
      await this.membershipRepository.findActiveMembership(id, input.memberId)
    ) {
      throw teamScopeConflict('This member is already active on this team.');
    }
    return toTeamMemberResponse(
      await this.membershipRepository.addMember(
        id,
        input.memberId,
        input.teamRole,
      ),
    );
  }

  async removeMember(id: string, memberId: string): Promise<void> {
    const company = await this.teamService.requireScopedCompany();
    const team = await this.teamService.requireTeam(id, company.id);
    await this.teamService.assertEligibleMember(
      memberId,
      company.id,
      team.divisionId,
    );
    await this.membershipRepository.endMember(id, memberId);
  }
}
