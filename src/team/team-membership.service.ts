import { Injectable } from '@nestjs/common';
import { ActorScopeContext } from '../common/security/object-scope.provider';
import {
  AddTeamMemberDto,
  TeamMemberQueryDto,
  TeamMemberResponseDto,
} from './dtos';
import {
  TeamScopeProvider,
  teamScopeConflict,
  toTeamMemberResponse,
} from './providers';
import { TeamMembershipRepository } from './repositories';
import { TeamService } from './team.service';

@Injectable()
export class TeamMembershipService {
  constructor(
    private readonly teamService: TeamService,
    private readonly membershipRepository: TeamMembershipRepository,
    private readonly scopeProvider: TeamScopeProvider,
  ) {}

  async listMembers(
    id: string,
    query: TeamMemberQueryDto,
    actor: ActorScopeContext,
  ): Promise<TeamMemberResponseDto[]> {
    const company = await this.teamService.requireScopedCompany();
    const team = await this.teamService.requireTeam(id, company.id);
    await this.teamService.assertTeamReadable(actor, company.id, team);
    return (
      await this.membershipRepository.listMembers(id, query.includeEnded)
    ).map(toTeamMemberResponse);
  }

  async addMember(
    id: string,
    input: AddTeamMemberDto,
    actor: ActorScopeContext,
  ): Promise<TeamMemberResponseDto> {
    const company = await this.teamService.requireScopedCompany();
    const team = await this.teamService.requireTeam(id, company.id);
    this.scopeProvider.assertCanManageMembership(actor, team);
    await this.teamService.assertEligibleMember(
      input.memberId,
      company.id,
      team.divisionId,
    );
    if (
      await this.membershipRepository.findActiveMembership(id, input.memberId)
    ) {
      throw teamScopeConflict('Member is already active on this Team');
    }
    return toTeamMemberResponse(
      await this.membershipRepository.addMember(
        id,
        input.memberId,
        input.teamRole,
      ),
    );
  }

  async removeMember(
    id: string,
    memberId: string,
    actor: ActorScopeContext,
  ): Promise<void> {
    const company = await this.teamService.requireScopedCompany();
    const team = await this.teamService.requireTeam(id, company.id);
    this.scopeProvider.assertCanManageMembership(actor, team);
    await this.teamService.assertEligibleMember(
      memberId,
      company.id,
      team.divisionId,
    );
    await this.membershipRepository.endMember(id, memberId);
  }
}
