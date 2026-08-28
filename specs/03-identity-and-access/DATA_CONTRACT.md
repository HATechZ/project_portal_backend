# Data Contract: 03 — Identity & Access

Six tables. Read alongside `project_portal_workflow_management_erd.dbml` — that file, not
this one, is the authority.

---

## 1. Tables owned

| Table | Prisma model | Purpose |
|---|---|---|
| `users` | `User` | A login. |
| `roles` | `Role` | The closed set of portal roles, keyed by `ActorRoleCode`. |
| `user_roles` | `UserRole` | Grant of a role to a user, revocable without deletion. |
| `actor_profiles` | `ActorProfile` | A capacity a user acts in. **The audit subject.** |
| `auth_sessions` | `AuthSession` | A refresh-token session. |
| `password_reset_tokens` | `PasswordResetToken` | Single-use expiring reset. |

---

## 2. Fields that carry rules

### `User`

| Field | Type | Note |
|---|---|---|
| `id` | `String @db.Uuid` | app-generated |
| `email` | `VarChar(255)` | `@unique` |
| `passwordHash` | `VarChar(255)?` | **nullable** — a user may exist before credentials are issued |
| `isActive` | `Boolean @default(true)` | false blocks sign-in |
| `lastLoginAt` | `Timestamp?` | set on successful sign-in |

`passwordHash` being optional is deliberate: client contacts are provisioned as users before
credentials are delivered (`project_credential_deliveries`, module 07).

### `Role`

`code` is `ActorRoleCode @unique`: `system_admin`, `prime_consultant`, `ccr_coordinator`,
`division_lead`, `division_member`, `tms_manager`, `tms_drawing`, `tms_checking`,
`tms_approval`, `client_owner`. `isSystemRole` defaults true — seeded, not user-created.

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
| `memberId?` | set for staff actors (module 04) |
| `clientContactId?` | set for client actors (module 05) |
| `label` | `VarChar(180)`, human-readable |
| `isDefault` / `isActive` | at most one default per user (DR-03, service-enforced) |

Referenced as `*_by_actor_id` from ~25 tables across modules 07–13. Its inverse relations are
the longest list in the schema, all named `<table>By<Field>ActorProfiles`.

### `AuthSession`

`refreshTokenHash VarChar(255)`, `ipAddress?`, `userAgent?`, `expiresAt`, `revokedAt?`.
Indexes on `[userId]` and `[expiresAt]` — the second exists for a cleanup job that does not
exist yet.

### `PasswordResetToken`

`tokenHash VarChar(255) @unique`, `expiresAt`, `usedAt?`. Valid ⇔ `usedAt = null` **and**
`expiresAt > now()`. Check both; checking one is a replay bug.

---

## 3. Relations out of this module

| From | To | Module |
|---|---|---|
| `ActorProfile.memberId` | `members` | 04 |
| `ActorProfile.clientContactId` | `client_contacts` | 05 |
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

All six tables exist in `20260812000000_init`. Implementing this module needs **no
migration** unless a rule below forces one:

- Case-insensitive email uniqueness (DR-06) is not expressible in the current unique index. It
  is currently enforced by normalizing to lower case on write. Making it a database guarantee
  needs a functional unique index, which means an ERD change and a new migration.
