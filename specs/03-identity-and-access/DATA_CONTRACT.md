# Data Contract: 03 — Identity & Access

Seven tables. Read alongside `project_portal_workflow_management_erd.dbml` — that file, not
this one, is the authority.

---

## 1. Tables owned

| Table | Prisma model | Purpose |
|---|---|---|
| `users` | `User` | A login. |
| `roles` | `Role` | System workflow roles plus tenant custom access roles; a schema migration is required before custom rows exist. |
| `user_roles` | `UserRole` | Grant of a role to a user, revocable without deletion. |
| `actor_profiles` | `ActorProfile` | A capacity a user acts in. **The audit subject.** |
| `auth_sessions` | `AuthSession` | A refresh-token session. |
| `auth_session_consumed_refresh_tokens` | `AuthSessionConsumedRefreshToken` | Retained hashed refresh tokens for replay detection. |
| `password_reset_tokens` | `PasswordResetToken` | Single-use expiring reset. |

---

## 2. Fields that carry rules

### `User`

| Field | Type | Note |
|---|---|---|
| `id` | `String @db.Uuid` | app-generated |
| `fullName` | `VarChar(160)` | required account identity field |
| `email` | `VarChar(255)` | globally unique canonical lowercase/trimmed login identity; User remains Tenant-owned |
| `country` | `VarChar(100)?` | nullable for legacy users; required by Company signup |
| `phone` | `VarChar(60)?` | nullable for legacy users; required by Company signup; not unique |
| `passwordHash` | `VarChar(255)?` | **nullable** — a user may exist before credentials are issued |
| `isActive` | `Boolean @default(true)` | false blocks sign-in |
| `lastLoginAt` | `Timestamp?` | set on successful sign-in |

`passwordHash` being optional is deliberate: client contacts are provisioned as users before
credentials are delivered (`project_credential_deliveries`, module 07).

### `Role`

`code` is `ActorRoleCode @unique`: `system_admin`, `ccr_coordinator`, `division_head`,
`division_lead`, `team_lead`, `division_member`, `tms_manager`, `tms_drawing`,
`tms_checking`, `tms_approval`, `client_owner`. `isSystemRole` defaults true — seeded,
not user-created.

Role alone is never object scope. Authorization combines verified Tenant/Company context,
active ActorProfile, role/permission, and relevant Division/Team/assignment evidence.
`division_head` is Company-scoped across all current and future Divisions in the actor's own
Company; `division_lead` is scoped to one Division; `team_lead` is scoped only to exact Teams
legitimately led by the actor, with `Team.leadMemberId` as required object-scope evidence.

Leadership creation/assignment authority follows the hierarchy. `system_admin` of the current
Tenant/Company may create/provision or assign `division_head`; `division_head` may
create/provision or assign `division_lead` only for a Division inside the same Company;
`division_lead` may create/provision or assign `team_lead` only for a Team inside that Division;
`team_lead` may manage or create eligible ordinary Members only within its exact Team scope,
subject to the approved Member onboarding rules. Creating a leadership candidate reuses normal
Member onboarding: `User -> Member`; later role/leadership assignment creates or reuses the
UserRole and Member-backed ActorProfile. No separate leader identity model is introduced.

#### Approved custom-role data-model change (implementation prerequisite)

The current `Role.code ActorRoleCode @unique` cannot represent arbitrary tenant custom roles.
`POST /role` MUST NOT be implemented against that shape or by adding arbitrary values to
`ActorRoleCode`. A database-architect-approved migration must retain `roles.id` for every
existing foreign key while separating fixed system identity from tenant custom identity:

| Required field/constraint | Purpose |
|---|---|
| `system_roles(role_id PK/FK, system_code ActorRoleCode UNIQUE)` | the only stored fixed system/workflow identity; no duplicate `Role.systemCode` or enum `Role.code` remains |
| nullable `tenantId` plus Tenant FK | custom ownership and tenant/RLS boundary; system rows remain global |
| backend-generated `customCode` text plus unique `(tenantId, customCode)` | tenant-safe identifier; client never submits it |
| nullable `customScope` constrained to `member`, `division`, `company`, `client_contact`, `client` | explicit enforceable custom access boundary |
| row-kind CHECK | system: `isSystemRole=true` and custom fields null; custom: `isSystemRole=false` and tenant/custom code/scope present |
| workflow-reference protection | fixed workflow FKs target `system_roles.role_id`, so custom IDs cannot be configured as routing identities |

The migration must backfill every existing Role unchanged as a system row; preserve existing
`UserRole`, `ActorProfile`, permission-grant and workflow FKs by `roles.id`; and apply roles RLS
so a tenant reads global system rows plus only its own custom rows. Writes may target only the
current Tenant's custom rows. The fixed workflow FKs are `workflow_transitions.from_role_id`,
`workflow_transitions.target_role_id`, `workflow_info_requests.target_role_id`, and
`work_request_revision_requests.requested_to_role_id`; universal assignment/profile/grant FKs
remain on `roles.id`, with no unsafe cross-table CHECK.

