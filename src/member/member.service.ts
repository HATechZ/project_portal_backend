import { HttpStatus, Injectable } from '@nestjs/common';
import { AppErrorCode } from '../common/exceptions/app-error-code';
import { AppException } from '../common/exceptions/app-exception';
import { paginate } from '../common/pagination/paginate';
import { PaginatedResult } from '../common/pagination/paginated-result';
import { ActorScopeContext } from '../common/security/object-scope.provider';
import {
  CreateMemberDto,
  MemberAccessLinkDto,
  MemberQueryDto,
  MemberResponseDto,
  UpdateMemberDto,
} from './dtos';
import {
  MemberScopeProvider,
  assertMemberUpdateHasFields,
  memberNotFound,
  scopedCompanyNotFound,
  toMemberResponse,
} from './providers';
import {
  MemberAccessRepository,
  MemberRecord,
  MemberRelationsRepository,
  MemberRepository,
  ScopedCompanyRecord,
} from './repositories';

@Injectable()
export class MemberService {
  constructor(
    private readonly repository: MemberRepository,
    private readonly accessRepository: MemberAccessRepository,
    private readonly relationsRepository: MemberRelationsRepository,
    private readonly scopeProvider: MemberScopeProvider,
  ) {}

  async findAll(
    query: MemberQueryDto,
    actor: ActorScopeContext,
  ): Promise<PaginatedResult<MemberResponseDto>> {
    const company = await this.requireScopedCompany();
    const divisionIds = await this.scopeProvider.resolveReadableDivisionIds(
      actor,
      company.id,
      query.divisionId,
    );
    return paginate(
      query,
      async (args) =>
        (await this.repository.findAll(company.id, divisionIds, args)).map(
          toMemberResponse,
        ),
      () => this.repository.count(company.id, divisionIds),
    );
  }

  async findOne(
    id: string,
    actor: ActorScopeContext,
  ): Promise<MemberResponseDto> {
    const company = await this.requireScopedCompany();
    const member = await this.requireMember(id, company.id);
    const divisionIds = await this.scopeProvider.resolveReadableDivisionIds(
      actor,
      company.id,
      member.divisionId,
    );
    void divisionIds;
    return toMemberResponse(member);
  }

  async create(
    input: CreateMemberDto,
    actor: ActorScopeContext,
  ): Promise<MemberResponseDto> {
    const company = await this.requireScopedCompany();
    await this.scopeProvider.assertCanCreate(
      actor,
      company.id,
      input.divisionId,
    );
    return toMemberResponse(
      await this.repository.create(company.id, {
        name: input.name,
        email: input.email,
        roleTitle: input.roleTitle,
        divisionId: input.divisionId,
        isActive: input.isActive ?? true,
      }),
    );
  }

  async update(
    id: string,
    input: UpdateMemberDto,
    actor: ActorScopeContext,
  ): Promise<MemberResponseDto> {
    this.scopeProvider.assertSystemAdmin(actor);
    assertMemberUpdateHasFields(input);
    const company = await this.requireScopedCompany();
    const member = await this.requireMember(id, company.id);
    if (input.divisionId) {
      await this.assertDivisionMove(member, company.id, input.divisionId);
    }
    return toMemberResponse(
      await this.repository.update(id, company.id, input),
    );
  }

  async delete(id: string, actor: ActorScopeContext): Promise<void> {
    this.scopeProvider.assertSystemAdmin(actor);
    const company = await this.requireScopedCompany();
    await this.requireMember(id, company.id);
    const blockers = await this.relationsRepository.findDeleteBlockers(
      id,
      company.id,
    );
    if (blockers.length > 0) {
      throw new AppException({
        code: AppErrorCode.Conflict,
        status: HttpStatus.CONFLICT,
        message: 'Member has dependent records and cannot be deleted',
        details: { blockers },
      });
    }
    await this.repository.delete(id, company.id);
  }

  async linkAccess(
    id: string,
    input: MemberAccessLinkDto,
    actor: ActorScopeContext,
  ): Promise<MemberResponseDto> {
    this.scopeProvider.assertSystemAdmin(actor);
    const company = await this.requireScopedCompany();
    await this.requireMember(id, company.id);
    return toMemberResponse(
      await this.accessRepository.linkExistingAccess({
        memberId: id,
        companyId: company.id,
        userId: input.userId,
        actorProfileId: input.actorProfileId,
      }),
    );
  }

  private async requireScopedCompany(): Promise<ScopedCompanyRecord> {
    const company = await this.repository.findScopedCompany();
    if (!company) throw scopedCompanyNotFound();
    return company;
  }

  private async requireMember(
    id: string,
    companyId: string,
  ): Promise<MemberRecord> {
    const member = await this.repository.findById(id, companyId);
    if (!member) throw memberNotFound(id);
    return member;
  }

  private async assertDivisionMove(
    member: MemberRecord,
    companyId: string,
    divisionId: string,
  ): Promise<void> {
    if (!(await this.repository.findDivision(divisionId, companyId))) {
      throw memberNotFound(divisionId);
    }
    if (
      member.divisionId !== divisionId &&
      (await this.relationsRepository.hasCrossDivisionTeamLinks(
        member.id,
        divisionId,
      ))
    ) {
      throw new AppException({
        code: AppErrorCode.Conflict,
        status: HttpStatus.CONFLICT,
        message: 'Member has active Team relations in another Division',
      });
    }
  }
}
