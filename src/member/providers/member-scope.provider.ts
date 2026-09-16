import { ForbiddenException, Injectable } from '@nestjs/common';
import { ActorRoleCode } from '../../generated/prisma/client';
import { ActorScopeContext } from '../../common/security/object-scope.provider';
import { MemberRepository } from '../repositories';

@Injectable()
export class MemberScopeProvider {
  constructor(private readonly repository: MemberRepository) {}

  async resolveReadableDivisionIds(
    actorProfile: ActorScopeContext,
    companyId: string,
    requestedDivisionId?: string,
  ): Promise<string[]> {
    if (actorProfile.roleCode === ActorRoleCode.system_admin) {
      if (requestedDivisionId) {
        await this.requireScopedDivision(requestedDivisionId, companyId);
        return [requestedDivisionId];
      }
      return this.findCompanyDivisionIds(companyId);
    }

    const divisionIds = await this.resolveActorDivisionIds(actorProfile);
    if (requestedDivisionId) {
      if (!divisionIds.includes(requestedDivisionId)) {
        throw new ForbiddenException(
          'Requested Division is outside actor scope',
        );
      }
      return [requestedDivisionId];
    }
    return divisionIds;
  }

  async assertCanCreate(
    actorProfile: ActorScopeContext,
    companyId: string,
    divisionId: string,
  ): Promise<void> {
    await this.requireScopedDivision(divisionId, companyId);
    if (actorProfile.isSystemRole === false) {
      this.assertCustomRoleScope(actorProfile, companyId, divisionId);
      return;
    }
    if (actorProfile.roleCode === ActorRoleCode.system_admin) return;
    const actorDivisionIds = await this.resolveActorDivisionIds(actorProfile);
    if (!actorDivisionIds.includes(divisionId)) {
      throw new ForbiddenException('Member creation is outside actor scope');
    }
  }

  private assertCustomRoleScope(
    actor: ActorScopeContext,
    companyId: string,
    divisionId: string,
  ): void {
    const member = actor.member;
    if (!member?.active || !member.companyActive) {
      throw new ForbiddenException('Member actor scope required');
    }
    if (
      actor.customScope === 'division' &&
      member.divisionActive &&
      member.divisionId === divisionId
    )
      return;
    if (actor.customScope === 'company' && member.companyId === companyId)
      return;
    throw new ForbiddenException('Member creation is outside actor scope');
  }

  assertSystemAdmin(actorProfile: ActorScopeContext): void {
    if (actorProfile.roleCode !== ActorRoleCode.system_admin) {
      throw new ForbiddenException('System administrator access required');
    }
  }

  /**
   * 04.1.1 DR-09: Division authority is a set, never one column.
   *
   * A `division_lead` is scoped by its active `division_leads` rows. An empty
   * set is refused outright (AC-S02) — falling back to the actor's own home
   * Division would grant authority nobody assigned.
   */
  private async resolveActorDivisionIds(
    actorProfile: ActorScopeContext,
  ): Promise<string[]> {
    if (actorProfile.roleCode === ActorRoleCode.division_lead) {
      const led = actorProfile.member?.ledDivisionIds ?? [];
      if (led.length === 0) {
        throw new ForbiddenException('Division lead has no assigned Division');
      }
      return led;
    }

    // Team-Lead fallback: a separate authority path, unrelated to Division
    // leadership and deliberately left unchanged by 04.1.1.
    const actorMemberId = actorProfile.member?.id;
    if (actorMemberId) {
      const ledDivisionId = await this.repository.findLedTeamDivisionId(
        actorMemberId,
        actorProfile.actorProfileId,
      );
      if (ledDivisionId) return [ledDivisionId];
    }
    throw new ForbiddenException('Member actor scope required');
  }

  private async requireScopedDivision(
    divisionId: string,
    companyId: string,
  ): Promise<void> {
    if (!(await this.repository.findDivision(divisionId, companyId))) {
      throw new ForbiddenException('Division is outside actor scope');
    }
  }

  private findCompanyDivisionIds(companyId: string): Promise<string[]> {
    return this.repository.findCompanyDivisionIds(companyId);
  }
}