Custom permission grants continue to use `workflow_action_role_permissions`. Existing catalog
fields (`id`, `code`, `name`, `description`, visibility and revision/info/assignment/terminal
flags) remain the selector data; display tags may be derived only from those existing flags.
No UI-only grouping persistence is approved. V1 policy is centrally enforced: `ADD_MEMBER`,
`ADD_TEAM`, and `ASSIGN_MEMBER` allow only `division` and `company`; all other actions are
ineligible. A policy relation is deferred until its catalog needs exceed this fixed approved matrix.

Custom assignment requires a compatible existing ActorProfile target: Member for `member`,
`division`, `company`; ClientContact for `client_contact`, `client`. It must create/reuse that
profile atomically with the UserRole grant and cannot use the current role-only profile path for
a scoped custom role.

### `UserRole`

`userId`, `roleId`, `assignedByUserId?`, `assignedAt`, `revokedAt?`.
Index `[userId, roleId, revokedAt]`. **A grant is revoked by setting `revokedAt`**, so an
"active roles" query must filter `revokedAt: null`.

Note `assignedByUserId` references a **user**, not an actor — the one deliberate exception to
DR-01, because a grant is an account-administration act rather than a workflow act.

### `ActorProfile`

| Field | Note |
|---|---|
| `userId?` | nullable — a profile can exist before the login does |
| `roleId` | required |
| `memberId?` | optional staff target; `(memberId, tenantId)` must identify one Member (module 04) |
| `clientContactId?` | optional client target; `(clientContactId, tenantId)` must identify one ClientContact (module 05) |
| `label` | `VarChar(180)`, human-readable |
| `isDefault` / `isActive` | at most one default for each non-null `(tenantId, userId)`, database-enforced |

An ActorProfile may have neither business target (for example, a System Administrator) or
exactly one of `memberId` and `clientContactId`; both populated is rejected by
`actor_profiles_at_most_one_business_target`. The partial unique index
`actor_profiles_one_default_per_user` enforces one default where both tenant and user are
non-null.

Referenced as `*_by_actor_id` from ~25 tables across modules 07–13. Its inverse relations are
the longest list in the schema, all named `<table>By<Field>ActorProfiles`.

### `AuthSession`

`tenantId`, `id`, `userId`, `refreshTokenHash VarChar(255)`,
`previousRefreshTokenHash VarChar(255)?`, `ipAddress?`, `userAgent?`, `expiresAt`,
`absoluteExpiresAt`, `revokedAt?`, `createdAt`. Both expiry limits must be in the future.
Indexes on `[userId]`, `[expiresAt]`, `[previousRefreshTokenHash]` and `[tenantId]`.
Historical session/token cleanup is deferred; expiry remains enforced on every use.

### `AuthSessionConsumedRefreshToken`

`tenantId`, app-generated `id`, `sessionId`, `tokenHash VarChar(255)`, `consumedAt`.
Tenant-qualified token uniqueness and a `sessionId` foreign key (cascade on session deletion)
retain every consumed hash for replay detection beyond the immediately previous token. Rotation and insertion of the
consumed hash share one transaction. Plaintext refresh tokens are never stored here.

### `PasswordResetToken`

`tokenHash VarChar(255)`, unique within `[tenantId, tokenHash]`, `expiresAt`, `usedAt?`. Valid ⇔ `usedAt = null` **and**
`expiresAt > now()`. Check both; checking one is a replay bug.

---

## 3. Relations out of this module

| From | To | Module |
|---|---|---|
| `ActorProfile.(memberId, tenantId)` | `members.(id, tenantId)` | 04 |
| `ActorProfile.(clientContactId, tenantId)` | `client_contacts.(id, tenantId)` | 05 |
| `User.membersByUserId` | `members` | 04 |
| `User.clientContactsByUserId` | `client_contacts` | 05 |
| `Role` → `workflow_transitions`, `workflow_action_role_permissions` | | 09 |

Modules 04 and 05 must land before actor profiles can be fully populated. Until then a
profile with `roleId` alone is valid.

---

## 4. Derived state

None. This module stores what it knows. It reads no latest-event tables.

---

## 5. Migration impact

The original six identity tables exist in `20260812000000_init`; consumed refresh history is
also present in the current schema. Module 01.1 subsequently added the
tenant-qualified ActorProfile target FKs, the at-most-one-business-target CHECK, and the
partial default-profile unique index. Further implementation needs no migration unless a rule
below forces one:

- Global normalized email identity is enforced by canonical lowercase/trimmed storage plus a
  global unique constraint. Tenant ownership, the Tenant FK, tenant index, and RLS remain intact.
- Company Workspace onboarding adds nullable `country` and `phone`. Existing users remain null;
  signup requires non-empty values. Legacy backfill and later NOT NULL tightening require a
  separate owner decision.

## Required database privilege change — not applied

Read-only catalog inspection on 2026-09-08 confirmed that the application role `app_user`
has only `SELECT` on `public.actor_profiles`. The prepared ordinary-user provisioning path
requires `INSERT` and `UPDATE`; the existing default-profile switch requires `UPDATE`.
Real runtime execution failed with SQLSTATE `42501` (permission denied for actor_profiles).

