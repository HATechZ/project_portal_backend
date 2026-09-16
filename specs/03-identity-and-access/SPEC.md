# SPEC: 03 — Identity & Access

**Approval:** Approved · **Tables:** 7 · **Contracts:** `DATA_CONTRACT.md`, `API_CONTRACT.md`

Who is calling, and what they may do. `users`, `roles`, `user_roles`, `actor_profiles`,
`auth_sessions`, `auth_session_consumed_refresh_tokens`, `password_reset_tokens`.

The ERD distinction that shapes every other module: a **user** is a login, an **actor
profile** is a capacity that login acts in. One person may be `division_lead` in one profile
and `division_member` in another. Audit and ownership columns across the whole schema
reference `actor_id`, never `user_id` — if module 07 stamps `created_by_user_id` because the
actor layer was not ready, every audit query in 10–13 inherits the mistake.

**Current state:** Tenant-scoped User administration, universal email-only Sign In, JWT and
refresh-session lifecycle, password reset, role/permission administration, and authenticated
ActorProfile listing/activation are implemented. User administration is restricted to
`system_admin`; normal repository access remains fail-closed outside a Tenant unit of work.

## User stories

| | As a | I want | So that |
|---|---|---|---|
| US-01 | any user | to sign in and receive a session | I can act in the portal |
| US-02 | multi-capacity user | to act under a chosen actor profile | permissions and audit reflect the hat I wear |
| US-03 | `system_admin` | to grant/revoke roles without deleting history | "who could do what, when" stays answerable |
| US-04 | user who forgot a password | a single-use expiring reset link | |
| US-05 | operator | to revoke a stolen session immediately | |
| US-06 | `system_admin` | to create a tenant custom access role with initial compatible permissions | access can be delegated without creating a workflow identity |
| US-07 | `system_admin` | to see only roles eligible for a selected User | assignment dropdowns cannot grant irrelevant roles |

## Domain rules

| # | Rule | Enforced by |
|---|---|---|
| DR-01 | The actor profile is the unit of authorization and audit | schema FKs, review |
| DR-02 | Role grants are revoked by `revoked_at`, never deleted | repository has no hard delete |
| DR-03 | A non-null tenant/user has at most one default actor profile | partial unique index plus transactional service orchestration |
| DR-04 | Refresh and reset tokens are stored hashed | `refresh_token_hash`, `token_hash` |
| DR-05 | A reset token is single-use and expiring | `used_at` + `expires_at` checked together |
| DR-06 | `email` is globally unique by canonical lowercase/trimmed identity while User remains Tenant-owned | canonical CHECK + global unique constraint |
| DR-07 | An inactive user cannot authenticate | login path checks `is_active` |
| DR-08 | A password hash is never serialized to a response | absent from `UserEntity` |
| DR-09 | An actor profile targets neither or exactly one of Member and ClientContact, and any target belongs to the same tenant | CHECK plus tenant-qualified composite FKs |

## Failure modes

| Condition | HTTP | `AppErrorCode` |
|---|---|---|
| Email already registered | 409 | `CONFLICT` |
| User not found | 404 | `NOT_FOUND` |
| Bad credentials · inactive user · expired or revoked session | 401 | `UNAUTHORIZED` |
| Role lacks the permission · actor profile not the caller's | 403 | `FORBIDDEN` |
| Reset token unknown, used, or expired | 400 | `BAD_REQUEST` |

Bad credentials and unknown email return the **same** 401 — the error must not reveal whether
an address is registered.

## EARS acceptance criteria

- `[AC-U01]` The system SHALL store password and token material only as hashes.
- `[AC-U02]` The system SHALL never include `passwordHash` in any response body.
- `[AC-U03]` Business mutations SHALL require an authenticated actor. Login uses credentials;
  refresh uses a valid refresh token and Tenant context; forgot/reset password use Tenant
  context and reset requires a valid single-use token, without an access token.
- `[AC-U03a]` Client onboarding may internally initiate the existing one-time password-reset
  lifecycle for a newly provisioned ClientContact User. It SHALL not accept, expose, or retain an
  administrator-chosen password or create a second setup-token mechanism.
- `[AC-E01]` WHEN a user signs in validly, the system SHALL create an `auth_sessions` row and return a refresh token whose hash is stored.
- `[AC-E02]` WHEN a role is revoked, the system SHALL set `revoked_at` and leave the row in place.
- `[AC-E03]` WHEN a password reset is used, the system SHALL set `used_at` so it cannot be replayed.
- `[AC-E04]` WHEN a user acts, the system SHALL attribute the action to their actor profile id.
- `[AC-E05]` WHEN a User selects an eligible owned ActorProfile, the system SHALL make it the
  sole default profile in one transaction.
