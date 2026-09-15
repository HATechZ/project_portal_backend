# Tasks: 04.1 - Division

**Status:** Gate 5 - COMPLETE - 11/11 verified 2026-09-15
**Spec Reference:** `SPEC.md` - **Plan Reference:** `plan.md`

Runtime evidence is separately recorded in `walkthrough.md`. Implement in this module before
`04.2-member`.

- [x] **Phase 1: module and read boundary**
  - [x] Create the Division module/controller/service/repository/DTO tree; depend on `04-organization`, use no feature-module imports, and register it only after implementation begins. Validate controller routing is persistence-free; cover list/detail pagination and Tenant isolation; complete when the module is mapped and focused tests pass.
        VERIFY: test -f src/division/division.module.ts && grep -q "extends BaseRepository" src/division/repositories/division.repository.ts && ! grep -qE "PrismaService|prisma\\.|findMany|findUnique" src/division/division.controller.ts && grep -q "src/division/division.module.ts" specs/PLACEHOLDERS.md
  - [x] Implement scoped list/detail and response mapping; depend on the module tree, query only through ambient Tenant UnitOfWork, order `name,id`, and never serialize ownership override/login fields. Test malformed, missing, foreign, and pagination cases; complete when repository predicates and focused tests prove scope.
        VERIFY: grep -q "orderBy" src/division/repositories/division.repository.ts && grep -q "tenantId" src/division/repositories/division.repository.ts && corepack yarn test --runInBand --testPathPatterns=division

- [x] **Phase 2: guarded Division mutation**
  - [x] Implement create from trusted Tenant and scoped Company only; depend on read scope, generate the ID in application code, allow only name/abbr/optional DivisionType, and create no identity/member/team/lead. Test rejected ownership/system fields and successful isolated creation; complete when DTO/service/repository tests pass.
        VERIFY: grep -q "randomUUID" src/division/repositories/division.repository.ts && ! grep -qE "tenantId|companyId|isActive|leadMemberId|userId|memberId|teamId" src/division/dtos/create-division.dto.ts && corepack yarn test --runInBand --testPathPatterns=division
  - [x] Implement partial update allow-list; depend on create, reject empty/null/immutable input, preserve Tenant/Company/ID/isActive, and validate supplied global DivisionType. Test fields, duplicate abbreviation, unknown type, and foreign target; complete when tests and allow-list assertion pass.
        VERIFY: grep -q "PartialType\|at least one" src/division/dtos/update-division.dto.ts && ! grep -qE "tenantId|companyId|isActive|createdAt" src/division/dtos/update-division.dto.ts && corepack yarn test --runInBand --testPathPatterns=division
  - [x] Implement guarded hard delete; depend on scoped reads, probe every current Division inverse relation before delete, return 409 on any dependency, and never cascade/remove dependents. Test all five blockers and a clear delete; complete when the dependency tests pass.
        VERIFY: grep -qE "membersByDivisionId|teamsByDivisionId|projectsByOriginDivisionId|workRequestsByAssignedDivisionId|workRequestsByOriginDivisionId" src/division/repositories/division.repository.ts && corepack yarn test --runInBand --testPathPatterns=division

- [x] **Phase 3: authorization and platform conformance**
  - [x] Apply the established guard chain and `ADD_DIVISION`; depend on mutation routes, require configured permission and same-Company system_admin without wildcard bypass, and deny division_head/division_lead/team_lead for Division-master CRUD unless later owner approval adds that exact policy. Test 401, 403, own-Tenant allow, foreign-Tenant 404; complete when guard and authorization tests pass.
        VERIFY: grep -q "SystemAdminGuard" src/division/division.controller.ts && grep -q "ADD_DIVISION" src/division/division.controller.ts && corepack yarn test --runInBand --testPathPatterns=division
  - [x] Implement Assign Division Lead orchestration; depend on existing Member/User/UserRole/ActorProfile model, require same-Division linked-User Member, idempotently ensure `division_lead` UserRole and ActorProfile, link profile to Member, and create no Division lead field/table/role/User/password/session. Complete when focused tests pass.
        VERIFY: grep -q "@Put(':id/lead')" src/division/division-lead.controller.ts && grep -q "ActorRoleCode.division_lead" src/division/repositories/division-lead.repository.ts && ! grep -q "leadMemberId" src/division/dtos/*.ts && corepack yarn test --runInBand --testPathPatterns=division && corepack yarn test --runInBand --testPathPatterns=actor-access
  - [x] Keep services free of Prisma exception catches and infrastructure; depend on all operations, use AppExceptions only for domain outcomes, and rely on centralized Prisma mapping. Test 400/404/409 envelope codes; complete when static and focused tests pass.
        VERIFY: ! grep -rE "PrismaClientKnownRequestError|PrismaService|app_relay" src/division --include='*.service.ts' && corepack yarn test --runInBand --testPathPatterns=division

- [x] **Phase 4: independent verification and sign-off**
  - [x] Add focused unit/integration tests for every positive and negative rule; depend on completed implementation, include no-login/no-side-effect proof, type/unique/race behavior, all authorization cases, and deletion blockers. Complete when the independent test command exits zero.
        VERIFY: corepack yarn test --runInBand --testPathPatterns=division
  - [x] Execute and record the production HTTP/RLS walkthrough; depend on tests, use app_user with isolated cleanup, cover all six routes, 400/401/403/404/409, two-Tenant isolation, envelope, and x-request-id. Complete only with PASS evidence and cleanup.
        VERIFY: test -f specs/04.1-division/walkthrough.md && node scripts/verify-division-evidence.cjs http
  - [x] Run final module/repository boundary checks; depend on walkthrough, confirm no cross-feature import or transport write, lint/build/spec checks, and update INDEX only after independent verification. Complete when all commands pass.
        VERIFY: test $(grep -rlE "from '\.\.?/(\.\./)?(auth|user|company|member|team)/" src/division --include=*.ts | wc -l) -eq 0 && corepack yarn lint && corepack yarn build && corepack yarn verify:spec -- --module 04.1-division && node scripts/verify-division-evidence.cjs http
