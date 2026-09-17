# API Contract: 03 — Identity & Access

Inherits every convention in [`specs/00-platform-core/API_CONTRACT.md`](../00-platform-core/API_CONTRACT.md).
Only module-specific behavior is stated here.

## 1. Implemented surface

| Method | Path | Status | Authorization |
|---|---|---|---|
| `POST` | `/api/v1/role` | 201 / 400 / 409 | `system_admin` |
| `GET` | `/api/v1/user/:userId/role-options` | 200 / 404 | `system_admin` |
| `POST` | `/api/v1/user` | 201 · 409 | `system_admin` |
| `GET` | `/api/v1/user` | 200 | `system_admin` |
| `GET` | `/api/v1/user/:id` | 200 · 404 | `system_admin` |
| `PATCH` | `/api/v1/user/:id` | 200 · 404 · 409 | `system_admin` |
| `DELETE` | `/api/v1/user/:id` | 204 · 404 · 409 | `system_admin` |
| `POST` | `/api/v1/auth/login` | 200 · 401 | public |
| `POST` | `/api/v1/auth/refresh` | 200 · 401 | valid refresh-token session |
| `POST` | `/api/v1/auth/logout` | 204 · 401 | authenticated |
| `GET` | `/api/v1/auth/me` | 200 · 401 | authenticated |
| `POST` | `/api/v1/auth/forgot-password` | 202 | Tenant context |
| `POST` | `/api/v1/auth/reset-password` | 204 · 400 | Tenant context |
| `GET` | `/api/v1/actor-profiles` | 200 | authenticated |
| `POST` | `/api/v1/actor-profiles/:id/activate` | 200 · 403 | profile owner |
| `GET` | `/api/v1/role` | 200 | `system_admin` |
| `GET` | `/api/v1/role/:id` | 200 · 404 | `system_admin` |
| `PUT` | `/api/v1/role/:id/permission` | 200 | `system_admin` |
| `GET` | `/api/v1/permission` | 200 | `system_admin` |
| `GET` | `/api/v1/permission/:id` | 200 · 404 | `system_admin` |
| `GET` | `/api/v1/user/:userId/role` | 200 | `system_admin` |
| `POST` | `/api/v1/user/:userId/role` | 201 · 409 | `system_admin` |
| `DELETE` | `/api/v1/user/:userId/role/:roleId` | 204 · 409 | `system_admin` |
| `DELETE` | `/api/v1/auth/users/:userId/sessions` | 204 · 404 | same-Tenant `system_admin` |

Authenticated business endpoints derive Tenant context exclusively from the verified access-token
Tenant claim; no `x-tenant-id` is required or trusted, even when supplied. They require an active
Tenant, an active session, an active User and an eligible ActorProfile. User, role and session
administration additionally require `system_admin`. Login requires credentials only. Refresh
derives Tenant context from its valid refresh-token session. Forgot/reset require Tenant context without
an access token; reset additionally requires a valid reset token.

## 2. Universal Sign In

`POST /api/v1/auth/login` is the single Sign In endpoint for every User role:

```json
{ "email": "user@example.com", "password": "..." }
```

It requires no workspace, Company, or Tenant identifier. Email is globally unique by canonical
lowercase/trimmed identity. The backend resolves Tenant through the narrow database function,
replaces any caller Tenant context with that trusted result, and performs the tenant-scoped
credential check. Unknown email, inactive account/Tenant, and wrong password share the same 401.
Successful login stamps `lastLoginAt` and creates the hashed-refresh-token session atomically.

## 3. ActorProfile behavior

Role assignment is idempotent: an already-active UserRole is returned with 201 and a reusable
ActorProfile is ensured in the same transaction. When the User already has an active Member, the
profile is Member-backed; otherwise it remains role-only and no Member or ClientContact is
fabricated. The first eligible profile becomes default only if no eligible default exists. A
repeated grant does not unexpectedly replace a valid default. Revoked roles make their profiles
ineligible. Division's `Assign Division Lead` API reuses this same UserRole/ActorProfile
orchestration and then validates the eligible Member; it is not a new identity model.

`GET /actor-profiles` returns only profiles owned by the authenticated User. Activation succeeds
only when the profile is active, belongs to that User and Tenant, and its matching UserRole grant
is active. Clearing the previous default and setting the selected profile occurs in one
serializable transaction. An unavailable or unowned profile returns the same 403.

Member removal disables Member-backed profiles, revokes matching active UserRole grants and
sessions, and deactivates the linked User only when no other active Member or ClientContact
identity remains. Historical grants, profiles, and sessions remain preserved.

## 4. User DTOs

`CreateUserDto` requires trimmed `fullName`, canonical email, and an 8–72 byte password; optional
`avatarUrl` must be a valid absolute URL. `UpdateUserDto` is partial and additionally accepts
`isActive`. Neither accepts `passwordHash` or `lastLoginAt`.

Explicit null `fullName`, `email`, `password` or `isActive` returns 400 before mutation.
`avatarUrl: null` clears the avatar.

`UserResponseDto` returns `id`, `fullName`, `email`, nullable `country`, nullable `phone`, nullable
`avatarUrl`, `isActive`, nullable `lastLoginAt`, `createdAt`, and `updatedAt`. Password hashes are
never serialized.

## 5. Password recovery

Reset tokens are random, stored only as hashes, expiring, and single-use. Reset consumption and
password replacement are atomic and revoke active sessions. Forgot-password responses do not
reveal whether the account exists.

The same approved token lifecycle may be initiated internally by Client onboarding when portal
access is requested for an eligible ClientContact. This is not a new public password endpoint:
the administrator never supplies or receives a password or setup token, and the Client user sets
the password through the delivered one-time link.

