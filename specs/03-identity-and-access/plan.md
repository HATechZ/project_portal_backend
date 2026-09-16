# Technical Plan: 03 — Identity & Access

Completion status is tracked in `specs/INDEX.md`.
**Related Spec:** `specs/03-identity-and-access/SPEC.md`
**Contracts:** `DATA_CONTRACT.md` · `API_CONTRACT.md`

## 1. Module structure

```text
src/user/
├── user.module.ts
├── user.controller.ts
├── user.service.ts
├── dtos/
├── providers/
└── repositories/user.repository.ts

src/auth/
├── auth.module.ts
├── auth.controller.ts
├── auth.service.ts
├── actor-profile.controller.ts
├── actor-profile.service.ts
├── dtos/
├── providers/
└── repositories/

src/role-permission/
├── role-permission.module.ts
├── role-permission.controller.ts
├── role-permission.service.ts
├── dtos/
├── providers/
└── repositories/role-permission.repository.ts
```

All three feature modules are registered in `specs/PLACEHOLDERS.md`. Controllers route,
services/providers decide, repositories persist through `BaseRepository`, and repositories fail
closed without an ambient Tenant unit of work.

## 2. Authentication flow

1. `POST /auth/login` accepts canonical email and password only.
2. The query-only login resolver maps normalized email to the internal active Tenant.
3. Auth establishes trusted Tenant context and performs tenant-scoped credential lookup.
4. Unknown/ineligible identity and wrong password share the same generic 401 and bcrypt-cost path.
5. A successful login stamps `lastLoginAt` and creates the hashed-refresh-token session in one
   transaction.
   The transaction rechecks `isActive` and the verified password hash before updating the User
   and creating a session, rejecting stale credential checks with the generic login 401.
6. Access JWTs bind User, Tenant, and session. Refresh rotation records consumed hashes and
   enforces absolute TTL; logout revokes the session.

No plaintext password, refresh token, or reset token is persisted.

## 3. Authorization flow

Authenticated business requests pass through access-token verification and JWT Tenant binding,
Tenant activation, active-session/User resolution, and active ActorProfile resolution.
The caller's Tenant header is ignored on these routes. Only refresh/recovery still resolve an
explicit header. Request interception preserves the established Tenant and acting profile.
The selected actor id is stored in `RequestContext`. `SystemAdminGuard` protects User and
role/permission administration. `PermissionsGuard` evaluates configured grants without a
wildcard bypass. Object/workflow rules remain owned by their business modules.

## 4. ActorProfiles

The authenticated User may list only their own profiles. Activation accepts only an active,
same-Tenant, same-User profile whose matching UserRole is not revoked. The repository clears the
old default and sets the selected profile inside one serializable transaction; the partial unique
index remains the database backstop. Role-only profiles remain valid.

`RoleAssignmentRepository` serializes assignment/profile provisioning on the User row and
reuses existing grants and role-only profiles. All writes stay within the Tenant transaction.
The required app_user ActorProfile INSERT/UPDATE grants are documented in DATA_CONTRACT;
they are an owner prerequisite and are not added by application code.

## 5. User and role administration

User CRUD is paginated and restricted to `system_admin`. IDs are application-generated, email is
canonical and globally unique, and password hashes never enter response DTOs. Role grants are
created with history and revoked by timestamp. The final active System Administrator grant cannot
be removed.

## 6. Password recovery

Forgot password uses a generic response, stores only a hashed random token, and supersedes older
unused tokens. Reset consumes the token once, changes the password, and revokes active sessions in
one transaction. The current recovery contract still carries Tenant context; removing that public
Tenant detail is a separate product decision.

`PasswordRecoveryRepository` serializes token issuance/reset on the User row. A failed enqueue
retires only its own token; the provider logs a generic failure and fulfills the public request.
`SessionAdministrationController` delegates same-Tenant target revocation to its service and
repository, under the existing system_admin guards.

## 7. Transaction boundaries

| Operation | Atomic records |
|---|---|
| Successful login | `users.last_login_at` + `auth_sessions` |
| Refresh rotation | session hash rotation + consumed-hash history |
| Password reset | token consumption + password change + session revocation |
| ActorProfile activation | previous default clear + selected default set |
| Role permission replacement | revoked/allowed tenant grant matrix |
| Role revocation | timestamp update with final-admin protection |
| Role assignment | active grant + reusable role-only ActorProfile, preserving eligible default |
| Operator revocation | User lock + all target session revocations |

Permission replacement uses serializable isolation. Profile switching, role revocation and User
deactivation retain serializable isolation; shared error mapping yields 409 on transaction
conflicts. Final-admin checks count active Users, including during competing security changes.

## 8. Custom access-role implementation plan

Database work precedes runtime work and is owned by the database architect: reshape `Role` into
fixed system identity plus tenant custom identity/scope; backfill system rows; add roles RLS and
workflow-reference protection; and enforce the approved V1 custom action/scope matrix
(`ADD_MEMBER`, `ADD_TEAM`, `ASSIGN_MEMBER` for `division`/`company` only).
No runtime endpoint is implemented until that migration is approved and applied.

`RolePermissionRepository` then reads global system plus current-Tenant custom roles, performs
serializable custom-role creation with initial grants, and filters/rechecks catalog scope
eligibility. It does not alter existing system permission replacement semantics. Assignment
discovery is a target-aware repository/provider path. Custom assignment resolves an existing
active Member or ClientContact target, validates declared scope, and atomically creates/reuses a
compatible scoped ActorProfile with the UserRole grant; system-role assignment retains the current
role-only-profile and hierarchy path.

Controllers remain SystemAdminGuard-protected. DTOs accept only name, optional description, scope,
and permissionCodes for creation; no tenant, identifier, system flag, actor code, or audit IDs.
Swagger receives the short summaries in the API contract. Tests cover RLS/non-disclosure,
workflow-reference rejection, atomicity, scope/profile compatibility, server-side permission
eligibility, eligible options, history, and unchanged system-role routing.

## 9. Verification

Run focused/full Jest, lint/build/TypeScript, Prisma validate, tenant scope and spec gates.
`verify-identity-concurrency.cjs` uses real repositories and app_user transactions on temporary
Tenants. `verify-identity-http.cjs` starts the production AppModule with isolated mail capture
and disabled background consumers/Redis/throttler modules, then sends curl requests through
the actual controllers, guards, validation and bootstrap. This host proves identity HTTP behavior,
not SMTP delivery or infrastructure rate limiting. Both clean only their own temporary data.
Evidence is written only after every required assertion and cleanup succeeds; static evidence
checks compare production-source fingerprints. Independent verification is required before ticking.