- `[AC-S01]` WHILE a user is inactive, sign-in SHALL fail with 401.
- `[AC-S02]` WHILE a session is revoked or past `expires_at`, it SHALL NOT authorize a request.
- `[AC-W01]` IF credentials are wrong, THEN the response SHALL NOT reveal whether the email exists.
- `[AC-W02]` IF a caller supplies an actor profile they do not own, THEN the system SHALL return 403.
- `[AC-W03]` WHEN any User signs in with email and password, the system SHALL resolve the internal Tenant from globally unique normalized email and SHALL NOT require a workspace, Company, or raw Tenant identifier.
- `[AC-W04]` IF email or password resolution fails, THEN the system SHALL return the same generic credential failure.
- `[AC-W05]` IF a User attempts to activate an unavailable or unowned ActorProfile, THEN the
  system SHALL return 403 without changing their default profile.

## Custom access roles — approved V1 boundary

System roles remain application-defined workflow and organizational identities. Their fixed
`ActorRoleCode`, existing grants, ActorProfiles, permission grants, workflow transitions, and
routing behavior remain unchanged. A custom access role is tenant-created, permission-configured
access only: it never creates a workflow stage, routing identity, transition endpoint, or
System Administrator bypass. `prime_consultant` is not restored.

Only a same-Tenant `system_admin` may create, administer permissions for, discover, assign, or
revoke a custom access role. A custom role cannot administer roles merely by being custom or by
holding a workflow permission. Existing hierarchy rules for `system_admin`, `ccr_coordinator`,
`division_head`, `division_lead`, `team_lead`, `division_member`, TMS roles, `client_owner`, and
workflow transitions are preserved.

V1 scope is explicit and limited to current enforceable ActorProfile evidence:

| Scope | Required assigned ActorProfile target | Enforcement boundary |
|---|---|---|
| `member` | active same-Tenant Member | exact linked Member only |
| `division` | active same-Tenant Member | linked Member's home Division only; led Divisions do not widen custom scope |
| `company` | active same-Tenant Member | linked Member's Company only |
| `client_contact` | active same-Tenant ClientContact | exact linked ClientContact only |
| `client` | active same-Tenant ClientContact | linked Contact's active Client only |

`tenant`, `team`, `role_only`, and `client_company` are not supported in V1: the current
object-scope model cannot safely prove them for a custom role. Assignment must create or reuse an
ActorProfile with the required existing target; it must not fabricate a Member or ClientContact.
The role's declared scope and selected profile target must agree before a grant becomes active.
Existing object checks remain authoritative in addition to permission checks.

The executable custom-role permission matrix is intentionally small in V1:

| Workflow action | Allowed custom scopes |
|---|---|
| `ADD_MEMBER` | `division`, `company` |
| `ADD_TEAM` | `division`, `company` |
| `ASSIGN_MEMBER` | `division`, `company` |
| every other `WorkflowActionCode` | none |

`member`, `client_contact`, and `client` remain representable future scopes but have no
eligible V1 permission and are not selectable on role creation. Eligibility expands only after
the owning protected operation is implemented with generic permission plus object-scope checks.

Creation is one atomic business operation: create the tenant custom role and its initial approved
permission grants together, or create neither. Permission replacement remains the later full-set
replacement operation. Assignment discovery and assignment both re-evaluate server-side target,
tenant, role kind/scope, active grants, and existing hierarchy; frontend filtering is never
authoritative.

## Identity completion acceptance

- Role assignment atomically ensures one reusable role-only ActorProfile for that User/role.
  It preserves an existing eligible default; revoked grants make their profiles ineligible.
- Operator means a same-Tenant `system_admin`, who may revoke all active sessions of a
  same-Tenant User. Missing or cross-Tenant targets return 404; non-admin callers return 403.
- Updates reject null fullName, email, password and isActive with 400; avatarUrl remains nullable.
- Recovery always returns its generic accepted response on mail/queue failure. Failed enqueue
  retires only its own token. Concurrent successful requests leave only the latest committed
  token usable. Expired, used and superseded tokens fail without changing credentials.
- Concurrent security mutations either commit a complete valid result or return a mapped 409
  for retry. Login must not create a usable session from stale credentials after a password
  change or deactivation. Explicit session revocation orders against concurrent session creation.
- Historical token cleanup and removing Tenant identifiers from recovery remain deferred.
- Bearer-authenticated endpoints derive Tenant context solely from the verified JWT Tenant
  claim, ignoring caller Tenant headers. Tenant activation, session validity, active User and
  eligible ActorProfile checks still apply; object access remains Tenant-isolated.

## Custom-role lifecycle boundary

V1 approves creation, initial permission grants, permission replacement, eligible-role discovery,
assignment, and timestamp revocation only. Rename, deactivation, and deletion of custom roles
require a later owner decision and are not inferred here.

## Out of scope

`members` and `client_contacts` that actor profiles point at (04, 05) · which workflow action
each role may fire — module 09 owns `workflow_action_role_permissions`.
