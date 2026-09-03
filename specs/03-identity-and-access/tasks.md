# Tasks: 03 — Identity & Access

**Status:** Phase 4 — in progress
**Spec Reference:** `specs/03-identity-and-access/SPEC.md`
**Plan Reference:** `specs/03-identity-and-access/plan.md`

> Governed by [`specs/RULES.md`](../RULES.md) **[Article II](../rules/02-proof.md)** — every leaf task
> carries a `VERIFY:` line. A task is ticked **only** when its command exits 0. Run:
>
> ```bash
> yarn verify:sdd --module 03
> ```
>
> Phase 1 is shipped. Phases 2–5 are not. Nothing below is ticked on intent: the four ticked
> boxes describe code that exists today, and the unticked ones fail their assertion right now.

---

- [x] **Phase 1: Users CRUD (shipped)**
  - [x] Expose users at `/api/v1/users` with uuid-validated params
        VERIFY: grep -q "@Controller('users')" src/users/users.controller.ts && grep -q "ParseUUIDPipe" src/users/users.controller.ts
  - [x] Validate the create/update payloads at the edge
        VERIFY: grep -q "IsEmail" src/users/dto/create-user.dto.ts && grep -q "PartialType" src/users/dto/update-user.dto.ts
  - [x] Keep `passwordHash` out of the response entity
        VERIFY: ! grep -q "passwordHash" src/users/entities/user.entity.ts
  - [x] Generate ids in the application rather than the database
        VERIFY: grep -q "randomUUID()" src/users/users.service.ts

- [ ] **Phase 2: Close the constitution deviations**
  - [ ] Introduce `UsersRepository` extending `BaseRepository`
        VERIFY: test -f src/users/users.repository.ts && grep -q "extends BaseRepository" src/users/users.repository.ts
  - [ ] Stop injecting `PrismaService` into the service layer (Art. VI.5)
        VERIFY: ! grep -q "PrismaService" src/users/users.service.ts
  - [ ] Delegate Prisma error translation to the global filter (Art. VI.4)
        VERIFY: ! grep -q "PrismaClientKnownRequestError" src/users/users.service.ts
  - [ ] Paginate `GET /users` per the platform contract
        VERIFY: grep -q "PaginationQueryDto" src/users/users.controller.ts && grep -q "ApiPaginatedResponse" src/users/users.controller.ts

- [ ] **Phase 3: Authentication**
  - [ ] Add a password hashing dependency and a hashing port
        VERIFY: grep -qE '"(argon2|@node-rs/argon2|bcrypt)"' package.json && test -f src/auth/password-hasher.port.ts
  - [ ] Create the auth module and register it in `PLACEHOLDERS.md`
        VERIFY: test -f src/auth/auth.module.ts && grep -q "src/auth/auth.module.ts" specs/PLACEHOLDERS.md
  - [ ] Issue sessions on sign-in, storing only the refresh token hash
        VERIFY: grep -q "refreshTokenHash" src/auth/session.repository.ts && ! grep -qE "refreshToken[^H]" src/auth/session.repository.ts
  - [ ] Stamp `lastLoginAt` and create the session in one transaction
        VERIFY: grep -q "transaction" src/auth/auth.service.ts && grep -q "lastLoginAt" src/auth/auth.service.ts
  - [ ] Return an identical 401 for unknown email and wrong password (AC-W01)
        VERIFY: test $(grep -c "AppErrorCode.Unauthorized" src/auth/auth.service.ts) -ge 2
  - [ ] Refuse sign-in for inactive users
        VERIFY: grep -q "isActive" src/auth/auth.service.ts
  - [ ] Single-use, expiring password reset
        VERIFY: grep -q "usedAt" src/auth/password-reset.repository.ts && grep -q "expiresAt" src/auth/password-reset.repository.ts

- [ ] **Phase 4: Authorization**
  - [ ] Guard every `/users` route behind authentication
        VERIFY: grep -qE "@UseGuards\(.*AuthGuard" src/users/users.controller.ts
  - [ ] Restrict role administration to `system_admin`
        VERIFY: grep -q "system_admin" src/auth/guards/roles.guard.ts || grep -rq "Roles(ActorRoleCode.system_admin)" src/
  - [ ] Populate `RequestContext.actorId` from the acting profile
        VERIFY: grep -rq "actorId" src/auth/ && grep -q "actorId" src/common/context/request-context.ts
  - [ ] Revoke role grants by timestamp, never by delete (DR-02)
        VERIFY: grep -q "revokedAt" src/actor-profiles/actor-profiles.repository.ts && ! grep -q "userRole.delete" src/actor-profiles/actor-profiles.repository.ts
  - [ ] Enforce at most one default actor profile per user (DR-03)
        VERIFY: grep -q "isDefault" src/actor-profiles/actor-profiles.service.ts && grep -q "transaction" src/actor-profiles/actor-profiles.service.ts && grep -rq "actor_profiles_one_default_per_user" prisma/migrations/

- [ ] **Phase 5: Sign-off**
  - [ ] Lint and build clean
        VERIFY: yarn lint && yarn build
  - [ ] Record the HTTP walkthrough (Constitution Art. V)
        VERIFY: test -f specs/03-identity-and-access/walkthrough.md && grep -qi "PASS\|FAIL" specs/03-identity-and-access/walkthrough.md

- [ ] **Phase 6: Email-only universal Sign In**
  - [ ] Keep the existing login DTO limited to email and password
        VERIFY: grep -q "email" src/auth/dtos/login.dto.ts && grep -q "password" src/auth/dtos/login.dto.ts && ! grep -qE "workspaceSlug|tenantId|companyId|roleId|actorProfileId" src/auth/dtos/login.dto.ts
  - [ ] Remove the raw Tenant header requirement from login only
        VERIFY: ! grep -B4 -A8 "@Post('login')" src/auth/auth.controller.ts | grep -q "TenantContextGuard" && grep -c "@UseGuards(TenantContextGuard)" src/auth/auth.controller.ts | grep -q "5"
  - [ ] Resolve the internal Tenant from normalized email through the narrow database function path
        VERIFY: grep -q "resolve_user_login_email" src/auth/repositories/login-tenant-resolver.repository.ts && grep -q "executeLoginResolution" src/auth/repositories/login-tenant-resolver.repository.ts && ! grep -qE "unscoped|app_relay|user\.find" src/auth/repositories/login-tenant-resolver.repository.ts
  - [ ] Replace caller Tenant context with the internally resolved Tenant
        VERIFY: grep -q "RequestContext.run" src/auth/auth.service.ts && grep -q "loginTenantResolver.resolve" src/auth/auth.service.ts
  - [ ] Preserve generic credential failure responses
        VERIFY: test $(grep -c "Invalid email or password" src/auth/auth.service.ts) -eq 1
  - [ ] Cover email resolution, header override, generic failure, and existing token issue behavior
        VERIFY: corepack yarn test --runInBand --testPathPatterns=auth
