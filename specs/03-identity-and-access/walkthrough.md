# Identity & Access API walkthrough

Date: 2026-09-03  
Environment: confirmed development database

| Result | Method | Path | Status | Evidence | `x-request-id` |
|---|---|---:|---:|---|---|
| PASS | POST | `/api/v1/company/signup` with the approved Company/Admin body | 201 | Returned the generated Company `workspaceSlug` and administrator; no Tenant identifier | Present |
| PASS | POST | `/api/v1/auth/login` with email and password only; no workspace, Company, or Tenant input/header | 200 | Existing user/session/token response returned; Tenant was resolved internally from normalized email and was not exposed | Present |
| PASS | GET | `/api/v1/company` using the issued authenticated context | 200 | Paginated result contained exactly the newly provisioned User's Tenant Company | Present |

Every role uses this same login endpoint. Passwords, hashes, tokens, and internal Tenant IDs are
excluded from this evidence. The clearly marked temporary verification workspace and all of its
tenant-owned records were removed after the walkthrough.

## 2026-09-08 completion verification attempt

The rows above are historical 2026-09-03 results, not a new full identity walkthrough.
No additional HTTP endpoint PASS is claimed: the new curl walkthrough stopped during
temporary administrator fixture provisioning, before the test HTTP server started.

| Check actually executed | Result | Observed evidence |
|---|---|---|
| Read-only app_user connectivity and identity grant inspection | PASS | actor_profiles has SELECT only; INSERT and UPDATE are absent |
| Baseline stale login after deactivation | FAIL | Existing implementation created one unrevoked session after User deactivation |
| Baseline concurrent permission replacement on an empty matrix | FAIL | Two competing one-permission replacements produced a two-permission union |
| Baseline concurrent recovery issuance | FAIL | Two unused reset tokens remained after competing requests |
| Baseline temporary-data cleanup | PASS | Temporary Tenant-owned rows and both temporary Tenants removed |
| New role assignment/profile provisioning under app_user | FAIL | SQLSTATE 42501: permission denied for table actor_profiles during updateMany; transaction rolled back |
| Final concurrency suite | BLOCKED | Cannot provision its profile fixtures through the application path |
| Full curl HTTP suite | BLOCKED | Same ActorProfile privilege prerequisite before HTTP startup |
| Cleanup after failed verification attempts | PASS | Each attempt removed its own temporary Tenant-owned rows and Tenants |

Source fixes for the reproduced races have unit/static coverage, but the final real-database
outcomes and HTTP envelopes/request IDs remain unverified. No successful final evidence JSON
was written. DATA_CONTRACT documents the owner-only privilege prerequisite. No migrations,
grants, RLS changes or app_relay identity writes were performed.

## 2026-09-08 JWT-derived authenticated Tenant verification

Executed: 2026-09-08T03:15:49.333Z. Production controllers, guards, interceptors and repositories
were exercised with curl against the development database as app_user. Background consumers
and throttling were disabled in the isolated test host; Tenant activation used uncached database
reads. Temporary role-only profiles were fixture setup, not an application provisioning claim.

| Result | Method | Path / case | Status | Envelope | x-request-id |
|---|---|---|---|---|---|
| PASS | POST | `/api/v1/auth/login (email/password only)` | 200 | success,message,data,timestamp | echoed |
| PASS | POST | `/api/v1/auth/login (email/password only)` | 200 | success,message,data,timestamp | echoed |
| PASS | POST | `/api/v1/auth/login (email/password only)` | 200 | success,message,data,timestamp | echoed |
| PASS | GET | `/api/v1/auth/me` | 200 | success,message,data,timestamp | echoed |
| PASS | GET | `/api/v1/auth/me (foreign header ignored)` | 200 | success,message,data,timestamp | echoed |
| PASS | GET | `/api/v1/auth/me (malformed header ignored)` | 200 | success,message,data,timestamp | echoed |
| PASS | GET | `/api/v1/user` | 200 | success,message,data,timestamp | echoed |
| PASS | GET | `/api/v1/user/:id (own Tenant)` | 200 | success,message,data,timestamp | echoed |
| PASS | GET | `/api/v1/user/:id (foreign object and header)` | 404 | success,error,meta | echoed |
| PASS | GET | `/api/v1/user/:id (reverse cross-Tenant)` | 404 | success,error,meta | echoed |
| PASS | GET | `/api/v1/role` | 200 | success,message,data,timestamp | echoed |
| PASS | GET | `/api/v1/role/:id` | 200 | success,message,data,timestamp | echoed |
| PASS | GET | `/api/v1/user/:userId/role` | 200 | success,message,data,timestamp | echoed |
| PASS | GET | `/api/v1/user/:userId/role (cross-Tenant)` | 404 | success,error,meta | echoed |
| PASS | GET | `/api/v1/actor-profiles` | 200 | success,message,data,timestamp | echoed |
| PASS | POST | `/api/v1/actor-profiles/:id/activate (foreign owner)` | 403 | success,error,meta | echoed |
| PASS | GET | `/api/v1/user` | 403 | success,error,meta | echoed |
| PASS | GET | `/api/v1/role` | 403 | success,error,meta | echoed |
| PASS | GET | `/api/v1/actor-profiles` | 200 | success,message,data,timestamp | echoed |
| PASS | GET | `/api/v1/auth/me (header without token)` | 401 | success,error,meta | echoed |
| PASS | GET | `/api/v1/auth/me (forged JWT Tenant)` | 401 | success,error,meta | echoed |
| PASS | DELETE | `/api/v1/auth/users/:userId/sessions (foreign target)` | 404 | success,error,meta | echoed |
| PASS | GET | `/api/v1/auth/me` | 200 | success,message,data,timestamp | echoed |
| PASS | POST | `/api/v1/auth/logout (foreign header ignored)` | 204 | empty (204) | echoed |
| PASS | GET | `/api/v1/auth/me (logged out)` | 401 | success,error,meta | echoed |
| PASS | POST | `/api/v1/auth/refresh (logged-out session)` | 401 | success,error,meta | echoed |
| PASS | GET | `/api/v1/auth/me` | 200 | success,message,data,timestamp | echoed |
| PASS | POST | `/api/v1/auth/logout` | 204 | empty (204) | echoed |
| PASS | GET | `/api/v1/auth/me` | 401 | success,error,meta | echoed |
| PASS | POST | `/api/v1/auth/refresh (header still required)` | 400 | success,error,meta | echoed |
| PASS | POST | `/api/v1/auth/logout` | 204 | empty (204) | echoed |