Enqueue failures retain the generic 202 response and retire only the undelivered token. A
delivery failure after enqueue does not change the already-returned response. Recovery issuance
and reset serialize per User; only the latest committed issuance is valid. Mail delivery and
historic token cleanup are not completion evidence unless actually exercised.

The current forgot/reset endpoints still use Tenant context and reset links still carry a Tenant
identifier. Removing that raw Tenant UX remains a separate recovery-contract decision; it was not
changed by email-only Sign In.

## 6. Authorization model

Guard order is access-token verification and trusted Tenant binding, then Tenant activation,
then session/User/ActorProfile authorization. Caller headers cannot select another Tenant.
Malformed, stale or foreign Tenant headers are ignored on bearer-authenticated routes. Refresh
derives its Tenant from the persisted refresh-token session; recovery still validates its explicit
Tenant header. Email-only login is unchanged.

Authentication resolves the active default ActorProfile and stores its id in
`RequestContext.actorId`. Coarse account administration is enforced by `SystemAdminGuard`.
Fine-grained workflow actions are enforced through configured `WorkflowActionCode` grants and
the workflow modules that own their state transitions; this module does not create a wildcard
System Administrator bypass.

## 6a. Role and permission administration

Swagger summaries are deliberately short and use these endpoint purposes:

| Method/path | Summary | Contract detail |
|---|---|---|
| `GET /role` | List available roles | Lists retrievable global system roles and same-Tenant custom roles. |
| `GET /role/:id` | Get role details | Returns one safe role detail. |
| `POST /role` | Create a custom role | Atomically creates a custom role and initial compatible grants. |
| `PUT /role/:id/permission` | Update permissions for a role | Retains existing full replacement semantics. |
| `GET /permission` | List available permissions | Lists the existing selector catalog. |
| `GET /permission/:id` | Get permission details | Returns one catalog definition. |
| `GET /user/:userId/role` | List roles assigned to a user | Retains existing active/history behavior. |
| `GET /user/:userId/role-options` | List roles available for assignment | Is the target-aware dropdown source. |
| `POST /user/:userId/role` | Assign a role to a user | Revalidates eligibility server-side. |
| `DELETE /user/:userId/role/:roleId` | Remove a role from a user | Retains timestamp revocation/final-admin protections. |

Role list/detail retain all existing role and permission information and additionally expose
`isSystemRole`, a stable backend `code` projection, and nullable `scope` for custom roles.
System code is the existing fixed actor code; custom code is backend-generated and tenant-safe.

### `POST /api/v1/role` — Create custom role

```json
{
  "name": "Quality Reviewer",
  "description": "Reviews quality-related records.",
  "scope": "division",
  "permissionCodes": [
    "ADD_MEMBER",
    "ASSIGN_MEMBER"
  ]
}
```

`name` is required; `description` is optional; V1 `scope` is one of `division`, `company`;
and `permissionCodes` is a non-duplicate non-empty array of
existing catalog codes. Reject `tenantId`, `roleId`, `isSystemRole`, `createdByUserId`, `code`,
`systemCode`, custom-code input, workflow actor code, and every undeclared property. The backend
derives tenant ownership, generates custom code, marks the row non-system, and writes initial
grants in the same serializable transaction.

### Scope-compatible permissions

The backend filters and validates every requested permission through the authoritative
`workflow action -> custom scope` policy. In V1 `ADD_MEMBER`, `ADD_TEAM`, and `ASSIGN_MEMBER`
are eligible only for `division` and `company`; every other action is ineligible. Frontend
filtering is UX only. Eligibility expands only when the owning protected operation supports
generic permission plus object-scope authorization; there is no wildcard.

### `GET /api/v1/user/:userId/role-options`

Returns only roles assignable by the authenticated System Administrator to the same-Tenant target
User, as dropdown items: `id`, `code`, `name`, `description`, `isSystemRole`, nullable `scope`.
Server-side eligibility considers assigning actor, target active Member/ClientContact context,
Tenant, role kind/scope, existing active assignments and all existing hierarchy rules. It excludes
out-of-Tenant rows, already-active grants, unsupported target/scope pairs and system roles outside
current hierarchy authority. The frontend does not own an eligibility matrix.

## 7. Errors

`DELETE /auth/users/:userId/sessions` revokes all unrevoked sessions of a same-Tenant target.
It returns 204 even if none remain, 404 for missing/cross-Tenant targets, and 403 for non-admins.
New logins ordered after revocation may create new sessions; sessions ordered before it are
revoked. Access and refresh both check revocation.

Concurrent persistence conflicts (`P2034`) map centrally to 409 and can be retried. Unique,
foreign-key and missing-record errors (`P2002`, `P2003`, `P2025`) also use the shared mapper.

Runtime envelope conventions are inherited from the existing bootstrap: successful JSON has
`success`, `message`, `data` and `timestamp` (void 202 omits `data`); errors have `success`,
`error` and `meta`. 204 has no body. Every response must echo `x-request-id`.

| Condition | HTTP | Code |
|---|---|---|
| Duplicate canonical email | 409 | `CONFLICT` |
| User not found | 404 | `NOT_FOUND` |
| Malformed UUID or undeclared property | 400 | `BAD_REQUEST` |
| Bad credentials, inactive account, expired/revoked session | 401 | `UNAUTHORIZED` |
| Missing role, unowned/unavailable ActorProfile | 403 | `FORBIDDEN` |
| Invalid, expired, or used reset token | 400 | `BAD_REQUEST` |
