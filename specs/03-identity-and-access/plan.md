# Technical Plan: 03 — Identity & Access

**Status:** Approved — Phase 4 in progress
**Related Spec:** `specs/03-identity-and-access/SPEC.md`
**Contracts:** `DATA_CONTRACT.md` · `API_CONTRACT.md`

---

## 1. Module Tree

Shipped (`✓`) and planned:

```
src/users/
├── users.module.ts              ✓  no imports — Prisma/Redis are @Global
├── users.controller.ts          ✓  needs guards
├── users.service.ts             ✓  needs to drop direct PrismaService + Prisma catches
├── users.repository.ts             extends BaseRepository
├── dto/{create,update}-user.dto.ts ✓
└── entities/user.entity.ts      ✓  passwordHash absent — keep it that way

src/auth/                           all planned
├── auth.module.ts
├── auth.controller.ts              login, refresh, logout, me, password/*
├── auth.service.ts                 credential check, session lifecycle
├── session.repository.ts           auth_sessions
├── password-reset.repository.ts    password_reset_tokens
├── guards/{auth,roles}.guard.ts
├── decorators/{roles,current-actor}.decorator.ts
└── dto/…

src/actor-profiles/                 all planned
├── actor-profiles.module.ts
├── actor-profiles.controller.ts
├── actor-profiles.service.ts
└── actor-profiles.repository.ts    actor_profiles, roles, user_roles
```

Each new `*.module.ts` must be added to `specs/PLACEHOLDERS.md` in the same change, or
Gate 0 fails the build.

---

## 2. Repository surface

| Repository | Method | Transaction |
|---|---|---|
| `UsersRepository` | `findPage`, `findById`, `findByEmail`, `create`, `update`, `remove` | joins ambient |
| `SessionRepository` | `create`, `findByHash`, `revoke`, `revokeAllForUser` | joins ambient |
| `ActorProfileRepository` | `findForUser`, `create`, `setDefault`, `grantRole`, `revokeRole` | `setDefault` and role changes open one |

All extend `BaseRepository` and read `this.db`. `UsersService` currently injects
`PrismaService` directly; that is the deviation to close first, because every later
repository will be copied from whatever pattern is in the repo.

---

## 3. Transaction boundaries

| Operation | Tables | Why |
|---|---|---|
| Sign in | `auth_sessions` + `users.lastLoginAt` | session and stamp must agree |
| Set default profile | `actor_profiles` ×2 | clear the old default, set the new one atomically; the partial unique index is the final DR-03 guarantee |
| Grant role | `user_roles` (+ revoke prior grant of the same role) | avoid two live grants |
| Consume reset | `password_reset_tokens.usedAt` + `users.passwordHash` | a used token with an unchanged password is worse than neither |

Each opens `this.transaction(...)` in the service, and the repositories join it.

ActorProfile creation may leave both business targets null, but must never populate both.
Member and ClientContact targets are tenant-qualified: the profile tenant is carried into the
relation and must match the target row. These are database guarantees introduced by Module
01.1; service checks may improve messages but do not replace them.

---

## 4. Ids, enums & derived state

- Ids: `randomUUID()` at insert (shipped pattern in `UsersService.create`).
- Enums: `ActorRoleCode` only, from `../generated/prisma/client`.
- Derived state: none read; none written.
- Active role query: always filter `revokedAt: null` — there is no "current roles" view.

---

## 5. Credential handling

| Concern | Decision |
|---|---|
| Password hashing | **Not yet chosen.** `argon2id` preferred over bcrypt; neither is a dependency today. Adding one is a task, not an assumption. |
| Refresh token | Random 32+ bytes, returned once, stored as `refresh_token_hash` |
| Reset token | Random 32+ bytes, stored as `token_hash @unique`, short expiry |
| Access token | JWT or opaque — **open decision**, see below |

**Open decision — access tokens.** `@nestjs/jwt` is not a dependency, and the schema has no
access-token table. Either add JWT and keep `auth_sessions` for refresh only, or make access
tokens opaque and look them up per request. The second costs a Redis read per request but
makes revocation instant. Module 02's cache is already available for it. This must be
settled at Gate 2 before the auth tasks are written in detail.

---

## 6. Errors

| Case | Thrown | Mapped to |
|---|---|---|
| Duplicate email | *(nothing — P2002)* | 409 `CONFLICT` via `mapPrismaException` |
| Missing user | *(nothing — P2025)* | 404 `NOT_FOUND` |
| Bad credentials / unknown email | `AppException({ code: UNAUTHORIZED })` | 401, identical either way |
| Expired or revoked session | `AppException({ code: UNAUTHORIZED })` | 401 |
| Role check fails | `AppException({ code: FORBIDDEN })` | 403 |
| Reset token invalid | `AppException({ code: BAD_REQUEST })` | 400 |

Services must **not** catch Prisma errors (Art. VI.4). The current `handleKnownError` in
`UsersService` is the thing being removed, not the pattern to copy.

## 7. Universal Sign In

The existing `POST /auth/login` accepts email and password only. A dedicated repository invokes
only `public.resolve_user_login_email(text)` through a query-only app-user executor. Auth replaces
any request-header Tenant context with that trusted result for the existing tenant-scoped
credential, session, and token path. Normal UnitOfWork remains fail-closed, and all email/password
misses share the existing generic 401. Company `workspaceSlug` remains intact but is not a login
credential.
