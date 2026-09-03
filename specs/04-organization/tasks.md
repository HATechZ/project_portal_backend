# Tasks: 04 — Organization

**Status:** Gate 4 — Phases 1–2 shipped, deviations open
**Spec Reference:** `specs/04-organization/SPEC.md`
**Plan Reference:** `specs/04-organization/plan.md`

> Governed by [`specs/RULES.md`](../RULES.md) **[Article II](../rules/02-proof.md)** — every leaf task
> carries a `VERIFY:` line. A task is ticked **only** when its command exits 0. Run:
>
> ```bash
> yarn verify:sdd --module 04
> ```
>
> Retro-spec. Phases 1–2 describe code that exists today; Phases 3–5 fail their assertions right
> now, which is correct. Nothing here is ticked on intent.

---

- [x] **Phase 1: Reads (shipped)**
  - [x] Keep the controller free of persistence
        VERIFY: ! grep -qE "PrismaService|prisma\.|findMany|findUnique" src/company/company.controller.ts
  - [x] Scope company reads to the tenant while leaving reference data global
        VERIFY: grep -q "extends BaseRepository" src/company/repositories/company.repository.ts && grep -q "db.company.findMany" src/company/repositories/company.repository.ts && grep -q "FROM public.company_types" src/company/repositories/company.repository.ts && grep -q "referenceRead" src/company/repositories/company.repository.ts && ! grep -q "unscoped" src/company/repositories/company.repository.ts
  - [x] Order by a total key so paging cannot repeat or skip a row
        VERIFY: grep -q "{ name: 'asc' }, { id: 'asc' }" src/company/repositories/company.repository.ts && grep -q "ORDER BY name ASC, id ASC" src/company/repositories/company.repository.ts
  - [x] Page through the platform helper rather than hand-rolled skip/take
        VERIFY: grep -q "paginate(" src/company/providers/company-query.provider.ts && grep -q "PaginationQueryDto" src/company/company.controller.ts
  - [x] Generate ids in the application, not the database
        VERIFY: grep -q "randomUUID()" src/company/repositories/company.repository.ts
  - [x] Name the missing id in a 404 rather than returning a bare status
        VERIFY: grep -q "was not found" src/company/providers/company-query.provider.ts
  - [x] Keep Prisma types out of the mapper so DTOs do not leak the record shape
        VERIFY: test -f src/company/providers/company.mapper.ts && ! grep -q "Prisma" src/company/providers/company.mapper.ts

- [x] **Phase 2: Guarded writes (shipped)**
  - [x] Apply the full guard chain at the controller, not per route
        VERIFY: grep -q "TenantContextGuard" src/company/company.controller.ts && grep -q "AccessTokenGuard" src/company/company.controller.ts && grep -q "AuthenticationGuard" src/company/company.controller.ts && grep -q "PermissionsGuard" src/company/company.controller.ts
  - [x] Retire tenant-scoped Company creation when the relationship becomes 1:1
        VERIFY: ! grep -q "@Post('company')" src/company/company.controller.ts
  - [x] Reject a malformed id before any query runs
        VERIFY: grep -q "ParseUUIDPipe" src/company/company.controller.ts
  - [x] Trim at the edge and again before the write, so whitespace cannot dodge the unique index
        VERIFY: grep -q "@Transform" src/company/dtos/create-company.dto.ts && grep -q "trim()" src/company/providers/company-mutation.provider.ts
  - [x] Turn an unknown company type into a 400 instead of a raw foreign key error
        VERIFY: grep -q "findCompanyType" src/company/providers/company-mutation.provider.ts && grep -q "P2003" src/company/providers/company-mutation.provider.ts

- [ ] **Phase 3: Close the remaining deviations**
  - [x] Route the repository through the unit of work so it can join a transaction
        VERIFY: grep -q "extends BaseRepository" src/company/repositories/company.repository.ts
  - [x] Stop injecting `PrismaService` into the repository (Art. X)
        VERIFY: ! grep -q "PrismaService" src/company/repositories/company.repository.ts
  - [ ] Delegate Prisma error translation to the global filter (Art. VI.4)
        VERIFY: ! grep -q "PrismaClientKnownRequestError" src/company/providers/company-mutation.provider.ts
  - [ ] Express the create input as a type instead of deleting fields and casting
        VERIFY: ! grep -q "as Prisma.CompanyUncheckedCreateInput" src/company/repositories/company.repository.ts

