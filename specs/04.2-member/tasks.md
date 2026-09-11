# Tasks: 04.2 — Member

**Status:** Phase 4 · 7/10 implemented; Gate 5 blocked on app_user `members` write privilege  
**Spec Reference:** `SPEC.md` · **Plan Reference:** `plan.md`

All leaves remain unticked. Start only after `04.1-division` is complete. Each runtime task
requires isolated-fixture cleanup and recorded evidence; static assertions never require a DB.

- [x] **Phase 1: Member CRUD foundation**
  - [x] Create the Member module tree and scoped read routes; depend on Division completion, register the feature module at implementation time, use BaseRepository/ambient UnitOfWork, and keep the controller query-free. Test list/detail pagination, division-filter scope, malformed/missing/foreign IDs; complete when structure and focused tests pass.
        VERIFY: test -f src/member/member.module.ts && grep -q "extends BaseRepository" src/member/repositories/member.repository.ts && ! grep -qE "PrismaService|prisma\\.|findMany|findUnique" src/member/member.controller.ts && grep -q "src/member/member.module.ts" specs/PLACEHOLDERS.md && corepack yarn test --runInBand --testPathPatterns=member
  - [x] Implement V1 onboarding create/update DTO allow-lists; depend on scoped reads, derive Tenant/Company, validate actor-scoped Division and Tenant-unique business email, require password and roleId on create, reject forbidden ownership/User/ActorProfile/hash/Team fields, create no Team assignment, and block a Division move that conflicts with active Team lead/membership. Test atomic User/Member/UserRole/ActorProfile onboarding, no persistence-level Team assignment, safe move, conflict move, and invalid input; complete when DTO/service tests pass.
        VERIFY: grep -qE "password|roleId" src/member/dtos/create-member.dto.ts && ! grep -qE "tenantId|companyId|userId|actorProfileId|passwordHash|confirmPassword|teamId" src/member/dtos/create-member.dto.ts && ! grep -qE "userId|password|roleId|actorProfileId|teamId|tenantId|companyId" src/member/dtos/update-member.dto.ts && grep -qE "teamsByLeadMemberId|teamMembersByMemberId" src/member/repositories/member.repository.ts && corepack yarn test --runInBand --testPathPatterns=member
  - [x] Implement guarded Member delete; depend on CRUD, audit every current inverse relation, return 409 before deleting any dependent, and never use cascade/SetNull as cleanup. Test all blockers and clear delete; complete when relation tests pass.
        VERIFY: grep -qE "actorProfilesByMemberId|teamsByLeadMemberId|teamMembersByMemberId|workRequestAssignmentsByMemberId|workflowInfoRequestsByRequestedByMemberId|workflowInfoRequestsByTargetMemberId|workRequestRevisionRequestsByRequestedToMemberId" src/member/repositories/member.repository.ts && corepack yarn test --runInBand --testPathPatterns=member

- [x] **Phase 2: explicit User/ActorProfile linking**
  - [x] Preserve only the exceptional existing-User access-link endpoint; depend on Member CRUD, keep normal onboarding in `POST /member`, prohibit password/session/role creation in access-link, link `userId` only after same-Tenant validation, and preserve the nullable unlinked state for legacy/exceptional rows. Test User creation/role assignment produces no Member and foreign User concealment; complete when tests pass.
        VERIFY: grep -q "access-link" src/member/member.controller.ts && ! grep -E "passwordHash|createSession|userRole\.create" src/member/repositories/member-access.repository.ts && corepack yarn test --runInBand --testPathPatterns=member
  - [x] Implement optional existing ActorProfile target linking; depend on User link, validate same User/Tenant, active profile and non-revoked matching role grant, never create a role/profile or switch default, and perform link checks/writes atomically. Test every incompatible relationship and race; complete when serializable-link tests pass.
        VERIFY: grep -qE "actorProfile|revokedAt|isActive" src/member/repositories/member-access.repository.ts && ! grep -qE "actorProfile\.create|userRole\.create|setDefault" src/member/repositories/member-access.repository.ts && corepack yarn test --runInBand --testPathPatterns=member

- [x] **Phase 3: authorization and error behavior**
  - [x] Apply Member authorization scopes; depend on routes, allow `system_admin` Member creation anywhere in own Company, `division_head` own-Company leadership/member scope, `division_lead` creation only in own Division, and `team_lead` ordinary Member creation only in exact led-Team scope; preserve configured `ADD_MEMBER`/object scope, keep update/delete/access-link on existing system_admin authority unless later contracts expand it, and retain 401/403/foreign-404 semantics. Test every actor and Tenant/Company/Division/Team direction; complete when guard and authorization tests pass.
        VERIFY: grep -q "ADD_MEMBER" src/member/member.controller.ts && grep -qE "division_lead|leadMemberId|actorProfile|memberId|divisionId" src/member/providers/member-scope.provider.ts && corepack yarn test --runInBand --testPathPatterns=member
  - [x] Preserve centralized conflict mapping and layering; depend on completed writes, use explicit AppExceptions only for business outcomes, no app_relay or feature import, and test 400/404/409 envelopes. Complete when boundary checks and tests pass.
        VERIFY: ! grep -rE "PrismaClientKnownRequestError|PrismaService|app_relay" src/member --include='*.service.ts' && test $(grep -rlE "from '\.\.?/(\.\./)?(auth|user|company|division|team)/" src/member --include=*.ts | wc -l) -eq 0 && corepack yarn test --runInBand --testPathPatterns=member

- [ ] **Phase 4: independent verification and sign-off**
  - [ ] Add focused tests for all CRUD/link/onboarding/identity-separation requirements; depend on implementation, prove `POST /member` creates linked User/UserRole/Member-backed ActorProfile atomically, access-link remains exceptional, no automatic Member from standalone User/UserRole, legacy unlinked Member validity, no automatic Team assignment from Member creation, delete blocking, uniqueness, and authorization matrix. Complete only when independent tests exit zero.
        VERIFY: corepack yarn test --runInBand --testPathPatterns=member
  - [ ] Execute and record Member HTTP/RLS evidence; depend on tests, use real app_user/RLS and cleanup, cover every route plus 400/401/403/404/409, link behavior, two-Tenant isolation, envelope, and request ID. Complete only with PASS evidence.
        VERIFY: test -f specs/04.2-member/walkthrough.md && node scripts/verify-member-evidence.cjs http
  - [ ] Run final checks and update status; depend on walkthrough, run lint/build/spec/strict SDD and update INDEX only after independent verification. Complete when every command passes.
        VERIFY: corepack yarn lint && corepack yarn build && corepack yarn verify:spec -- --module 04.2-member && corepack yarn verify:sdd:strict
