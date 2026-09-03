# API Contract: 03 — Identity & Access

Inherits every convention in [`specs/00-platform-core/API_CONTRACT.md`](../00-platform-core/API_CONTRACT.md).
Only deviations and specifics are stated here.

---

## 1. Implemented today

| Method | Path | Status | Auth |
|---|---|---|---|
| `POST` | `/api/v1/users` | 201 · 409 | **none** |
| `GET` | `/api/v1/users` | 200 | **none** |
| `GET` | `/api/v1/users/:id` | 200 · 404 | **none** |
| `PATCH` | `/api/v1/users/:id` | 200 · 404 · 409 | **none** |
| `DELETE` | `/api/v1/users/:id` | 204 · 404 | **none** |

`:id` is validated by `ParseUUIDPipe`. `DELETE` returns 204 with no body — the envelope does
not apply to an empty response.

> **These endpoints are unauthenticated.** That is a gap, not a design decision. It is the
> unticked task "Guard every /users route" in `tasks.md`. Do not build another module's
> endpoints on the assumption that a caller has been identified.

### `GET /api/v1/users` is unpaginated

It returns every user, ordered by `id`. Inconsistent with the platform pagination contract;
tracked as an unticked task.

---

## 2. Planned surface

| Method | Path | Purpose | Roles |
|---|---|---|---|
| `POST` | `/api/v1/auth/login` | Credentials → access + refresh token | public |
| `POST` | `/api/v1/auth/refresh` | Rotate a refresh token | valid session |
| `POST` | `/api/v1/auth/logout` | Revoke the current session | authenticated |
| `GET` | `/api/v1/auth/me` | Current user, roles, actor profiles | authenticated |
| `POST` | `/api/v1/auth/password/forgot` | Issue a reset token | public |
| `POST` | `/api/v1/auth/password/reset` | Consume a reset token | public |
| `GET` | `/api/v1/actor-profiles` | Caller's own profiles | authenticated |
| `POST` | `/api/v1/actor-profiles/:id/activate` | Choose the acting profile | owner |
| `GET` | `/api/v1/roles` | List roles | `system_admin` |
| `POST` | `/api/v1/users/:id/roles` | Grant a role | `system_admin` |
| `DELETE` | `/api/v1/users/:id/roles/:roleId` | Revoke (sets `revoked_at`) | `system_admin` |

`POST /auth/password/forgot` returns **204 whether or not the email exists** (AC-W01).

---

## 3. DTOs

### `CreateUserDto` (shipped)

| Field | Rule |
|---|---|
| `fullName` | `@IsString()`, max 160 |
| `email` | `@IsEmail()`, max 255 |
| `avatarUrl?` | `@IsOptional() @IsUrl()` |

`UpdateUserDto` is its `PartialType`. Neither accepts `passwordHash`, `isActive`, or
`lastLoginAt` — `forbidNonWhitelisted` makes sending them a 400.

### `UserEntity` (response)

`id`, `fullName`, `email`, `avatarUrl`, `isActive`, `lastLoginAt`, `createdAt`, `updatedAt`.

**`passwordHash` is absent by construction** (AC-U02). It must stay absent: the entity is a
hand-written Swagger shape, not a Prisma model, and adding a spread of the Prisma record would
leak the hash.

---

## 4. Error codes

| Case | HTTP | Code | Source |
|---|---|---|---|
| Duplicate email | 409 | `CONFLICT` | Prisma P2002 |
| User not found | 404 | `NOT_FOUND` | Prisma P2025 |
| Malformed uuid | 400 | `BAD_REQUEST` | `ParseUUIDPipe` |
| Undeclared property | 400 | `BAD_REQUEST` | `ValidationPipe` |
| Bad credentials *(planned)* | 401 | `UNAUTHORIZED` | service |
| Insufficient role *(planned)* | 403 | `FORBIDDEN` | guard |

> **Deviation.** `UsersService` catches P2002/P2025 itself and throws
> `ConflictException`/`NotFoundException` rather than letting `mapPrismaException` handle
> them (Constitution Art. VI.4). The response shape happens to match; the duplication does
> not. Unticked task.

---

## 5. Authorization model (planned)

Two layers, deliberately separate:

1. **Role** — coarse. `@Roles(ActorRoleCode.system_admin)` on account administration.
2. **Workflow action** — fine. Whether an actor may fire a given `WorkflowActionCode` from a
   given status is decided by module 09 against `workflow_action_role_permissions`, **not**
   by a decorator here.

Do not encode workflow permissions as role checks in controllers. The transition table exists
precisely so that "who may approve a drawing" is data, not code.

The acting profile arrives per request and is stashed in `RequestContext.actorId`
(module 00), which is already present and unused.

## 6. Login workspace resolution gap

Login currently requires raw `x-tenant-id`. The product UX must instead accept a future
owner-approved Company/workspace identifier, resolve the strict 1:1 Company's Tenant internally,
then perform the existing tenant-scoped credential lookup. Company abbreviation is only
tenant-unique and Tenant slug is internal, so neither is promoted by this onboarding change.
