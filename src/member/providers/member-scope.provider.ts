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

    const divisionId = await this.resolveActorDivisionId(actorProfile);
    if (requestedDivisionId && requestedDivisionId !== divisionId) {
      throw new ForbiddenException('Requested Division is outside actor scope');
    }
    return [divisionId];
  }

  async assertCanCreate(
    actorProfile: ActorScopeContext,
    companyId: string,
    divisionId: string,
  ): Promise<void> {
    await this.requireScopedDivision(divisionId, companyId);
    if (actorProfile.roleCode === ActorRoleCode.system_admin) return;
    const actorDivisionId = await this.resolveActorDivisionId(actorProfile);
    if (actorDivisionId !== divisionId) {
      throw new ForbiddenException('Member creation is outside actor scope');
    }
  }

  assertSystemAdmin(actorProfile: ActorScopeContext): void {
    if (actorProfile.roleCode !== ActorRoleCode.system_admin) {
      throw new ForbiddenException('System administrator access required');
    }
  }

  private async resolveActorDivisionId(
    actorProfile: ActorScopeContext,
  ): Promise<string> {
    if (actorProfile.roleCode === ActorRoleCode.division_lead) {
      if (!actorProfile.member?.divisionId) {
        throw new ForbiddenException('Division lead Member context required');
      }
      return actorProfile.member.divisionId;
    }

    if (actorProfile.member?.id) {
      const leadMemberId = actorProfile.member.id;
      const ledDivisionId = await this.repository.findLedTeamDivisionId(
        leadMemberId,
        actorProfile.actorProfileId,
      );
      if (ledDivisionId) return ledDivisionId;
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