All temporary Tenant-owned records and Tenants were removed (PASS). Requests without a
Tenant header and requests with a foreign or malformed header used only the verified JWT Tenant.
Cross-Tenant User/role/session targets remained inaccessible; foreign profile activation returned
403. Logout revoked only the caller session and invalidated its access/refresh credentials.
These results cover the authenticated Tenant UX change; the earlier broader module completion
blockers and successful profile-write verification remain separate and unticked.

## 2026-11-03: scope/grant immediate-constraint regression

Investigation used a read-only live catalog transaction and an isolated disposable PostgreSQL 18 reproduction with the generated Prisma client and real tenant Prisma extension. No live data, FK, trigger, permission code or catalogue compatibility row was changed.

Captured database failure from the old scope-first sequence:

- Prisma code: P2003; modelName: RolePermission.
- PostgreSQL SQLSTATE: 23503; adapter kind: ForeignKeyConstraintViolation.
- Constraint trigger: role_permissions_role_tenant_match, table: public.role_permissions, function: public.assert_role_permission_tenant_match().
- Trigger checks: public.roles plus public.permission_scope_compatibilities. This is not an incoming FK referencing a grant ID. The trigger's RAISE omits the CONSTRAINT diagnostic field; its identity was resolved from the live trigger/function definition and original message.
- Original PostgreSQL message: Role permission must target a compatible active custom role or tenant_super_admin without client-only delivery decisions.
- Attempted operation: UPDATE role_permissions SET revoked_at = ..., tenant_id = ... after changing roles.custom_scope to company. The tenant extension adds tenant_id even for a revokedAt-only update, so the immediate UPDATE OF tenant_id trigger runs and rejects the division-only permission being revoked against the already changed company scope.

Live FK inspection found no table referencing role_permissions.id. permission_dependencies references permissions.id; UserRole and ActorProfile reference roles.id. No dependent grant-reference records require deletion or recreation.

Corrected ordering: timestamp-revoke deselected grants under the original scope, update role scope, then add/reactivate only newly selected grants. Matching active grants keep their IDs and timestamps. The enclosing serializable transaction covers validation, binding checks and all writes.

Focused role tests: 10 suites / 71 tests PASS, including incompatible first save, corrected division-to-company save, unchanged compatible grant preservation, and repeated Save without repeated grant writes. Build and focused ESLint PASS. Disposable real-database integration verification is recorded by the guarded regression script.

Real database regression: PASS (exit 0), scripts/verify-role-scope-reconciliation.cjs. Run after yarn build with ROLE_SCOPE_TEST_DATABASE_URL explicitly pointing at an EMPTY localhost database named role_scope_reconciliation_test. The script rejects other hosts/database names/nonempty fixtures and does not load application .env or fall back to live connection URLs. It uses a focused disposable fixture with the relevant unchanged trigger functions extracted from repository migrations, then invokes the actual compiled provider, repository, UnitOfWork and tenant extension.

Verified: old ordering produces actual Prisma P2003 and raw PostgreSQL 23503 (table/constraint diagnostic fields null; where identifies assert_role_permission_tenant_match at RAISE); failed transaction rolls back. Current provider returns first validation 400 with the incompatible permission, corrected company Save succeeds, compatible grant ID/timestamps stay identical, incompatible grant is timestamp-revoked, UserRole/ActorProfile snapshots stay identical, and repeated Save leaves an identical database snapshot. Independent focused verification: 17 role-scope-update tests PASS. No migration is required.
