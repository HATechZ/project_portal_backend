# Tasks: 03 — Identity & Access

Completion status and counts are maintained in `specs/INDEX.md`.
**Spec Reference:** `specs/03-identity-and-access/SPEC.md`
**Plan Reference:** `specs/03-identity-and-access/plan.md`

> Governed by [`specs/RULES.md`](../RULES.md) **[Article II](../rules/02-proof.md)** — every leaf task
> carries a `VERIFY:` line. A task is ticked **only** when its command exits 0. Run:
>
> ```bash
> yarn verify:sdd --module 03
> ```
>
> Implementation assertions and runtime evidence are separate. A passing static assertion
> alone does not establish live database or HTTP correctness.

---

- [x] **Phase 1: Users CRUD (shipped)**
  - [x] Expose users at `/api/v1/user` with uuid-validated params
        VERIFY: grep -q "@Controller('user')" src/user/user.controller.ts && grep -q "ParseUUIDPipe" src/user/user.controller.ts
  - [x] Validate the create/update payloads at the edge
        VERIFY: grep -q "IsEmail" src/user/dtos/create-user.dto.ts && grep -q "PartialType" src/user/dtos/update-user.dto.ts
  - [x] Keep `passwordHash` out of the response entity
        VERIFY: ! grep -q "passwordHash" src/user/dtos/user-response.dto.ts
  - [x] Generate ids in the application rather than the database
        VERIFY: grep -q "randomUUID()" src/user/repositories/user.repository.ts

- [x] **Phase 2: Close the constitution deviations**
  - [x] Introduce `UserRepository` extending `BaseRepository`
        VERIFY: test -f src/user/repositories/user.repository.ts && grep -q "extends BaseRepository" src/user/repositories/user.repository.ts
  - [x] Stop injecting `PrismaService` into the service layer (Art. VI.5)
        VERIFY: ! grep -q "PrismaService" src/user/user.service.ts
  - [x] Delegate Prisma error translation to the global filter (Art. VI.4)
        VERIFY: ! grep -rE "PrismaClientKnownRequestError|error.code === 'P20" src/user/providers src/role-permission/providers src/auth/providers --include='*.ts' --exclude='*.spec.ts'
  - [x] Paginate `GET /user` per the platform contract
        VERIFY: grep -q "PaginationQueryDto" src/user/user.controller.ts && grep -q "ApiPaginatedResponse" src/user/user.controller.ts

- [x] **Phase 3: Authentication**
  - [x] Add a password hashing dependency and a hashing port
        VERIFY: grep -q '"bcryptjs"' package.json && test -f src/infra/crypto/password-hasher.port.ts
  - [x] Create the auth module and register it in `PLACEHOLDERS.md`
        VERIFY: test -f src/auth/auth.module.ts && grep -q "src/auth/auth.module.ts" specs/PLACEHOLDERS.md
  - [x] Issue sessions on sign-in, storing only the refresh token hash
        VERIFY: grep -q "refreshTokenHash" src/auth/repositories/auth-session.repository.ts && ! grep -q "refreshToken:" src/auth/repositories/auth-session.repository.ts
  - [x] Stamp `lastLoginAt` and create the session in one transaction
        VERIFY: grep -q "recordLoginAndCreateSession" src/auth/repositories/auth-session.repository.ts && grep -q "recordLoginAndCreateSession" src/auth/providers/auth-token.provider.ts
  - [x] Return an identical 401 for unknown email and wrong password (AC-W01)
        VERIFY: test $(grep -c "Invalid email or password" src/auth/auth.service.ts) -eq 2
  - [x] Refuse sign-in for inactive users
        VERIFY: grep -q "isActive" src/auth/auth.service.ts
  - [x] Single-use, expiring password reset
        VERIFY: grep -q "usedAt" src/auth/repositories/password-recovery.repository.ts && grep -q "expiresAt" src/auth/repositories/password-recovery.repository.ts

