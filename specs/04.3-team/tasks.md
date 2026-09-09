# Tasks: 04.3 — Team

**Status:** Gate 3 · approved target · 0/10 implemented  
**Spec Reference:** `SPEC.md` · **Plan Reference:** `plan.md`

All leaves remain unticked. Start only after `04.2-member` is complete. Static assertions must
not need a database; runtime leaves require isolated fixture cleanup and `walkthrough.md` evidence.

- [ ] **Phase 1: Team CRUD boundary**
  - [ ] Create the Team module/controller/service/repository/DTO tree; depend on Member completion, register it when implementation starts, keep controller persistence-free, and use BaseRepository/ambient UnitOfWork. Test scoped list/detail/pagination and malformed/missing/foreign IDs; complete when structure and focused tests pass.
        VERIFY: test -f src/team/team.module.ts && grep -q "extends BaseRepository" src/team/repositories/team.repository.ts && ! grep -qE "PrismaService|prisma\\.|findMany|findUnique" src/team/team.controller.ts && grep -q "src/team/team.module.ts" specs/PLACEHOLDERS.md && corepack yarn test --runInBand --testPathPatterns=team
  - [ ] Implement create/name-only update/guarded delete; depend on scoped reads, derive Tenant/Company, validate Division and optional active lead, allow no generic ownership/lead/activation change, and block delete on all membership history. Test constraints, lead eligibility and empty/history delete cases; complete when tests pass.
        VERIFY: ! grep -qE "tenantId|companyId|divisionId|leadMemberId|isActive|memberIds" src/team/dtos/update-team.dto.ts && grep -q "teamMembers" src/team/repositories/team.repository.ts && corepack yarn test --runInBand --testPathPatterns=team

- [ ] **Phase 2: lead and membership operations**
  - [ ] Implement dedicated Team Lead assignment/change; depend on Team CRUD, validate the selected active existing Member is same Tenant/Company/Division, never create Member/User/role, and test every foreign/inactive/mismatched candidate. Complete when route and focused tests pass.
        VERIFY: grep -q "@Put.*lead\|@Put('.*lead" src/team/team.controller.ts && ! grep -rE "member\.create|user\.create|userRole\.create|actorProfile\.create" src/team --include='*.ts' && corepack yarn test --runInBand --testPathPatterns=team
  - [ ] Implement Team-member list/add/end in the Team module; depend on lead assignment, accept only existing eligible same-Division Members, preserve optional teamRole/joinedAt/leftAt, create no Member, and reject client member arrays. Test current/history list behavior; complete when contract tests pass.
        VERIFY: grep -qE "team-members|team/:id/member|@.*member" src/team/team.controller.ts && ! grep -rqE "memberIds|create-member" src/team && corepack yarn test --runInBand --testPathPatterns=team
  - [ ] Serialize active membership mutation; depend on membership routes, reject a duplicate active pair with 409, end only the active row by setting leftAt, permit a fresh row after end, and never delete history. Test concurrency and re-add sequence; complete when tests pass.
        VERIFY: grep -qE "leftAt.*null|null.*leftAt" src/team/repositories/team-membership.repository.ts && ! grep -q "teamMember.delete" src/team/repositories/team-membership.repository.ts && corepack yarn test --runInBand --testPathPatterns=team

- [ ] **Phase 3: exact authorization scopes**
  - [ ] Enforce system_admin Team management with configured `ADD_TEAM`; depend on CRUD/lead routes, preserve ordinary object scope and no wildcard bypass, and test own-Company allow plus absent-action/non-admin/foreign denial. Complete when guard tests pass.
        VERIFY: grep -q "SystemAdminGuard" src/team/team.controller.ts && grep -q "ADD_TEAM" src/team/team.controller.ts && corepack yarn test --runInBand --testPathPatterns=team
  - [ ] Enforce division_lead own-Division Team scope; depend on actor context, resolve active ActorProfile → Member → Division for every create/manage/lead operation, deny other Division even with permission, and test both cases. Complete when resolver tests pass.
        VERIFY: grep -qE "division_lead|actorProfile|memberId|divisionId" src/team/providers/team-scope.provider.ts && corepack yarn test --runInBand --testPathPatterns=team
  - [ ] Enforce contextual Team Lead membership-only scope; depend on membership routes, require actor Member ID equals exact Team leadMemberId plus `ASSIGN_MEMBER`, deny Team creation/new Member/other Team, and create no lead ActorRole. Test positive/negative exact-team behavior; complete when tests pass.
        VERIFY: grep -q "ASSIGN_MEMBER" src/team/team.controller.ts && grep -q "leadMemberId" src/team/providers/team-scope.provider.ts && ! grep -rq "team_lead" src/team prisma/schema.prisma && corepack yarn test --runInBand --testPathPatterns=team

- [ ] **Phase 4: boundaries, runtime proof, sign-off**
  - [ ] Preserve layering and central error mapping; depend on all operations, use no app_relay or feature-module import and no service Prisma catch, and test 400/401/403/404/409 platform envelopes. Complete when static boundary and tests pass.
        VERIFY: ! grep -rE "PrismaClientKnownRequestError|PrismaService|app_relay" src/team --include='*.service.ts' && test $(grep -rlE "from '\.\.?/(\.\./)?(auth|user|company|division|member)/" src/team --include=*.ts | wc -l) -eq 0 && corepack yarn test --runInBand --testPathPatterns=team
  - [ ] Execute and record HTTP/RLS walkthrough; depend on independent tests, use real app_user/RLS and cleanup, cover every Team/membership route, all actor scopes, two-Tenant isolation, errors/envelopes/request IDs, and membership history. Complete only with PASS evidence.
        VERIFY: test -f specs/04.3-team/walkthrough.md && node scripts/verify-team-evidence.cjs http
  - [ ] Run final checks and update INDEX; depend on walkthrough, run lint/build/spec/strict SDD and change status only after independent verification. Complete when every command passes.
        VERIFY: corepack yarn lint && corepack yarn build && corepack yarn verify:spec -- --module 04.3-team && corepack yarn verify:sdd:strict