The owner must supply the minimum privileges before runtime sign-off:

```sql
GRANT INSERT, UPDATE ON TABLE public.actor_profiles TO app_user;
```

This is a privilege prerequisite, not a table/column or RLS-policy reshape. No new schema
objects are required by the prepared implementation. No grants, migrations, DBML or schema
changes were made in this task. Existing RLS and Tenant-scoped UnitOfWork remain mandatory;
`app_relay` is not used for identity writes. Re-run the full runtime tests after the owner
resolves the privilege prerequisite.

## Proposed schema change

Required for the approved leadership-role foundation; not applied by Codex because Article IX
marks `prisma/schema.prisma`, migrations, and DBML-generated schema output as owner-only outside
the database-architect path.

Tables/objects:

- PostgreSQL enum `actor_role_code`: add values `division_head` and `team_lead`.
- Prisma enum `ActorRoleCode`: add `division_head` and `team_lead`.
- `roles` seed data: add system roles for `division_head` and `team_lead` with deterministic
  IDs:
  - `division_head`: `10000000-0000-4000-8000-000000000011`
  - `team_lead`: `10000000-0000-4000-8000-000000000012`
- Permission seed matrix proposal:
  - `system_admin`: keep the existing supervisor matrix; it may provision/assign
    `division_head` through existing role assignment.
  - `division_head` confirmed organization permissions only:
    `ADD_DIVISION`, `ADD_TEAM`, `ASSIGN_LEADER`.
    `ADD_DIVISION` covers creating, listing/viewing, updating, and guarded-deleting otherwise
    deletable Divisions in the actor's own Tenant/Company Division domain; newly created
    Divisions automatically fall within that Company-wide Division scope. `ADD_TEAM` covers
    approved Team management and deletion of otherwise-deletable Teams across own-Company
    Divisions through object scope. `ASSIGN_LEADER` covers provisioning/assigning
    `division_lead`; none of these grants imply system_admin inheritance or broad role
    administration.
    Do not grant `ASSIGN_MEMBER` for Division routing because Division Head does not directly
    assign Members.
    Do not grant `UPDATE_SETTINGS`, Client/ClientContact administration, auth/session/security,
    arbitrary user administration, role/permission administration, or unrelated system_admin
    operations.
  - `division_lead`: keep own-Division Team management/member assignment permissions. Use
    `ASSIGN_LEADER` only for assigning `team_lead` inside own Division once that assignment flow
    is implemented.
  - `team_lead` confirmed organization permissions only:
    `ADD_MEMBER`, `ASSIGN_MEMBER`.
    `ADD_MEMBER` covers creating eligible ordinary Members in exact Team scope through approved
    Member onboarding. `ASSIGN_MEMBER` covers assigning eligible Members to the exact led Team.

Deferred workflow-transition capabilities:

- `division_head` needs semantically correct workflow permissions to assign/reroute a Work
  Request to a Division, review a Division Lead submission, return revision to Division Lead,
  and approve to the next configured authorized workflow stage.
- `division_lead` needs semantically correct workflow permissions to assign a Work Request to a
  Team, review Team Lead submission, return revision to Team Lead, and submit to Division Head.
- `team_lead` needs semantically correct workflow permissions to assign a Team Member, review
  Member submission, return revision to Member, and submit to Division Lead.
- Existing old workflow permissions such as `PM_LEAD_RESPOND_TO_MEMBER`, `PM_RETURN_TO_MEMBER`,
  `FORWARD_TO_TMS`, `FORWARD_TO_CCR`, `ORIGIN_MANAGER_APPROVE`, `SEND_BACKWARD`, and
  `REQUEST_INFO_FROM_MARKETING` must not be granted to the new roles unless a current workflow
  spec verifies their exact semantics match the new hierarchy. If no existing permission has the
  correct semantics, define the required capability in the workflow/work-request spec before
  adding final enum codes.

Draft migration SQL shape:

```sql
ALTER TYPE public.actor_role_code ADD VALUE IF NOT EXISTS 'division_head';
ALTER TYPE public.actor_role_code ADD VALUE IF NOT EXISTS 'team_lead';
```

No new table or column is required. `division_head` uses the existing role-only ActorProfile
shape; `team_lead` uses the existing Member-backed ActorProfile shape plus `teams.lead_member_id`
object-scope evidence.

What breaks without it:

- Generated `ActorRoleCode` lacks `division_head` and `team_lead`, so runtime code cannot use
  generated enum members and the temporary string-cast bridge cannot be removed.
- Seeded roles and permission grants cannot provision or authorize the approved hierarchy.
- HTTP/runtime verification for `division_head` and real `team_lead` ActorProfiles cannot pass.

Owner apply path:

```text
MANUAL CHECK
Command: node scripts/dbml-to-prisma.cjs && corepack yarn prisma:migrate --name add-division-head-team-lead-roles && corepack yarn prisma:generate
Expected: Prisma enum includes division_head/team_lead, a migration adds the enum values, seed data can reference both roles, and generated ActorRoleCode exposes ActorRoleCode.division_head and ActorRoleCode.team_lead.
```
