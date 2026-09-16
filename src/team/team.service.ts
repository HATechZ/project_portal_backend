import { HttpStatus, Injectable } from '@nestjs/common';
import { AppErrorCode } from '../common/exceptions/app-error-code';
import { AppException } from '../common/exceptions/app-exception';
import { paginate } from '../common/pagination/paginate';
import { PaginatedResult } from '../common/pagination/paginated-result';
import { ActorScopeContext } from '../common/security/object-scope.provider';
import {
  AssignTeamLeadDto,
  CreateTeamDto,
  TeamQueryDto,
  TeamResponseDto,
  UpdateTeamDto,
} from './dtos';
import {
  TeamScopeProvider,
  teamNotFound,
  teamScopeConflict,
  toTeamResponse,
} from './providers';
import {
  ScopedCompanyRecord,
  TeamRecord,
  TeamRepository,
} from './repositories';

@Injectable()
export class TeamService {
  constructor(
    private readonly repository: TeamRepository,
    private readonly scopeProvider: TeamScopeProvider,
  ) {}

  async findAll(
    query: TeamQueryDto,
    actor: ActorScopeContext,
  ): Promise<PaginatedResult<TeamResponseDto>> {
    const company = await this.requireScopedCompany();
    const divisionIds = await this.scopeProvider.resolveManageDivisionIds(
      actor,
      company.id,
      query.divisionId,
    );
    return paginate(
      query,
      async (args) =>
        (await this.repository.findAll(company.id, divisionIds, args)).map(
          toTeamResponse,
        ),
      () => this.repository.count(company.id, divisionIds),
    );
  }

  async findOne(
    id: string,
    actor: ActorScopeContext,
  ): Promise<TeamResponseDto> {
    const company = await this.requireScopedCompany();
    const team = await this.requireTeam(id, company.id);
    await this.assertTeamReadable(actor, company.id, team);
    return toTeamResponse(team);
  }

  async create(
    input: CreateTeamDto,
    actor: ActorScopeContext,
  ): Promise<TeamResponseDto> {
    const company = await this.requireScopedCompany();
    await this.scopeProvider.resolveManageDivisionIds(
      actor,
      company.id,
      input.divisionId,
    );
    if (input.leadMemberId) {
      await this.assertEligibleMember(
        input.leadMemberId,
        company.id,
        input.divisionId,
      );
    }
    return toTeamResponse(await this.repository.create(company.id, input));
  }

  async update(
    id: string,
    input: UpdateTeamDto,
    actor: ActorScopeContext,
  ): Promise<TeamResponseDto> {
    const company = await this.requireScopedCompany();
    const team = await this.requireTeam(id, company.id);
    await this.scopeProvider.assertCanManageTeam(actor, company.id, team);
    return toTeamResponse(
      await this.repository.updateName(id, company.id, input.name),
    );
  }

  async delete(id: string, actor: ActorScopeContext): Promise<void> {
    const company = await this.requireScopedCompany();
    const team = await this.requireTeam(id, company.id);
    await this.scopeProvider.assertCanManageTeam(actor, company.id, team);
    if (await this.repository.hasAnyMembership(id)) {
      throw teamScopeConflict(
        'This team cannot be deleted because it has membership history. Deactivate it or preserve the existing history.',
      );
    }
    await this.repository.delete(id);
  }

  async assignLead(
    id: string,
    input: AssignTeamLeadDto,
    actor: ActorScopeContext,
  ): Promise<TeamResponseDto> {
    const company = await this.requireScopedCompany();
    const team = await this.requireTeam(id, company.id);
    await this.scopeProvider.assertCanManageTeam(actor, company.id, team);
    await this.assertEligibleMember(
      input.leadMemberId,
      company.id,
      team.divisionId,
    );
    return toTeamResponse(
      await this.repository.assignLead(id, company.id, input.leadMemberId),
    );
  }

  async requireScopedCompany(): Promise<ScopedCompanyRecord> {
    const company = await this.repository.findScopedCompany();
    if (!company) {
      throw new AppException({
        code: AppErrorCode.NotFound,
        status: HttpStatus.NOT_FOUND,
        message:
          'Company not found. It may have been removed or you may not have access to it.',
      });
    }
    return company;
  }

  async requireTeam(id: string, companyId: string): Promise<TeamRecord> {
    const team = await this.repository.findById(id, companyId);
    if (!team) throw teamNotFound(id);
    return team;
  }

  async assertTeamReadable(
    actor: ActorScopeContext,
    companyId: string,
    team: TeamRecord,
  ): Promise<void> {
    try {
      await this.scopeProvider.assertCanManageTeam(actor, companyId, team);
    } catch {
      this.scopeProvider.assertCanManageMembership(actor, team);
    }
  }

  async assertEligibleMember(
    memberId: string,
    companyId: string,
    divisionId: string,
  ): Promise<void> {
    const member = await this.repository.findMember(memberId, companyId);
    if (!member || member.divisionId !== divisionId || !member.isActive) {
      throw teamScopeConflict(
        'This member cannot be added to this team. Make sure the member is active and belongs to the same division.',
      );
    }
  }
}