- [ ] **Phase 4: Authorization**
  - [x] Guard every `/user` route behind authentication
        VERIFY: grep -q "AccessTokenGuard" src/user/user.controller.ts && grep -q "AuthenticationGuard" src/user/user.controller.ts
  - [x] Restrict role administration to `system_admin`
        VERIFY: grep -q "SystemAdminGuard" src/role-permission/role-permission.controller.ts && grep -q "SystemAdminGuard" src/user/user.controller.ts
  - [x] Populate `RequestContext.actorId` from the acting profile
        VERIFY: grep -q "setActorId" src/common/security/authentication.guard.ts && grep -q "actorId" src/common/context/request-context.ts
  - [x] Revoke role grants by timestamp, never by delete (DR-02)
        VERIFY: grep -q "revokedAt: new Date" src/role-permission/repositories/role-permission.repository.ts && ! grep -rq "userRole.delete" src/role-permission
  - [ ] Enforce at most one default actor profile per user (DR-03)
        VERIFY: grep -q "setDefault" src/auth/repositories/actor-profile.repository.ts && grep -rq "actor_profiles_one_default_per_user" prisma/migrations/ && node scripts/verify-identity-evidence.cjs concurrency
  - [x] List only the authenticated User's ActorProfiles
        VERIFY: grep -q "@Get('actor-profiles')" src/auth/actor-profile.controller.ts && grep -q "findForUser" src/auth/repositories/actor-profile.repository.ts
  - [ ] Activate only an owned, active ActorProfile backed by an active role grant
        VERIFY: grep -q "userRolesByRoleId" src/auth/repositories/actor-profile.repository.ts && node scripts/verify-identity-evidence.cjs http

- [ ] **Phase 5: Sign-off**
  - [x] Lint and build clean
        VERIFY: corepack yarn lint && corepack yarn build
  - [ ] Record the HTTP walkthrough (Constitution Art. V)
        VERIFY: test -f specs/03-identity-and-access/walkthrough.md && node scripts/verify-identity-evidence.cjs http

- [ ] **Phase 6: Email-only universal Sign In**
  - [x] Keep the existing login DTO limited to email and password
        VERIFY: grep -q "email" src/auth/dtos/login.dto.ts && grep -q "password" src/auth/dtos/login.dto.ts && ! grep -qE "workspaceSlug|tenantId|companyId|roleId|actorProfileId" src/auth/dtos/login.dto.ts
  - [ ] Keep login public while refresh and recovery retain explicit Tenant context
        VERIFY: ! grep -B4 -A8 "@Post('login')" src/auth/auth.controller.ts | grep -q "TenantContextGuard" && test $(grep -c "TenantContextGuard" src/auth/auth.controller.ts) -eq 6
  - [x] Enforce globally unique normalized User email while retaining Tenant ownership
        VERIFY: grep -Fq "email String @unique" prisma/schema.prisma && grep -Fq "tenantId String" prisma/schema.prisma && grep -Fq "@@index([tenantId])" prisma/schema.prisma
  - [x] Enforce canonical lower-trimmed email and remove the old Tenant/email uniqueness
        VERIFY: grep -q "users_email_canonical_check" prisma/migrations/20260903020000_global_normalized_email_login/migration.sql && grep -q "email = lower(btrim(email))" prisma/migrations/20260903020000_global_normalized_email_login/migration.sql && grep -q "DROP INDEX public.users_tenant_id_email_key" prisma/migrations/20260903020000_global_normalized_email_login/migration.sql
  - [x] Resolve the internal Tenant from normalized email through the narrow database function path
        VERIFY: grep -q "resolve_user_login_email" src/auth/repositories/login-tenant-resolver.repository.ts && grep -q "executeLoginResolution" src/auth/repositories/login-tenant-resolver.repository.ts && ! grep -qE "unscoped|app_relay|user\.find" src/auth/repositories/login-tenant-resolver.repository.ts
  - [x] Replace caller Tenant context with the internally resolved Tenant
        VERIFY: grep -q "RequestContext.run" src/auth/auth.service.ts && grep -q "loginTenantResolver.resolve" src/auth/auth.service.ts
  - [x] Keep the email resolver SECURITY DEFINER with a fixed safe search path and Tenant-only result
        VERIFY: grep -q "RETURNS TABLE (tenant_id uuid)" prisma/migrations/20260903020000_global_normalized_email_login/migration.sql && grep -q "SECURITY DEFINER" prisma/migrations/20260903020000_global_normalized_email_login/migration.sql && grep -q "SET search_path = pg_catalog" prisma/migrations/20260903020000_global_normalized_email_login/migration.sql
  - [x] Grant only narrow resolver execution to app_user and exclude PUBLIC and app_relay
        VERIFY: grep -q "REVOKE ALL ON FUNCTION public.resolve_user_login_email(text) FROM PUBLIC" prisma/migrations/20260903020000_global_normalized_email_login/migration.sql && grep -q "GRANT EXECUTE ON FUNCTION public.resolve_user_login_email(text) TO app_user" prisma/migrations/20260903020000_global_normalized_email_login/migration.sql && ! grep -q "app_relay" prisma/migrations/20260903020000_global_normalized_email_login/migration.sql && ! grep -qE "GRANT (SELECT|INSERT|UPDATE|DELETE).*users" prisma/migrations/20260903020000_global_normalized_email_login/migration.sql
  - [ ] Keep normal UnitOfWork fail-closed and expose only queryRaw for login resolution
        VERIFY: grep -q "RequestContext.requireTenantId" src/infra/prisma/unit-of-work.service.ts && grep -q "Repository access requires an active unit of work" src/infra/prisma/unit-of-work.service.ts && grep -q "Object.freeze" src/infra/prisma/unit-of-work.service.ts && corepack yarn test --runInBand --testPathPatterns=unit-of-work.service.spec.ts
  - [x] Preserve generic credential failure responses
        VERIFY: test $(grep -c "Invalid email or password" src/auth/auth.service.ts) -eq 2
  - [x] Reject normalized duplicate signup atomically with no provisioning remnants
        VERIFY: grep -q "error.code === '23505'" scripts/verify-workspace-sign-in-database.cjs && grep -q "failed duplicate signup left Tenant, Company, or User remnants" scripts/verify-workspace-sign-in-database.cjs
  - [x] Apply global email conflict handling to normal User creation
        VERIFY: grep -q "normalizeEmail" src/user/providers/user-mutation.provider.ts && grep -q "users_email_key" src/common/exceptions/prisma-exception.map.ts && grep -q "email String @unique" prisma/schema.prisma
  - [x] Preserve existing JWT, session, refresh, logout, and ActorProfile behavior
        VERIFY: grep -q "tokenProvider.issue" src/auth/auth.service.ts && grep -q "tokenProvider.rotate" src/auth/auth.service.ts && grep -q "tokenProvider.revoke" src/auth/auth.service.ts && grep -q "findActiveActor" src/auth/repositories/auth-session.repository.ts
  - [x] Preserve User RLS and Company workspaceSlug without using it for login
        VERIFY: grep -q 'workspaceSlug String @unique' prisma/schema.prisma && ! grep -q "workspaceSlug" src/auth/dtos/login.dto.ts && grep -q 'tenant_isolation_users' prisma/migrations/20260901000000_enable_tenant_rls/migration.sql
  - [x] Cover email resolution, header override, generic failure, and existing token issue behavior
        VERIFY: corepack yarn test --runInBand --testPathPatterns=auth
  - [ ] Prove authenticated Company reads remain Tenant-isolated after email-only Sign In
        VERIFY: grep -q "email and password only" specs/04-organization/walkthrough.md && grep -q "exactly the newly provisioned User's Tenant Company" specs/04-organization/walkthrough.md
  - [x] Record the email-only HTTP walkthrough with internal Tenant resolution
        VERIFY: grep -q "email and password only" specs/03-identity-and-access/walkthrough.md && grep -q "Tenant was resolved internally" specs/03-identity-and-access/walkthrough.md

