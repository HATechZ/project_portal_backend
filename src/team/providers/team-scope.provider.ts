import { ForbiddenException, Injectable } from '@nestjs/common';
import { ActorScopeContext } from '../../common/security/object-scope.provider';
import { ActorRoleCode } from '../../generated/prisma/client';
import { TeamRecord, TeamRepository } from '../repositories';

@Injectable()
export class TeamScopeProvider {
  constructor(private readonly repository: TeamRepository) {}

  async resolveManageDivisionIds(
    actor: ActorScopeContext,
    companyId: string,
    requestedDivisionId?: string,
  ): Promise<string[]> {
    if (
      actor.roleCode === ActorRoleCode.system_admin ||
      actor.roleCode === ActorRoleCode.division_head
    ) {
      if (requestedDivisionId) {
        await this.requireScopedDivision(requestedDivisionId, companyId);
        return [requestedDivisionId];
      }
      return this.repository.findCompanyDivisionIds(companyId);
    }
    if (actor.roleCode !== ActorRoleCode.division_lead) {
      throw new ForbiddenException('Team management is outside actor scope');
    }
    const divisionIds = this.requireLedDivisions(actor);
    if (requestedDivisionId && !divisionIds.includes(requestedDivisionId)) {
      throw new ForbiddenException('Requested Division is outside actor scope');
    }
    const scoped = requestedDivisionId ? [requestedDivisionId] : divisionIds;
    for (const divisionId of scoped) {
      await this.requireScopedDivision(divisionId, companyId);
    }
    return scoped;
  }

  async assertCanManageTeam(
    actor: ActorScopeContext,
    companyId: string,
    team: TeamRecord,
  ): Promise<void> {
    const allowedDivisionIds = await this.resolveManageDivisionIds(
      actor,
      companyId,
      team.divisionId,
    );
    if (!allowedDivisionIds.includes(team.divisionId)) {
      throw new ForbiddenException('Team is outside actor scope');
    }
  }

  assertCanManageMembership(actor: ActorScopeContext, team: TeamRecord): void {
    if (actor.roleCode === ActorRoleCode.system_admin) return;
    if (actor.roleCode === ActorRoleCode.division_head) return;
    if (
      actor.roleCode === ActorRoleCode.division_lead &&
      (actor.member?.ledDivisionIds ?? []).includes(team.divisionId)
    ) {
      return;
    }
    if (actor.member?.id && actor.member.id === team.leadMemberId) {
      return;
    }
    throw new ForbiddenException('Team membership is outside actor scope');
  }

  /**
   * 04.1.1 AC-S02: the `division_lead` role conveys no Division by itself.
   * Authority is the active `division_leads` set; empty is refused rather
   * than defaulted to the actor's home Division.
   */
  private requireLedDivisions(actor: ActorScopeContext): string[] {
    const led = actor.member?.ledDivisionIds ?? [];
    if (led.length === 0) {
      throw new ForbiddenException('Division lead Member context required');
    }
    return led;
  }

  private async requireScopedDivision(
    divisionId: string,
    companyId: string,
  ): Promise<void> {
    if (!(await this.repository.findDivision(divisionId, companyId))) {
      throw new ForbiddenException('Division is outside actor scope');
    }
  }
}