- [ ] **Phase 4: Mutation beyond create**
  - [ ] Allow a company to be renamed or retyped
        VERIFY: grep -qE "@(Patch|Put)\(" src/company/company.controller.ts
  - [ ] Deactivate rather than delete, so references survive
        VERIFY: grep -q "deactivate" src/company/providers/company-mutation.provider.ts && ! grep -q "company.delete" src/company/repositories/company.repository.ts

- [ ] **Phase 5: Sign-off**
  - [x] Register the module in `PLACEHOLDERS.md`
        VERIFY: grep -q "src/company/company.module.ts" specs/PLACEHOLDERS.md
  - [x] Import no other feature module ([Art. XI](../rules/10-messaging.md))
        VERIFY: test $(grep -rlE "from '\.\.?/(\.\./)?(auth|user|role-permission)/" src/company --include=*.ts | wc -l) -eq 0
  - [x] Lint and build clean
        VERIFY: corepack yarn lint && corepack yarn build
  - [ ] Record the HTTP walkthrough ([Art. V](../rules/05-walkthrough.md))
        VERIFY: test -f specs/04-organization/walkthrough.md && grep -qi "PASS\|FAIL" specs/04-organization/walkthrough.md

- [ ] **Phase 6: Company Workspace signup**
  - [ ] Make CompanyType reference options available before authentication
        VERIFY: test -f src/company/company-type.controller.ts && grep -q "@Get('company-type')" src/company/company-type.controller.ts && ! grep -q "company-type" src/company/company.controller.ts && grep -q "referenceRead" src/company/repositories/company.repository.ts
  - [ ] Expose only the public signup creation route
        VERIFY: grep -q "@Controller('company')" src/company/company-signup.controller.ts && grep -q "@Post('signup')" src/company/company-signup.controller.ts && ! grep -q "@Post('company')" src/company/company.controller.ts
  - [ ] Reject client-controlled infrastructure and confirmation fields
        VERIFY: grep -q "forbidNonWhitelisted" src/config/app-bootstrap.ts && ! grep -qE "tenantId|roleId|permissionIds|memberId|clientContactId|confirmPassword" src/company/dtos/company-signup.dto.ts
  - [ ] Require trimmed nested fields, CompanyType UUID, password policy, and accepted terms
        VERIFY: grep -q "CompanySignupDto" src/company/dtos/company-signup.dto.ts && grep -q "IsUUID" src/company/dtos/company-signup.dto.ts && grep -q "IsByteLength" src/company/dtos/company-signup.dto.ts && grep -q "Equals(true)" src/company/dtos/company-signup.dto.ts
  - [ ] Hash in NestJS and pass only passwordHash to persistence
        VERIFY: grep -q "PASSWORD_HASHER" src/company/company-signup.service.ts && grep -q "passwordHash" src/company/company-signup.service.ts
  - [ ] Invoke only the narrow provisioning function through app_user
        VERIFY: grep -q "provision_company_workspace" src/company/repositories/company-signup.repository.ts && ! grep -q "unscoped\|app_relay\|BaseRepository" src/company/repositories/company-signup.repository.ts && test $(grep -rl "executeProvisioning" src --include='*.repository.ts' | wc -l) -eq 1
  - [ ] Seed EPC Contractor idempotently
        VERIFY: grep -rq "EPC Contractor" prisma/seed && grep -rq "companyType.upsert" prisma/seed
  - [ ] Keep permission bootstrap SQL in parity with its approved matrix
        VERIFY: node scripts/verify-onboarding-permission-matrix.cjs
  - [ ] Cover signup DTO, hashing, result mapping, and single-call atomic boundary
        VERIFY: yarn test --runInBand --testPathPatterns=company-signup