- [ ] **Phase 7: Identity completion**
  - [ ] Provision an idempotent eligible role-only ActorProfile with role assignment
        VERIFY: corepack yarn test --runInBand --testPathPatterns=role-assignment.repository.spec.ts && node scripts/verify-identity-evidence.cjs http
  - [ ] Revoke same-Tenant target User sessions through a system_admin endpoint
        VERIFY: corepack yarn test --runInBand --testPathPatterns=session-administration.service.spec.ts
  - [ ] Reject non-nullable update fields before mutation while allowing null avatarUrl
        VERIFY: corepack yarn test --runInBand --testPathPatterns=update-user.dto.spec.ts
  - [ ] Translate persistence conflicts centrally including serialization failures
        VERIFY: corepack yarn test --runInBand --testPathPatterns=prisma-exception.map.spec.ts
  - [x] Keep recovery responses generic on delivery failure and retire undelivered tokens
        VERIFY: corepack yarn test --runInBand --testPathPatterns=auth-password-reset.provider.spec.ts
  - [ ] Record real database concurrency outcomes and temporary-data cleanup
        VERIFY: node scripts/verify-identity-evidence.cjs concurrency
  - [ ] Record complete identity HTTP coverage, envelopes, request IDs and isolation
        VERIFY: node scripts/verify-identity-evidence.cjs http
  - [x] Reconcile identity contracts and independently verify every completion claim
        VERIFY: node scripts/verify-identity-evidence.cjs contracts

- [ ] **Phase 8: JWT-derived authenticated Tenant context**
  - [ ] Bind bearer requests to the verified JWT Tenant, ignoring caller Tenant headers
        VERIFY: corepack yarn test --runInBand --testPathPatterns=authenticated-tenant
