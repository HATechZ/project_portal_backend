import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { AppErrorCode } from '../common/exceptions/app-error-code';
import { AppException } from '../common/exceptions/app-exception';
import { paginate } from '../common/pagination/paginate';
import { PaginatedResult } from '../common/pagination/paginated-result';
import { ActorScopeContext } from '../common/security/object-scope.provider';
import {
  PASSWORD_HASHER,
  type PasswordHasher,
} from '../infra/crypto/password-hasher.port';
import {
  CreateMemberDto,
  MemberAccessLinkDto,
  MemberQueryDto,
  LedDivisionResponseDto,
  MemberResponseDto,
  UpdateMemberDto,
} from './dtos';
import {
  MemberScopeProvider,
  assertMemberUpdateHasFields,
  memberNotFound,
  assertDivisionMove,
  scopedCompanyNotFound,
  toMemberResponse,
} from './providers';
import {
  MemberAccessRepository,
  MemberOnboardingRepository,
  MemberRecord,
  MemberRelationsRepository,
  MemberRemovalRepository,
  MemberRepository,
  ScopedCompanyRecord,
} from './repositories';

@Injectable()
export class MemberService {
  constructor(
    private readonly repository: MemberRepository,
    private readonly accessRepository: MemberAccessRepository,
    private readonly onboardingRepository: MemberOnboardingRepository,
    private readonly relationsRepository: MemberRelationsRepository,
    private readonly scopeProvider: MemberScopeProvider,
    @Inject(PASSWORD_HASHER) private readonly passwordHasher: PasswordHasher,
    private readonly removalRepository: MemberRemovalRepository,
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

  /**
   * Divisions this Member actively leads. Empty array, not 404, when it leads
   * none (04.1.1 DR-10 — Lead-less is a valid state).
   */
  async findLedDivisions(
    id: string,
    actor: ActorScopeContext,
  ): Promise<LedDivisionResponseDto[]> {
    const company = await this.requireScopedCompany();
    const member = await this.requireMember(id, company.id);
    await this.scopeProvider.resolveReadableDivisionIds(
      actor,
      company.id,
      member.divisionId,
    );
    return this.repository.findLedDivisions(member.id, company.id);
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
    await this.requireDesignation(input.designationId, company.id);
    const passwordHash = await this.passwordHasher.hash(input.password);
    return toMemberResponse(
      await this.onboardingRepository.createWithAccess(company.id, {
        name: input.name,
        email: input.email,
        passwordHash,
        divisionId: input.divisionId,
        designationId: input.designationId,
        phone: input.phone,
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
    if (input.designationId !== undefined) {
      await this.requireDesignation(input.designationId, company.id);
    }
    if (input.divisionId) {
      await assertDivisionMove(
        { repository: this.repository, relations: this.relationsRepository },
        member,
        company.id,
        input.divisionId,
      );
    }
    return toMemberResponse(
      await this.repository.update(id, company.id, input),
    );
  }

  async delete(id: string, actor: ActorScopeContext): Promise<void> {
    this.scopeProvider.assertSystemAdmin(actor);
    const company = await this.requireScopedCompany();
    await this.removalRepository.remove(id, company.id);
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

  private async requireDesignation(
    id: string,
    companyId: string,
  ): Promise<void> {
    if (await this.repository.findDesignation(id, companyId)) return;
    throw new AppException({
      code: AppErrorCode.NotFound,
      status: HttpStatus.NOT_FOUND,
      message: 'Designation was not found.',
    });
  }
}
