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
