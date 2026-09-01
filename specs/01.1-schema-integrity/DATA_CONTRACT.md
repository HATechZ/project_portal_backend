# Data Contract: 01.1 — Schema Integrity & Tenant Isolation

This module owns no table. RLS protects 52 tenant-bearing tables plus the `tenants` root;
later decision-gated phases propose three new tables and five dropped tables.

Governed by [Art. IX](../rules/08-database.md): **everything below is proposed, not applied.**
No agent outside the `database-architect` subagent may edit `prisma/schema.prisma`, the DBML,
or `prisma/migrations/`. Every task in `tasks.md` stays unticked, and its `VERIFY:` line fails,
until the owner applies the change — that is the intended state, not a defect.

**Resolved precondition (owner decision, 2026-09-01).** Reconstruct the deleted DBML against
the legitimate current `prisma/schema.prisma` and applied migration history, including
`OutboxMessage`, `ProcessedEvent`, and migration `20260821000000`. DBML remains the sole
authoritative source and generation remains DBML → `dbml-to-prisma.cjs` → Prisma schema.

---

## 1. Scope of change

| Change | Tables | Phase |
|---|---|---|
| RLS enabled + isolation policy | 53 (52 scoped children + tenant root) | 6 |
| Composite tenant-carrying FK | 5 chains | 7 |
| Derived column dropped | 6 columns across 4 tables | 8 |
| Join dependency decomposed | `workflow_transitions` | 9 |
| Identity extracted | `users` → `people` + `user_accounts`; `members`, `client_contacts` reshaped | 10 |
| Union typed | `actor_profiles` | 11 |
| Lookup collapsed to enum column | 5 tables dropped | 12 |

---

## 2. Proposed schema change

### 2.1 Row-level security (Phase 6)

Prisma has no syntax for RLS. All of it lives in the migration by hand, for each of the 52
models listed in `src/common/tenant/tenant.constants.ts`, plus the `tenants` scope root. The
root exposes only `tenants.id = current_setting('app.tenant_id')::uuid`, because current code
uses it only to validate activation for the tenant already present in request context:

```sql
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_documents ON documents
  USING (tenant_id = current_setting('app.tenant_id')::uuid);
```

Note the **absence** of a `IS NULL OR` clause and the **absence** of the `missing_ok` second
argument to `current_setting`. Both are deliberate: with them, a connection that never set the
GUC sees every tenant's rows. Without them it raises, and a forgotten `SET LOCAL` fails loudly
at the first query instead of leaking silently. This is the single most important line in the
module.

**Missing-GUC contract:** a scoped query without `app.tenant_id` is an error. It does not
return zero rows. Application repositories therefore never execute against the root scoped
client: every public repository operation enters `UnitOfWorkService.execute`, which sets the
transaction-local GUC before invoking repository work. Direct repository-client access with
no active unit of work throws before a query can be issued.

Two pre-provisioned login roles are required because the relay legitimately reads across
tenants. Credentials are deployment secrets and are never created or altered by a migration:

```sql
CREATE ROLE app_user LOGIN NOSUPERUSER NOCREATEROLE NOBYPASSRLS;
CREATE ROLE app_relay LOGIN NOSUPERUSER NOCREATEROLE BYPASSRLS;
```

`DATABASE_URL` connects as `app_user` and backs `prisma.scoped`. A new
`DATABASE_URL` connects as `app_user` and backs `prisma.scoped`.
`DATABASE_URL_PRIVILEGED` connects as `app_relay` and backs the distinct `prisma.unscoped`
client used only by the outbox relay. Table owners are exempt from their own RLS, so the
migration role must not be either runtime identity. The migration validates pre-provisioned
role attributes and membership separation, but it does not manage roles, passwords, or
authentication cutover.

### 2.2 Composite foreign keys (Phase 7)

Each parent gains a redundant unique that lets a child reference the pair:

```prisma
model Project {
  id       String @id @map("id") @db.Uuid
  tenantId String @map("tenant_id") @db.Uuid

  @@unique([id, tenantId])   // scope handle — carries no meaning alone
}
```

Applied to five chains only, chosen for blast radius rather than completeness:

| Child | Parent(s) reached through the tenant |
|---|---|
| `documents` | `projects`, `work_requests` |
| `work_requests` | `projects`, `divisions` |
| `registry_documents` | `projects`, `work_requests`, `documents` |
| `actor_profiles` | `people`, `members`, `client_contacts` |
| `notification_recipients` | `notifications`, `actor_profiles` |

`work_requests` additionally needs `@@unique([id, projectId])` so `documents` can reach its
project *through* its work request — which is what makes a document's project and its work
request's project structurally unable to disagree.

### 2.3 Derived columns dropped (Phase 8)

| Table | Column | Derivable from | Anomaly today |
|---|---|---|---|
| `members` | `company_id` | `division.company_id` | member's company ≠ their division's |
| `teams` | `company_id` | `division.company_id` | same |
| `bid_details` | `project_name` | `project.name` | drifts on rename |
| `bid_details` | `project_code` | `project.code` | drifts on rename |
| `actor_profiles` | `label` | `person.full_name` + `role.name` | stale after rename |

`document_version_folder_locations.folder_path` is retained by owner decision as an
intentional materialized logical-path cache; see §5. It is not a physical object-storage key.

### 2.4 `workflow_transitions` (Phase 9)

The table fuses the state machine with role eligibility, and has **no unique constraint at
all** — two rows may claim the same action from the same status leads to different statuses.

| Change | Column |
|---|---|
| dropped | `from_role_id` — eligibility already lives in `workflow_action_role_permissions` |
| added | `@@unique([tenantId, actionId, fromStatusId])` |
| retained | nullable `target_role_id` remains transition-level routing |

Owner decision (2026-09-01): transition routing coexists with assignment/member/client/
requester-dependent dynamic routing. Keep nullable `target_role_id` on the transition and
drop only `from_role_id`. Module 09 may revisit a specific relation only if its workflow
contract later proves that relation is truly action-global.

### 2.5 Identity (Phase 10)

`members.name/email` and `client_contacts.name/email` duplicate `users.full_name/email`
whenever `user_id` is set. Two sources of truth for one human.

```prisma
model Person {
  id        String  @id @map("id") @db.Uuid
  tenantId  String  @map("tenant_id") @db.Uuid
  fullName  String  @map("full_name") @db.VarChar(160)
  email     String  @map("email") @db.VarChar(255)
  phone     String? @map("phone") @db.VarChar(60)
  avatarUrl String? @map("avatar_url") @db.Text

  @@unique([tenantId, email])
  @@unique([id, tenantId])
  @@map("people")
}

model UserAccount {
  personId     String    @id @map("person_id") @db.Uuid
  tenantId     String    @map("tenant_id") @db.Uuid
  passwordHash String?   @map("password_hash") @db.VarChar(255)
  isActive     Boolean   @default(true) @map("is_active")
  lastLoginAt  DateTime? @map("last_login_at") @db.Timestamp(6)

  @@map("user_accounts")
}
```

`Member` keeps `division_id`, `role_title`, and tenure; it loses `name`, `email`, `company_id`,
and `is_active` (replaced by `left_at`, matching how `team_members` already models tenure).
`ClientContact` keeps `client_id`, `designation`, `is_primary`; it loses `name` and `email`.

Three things close at once: identity has one home; a member with no login is expressible
without a nullable FK standing in for it; and one person can be both a member and a client
contact without two identity rows.

`users` is not dropped in place — it becomes `people` + `user_accounts`, so every FK currently
pointing at `users.id` repoints at `people.id`. Those are `user_roles`, `auth_sessions`,
`password_reset_tokens`, `members`, `client_contacts`, `actor_profiles`.

### 2.6 `actor_profiles` (Phase 11)

```prisma
enum ActorKind { MEMBER CLIENT_CONTACT }

model ActorProfile {
  personId        String    @map("person_id") @db.Uuid    // was user_id, was nullable
  roleId          String    @map("role_id") @db.Uuid
  kind            ActorKind @map("kind")
  memberId        String?   @map("member_id") @db.Uuid
  clientContactId String?   @map("client_contact_id") @db.Uuid
  isDefault       Boolean   @default(false) @map("is_default")
}
```

30 relations hang off this table, which is why the missing constraints matter here more than
anywhere else.

### 2.7 Lookup collapse (Phase 12)

Each of these is a table whose entire content is an enum you already declare in Prisma, plus a
display name. Two candidate keys, a surrogate that buys nothing, and a join on every read.

**Dropped, column becomes the enum directly:** `workspace_types`, `attachment_source_types`,
`attachment_file_groups`, `decision_results`, `info_request_statuses`.

**Kept — they carry real attributes** — but the UUID surrogate is dropped and `code` becomes
the primary key: `workflow_statuses` (`sort_order`, `is_terminal`), `project_statuses` (same),
`workflow_action_definitions` (five behaviour flags), `roles`, `option_types`.

`revision_request_statuses` is a judgement call: it has no metadata today but module 11 has not
been specced, so it stays until module 11 says otherwise.

---

## 3. Raw SQL the schema cannot express

Prisma emits none of this. It lives only in migration files, and a schema regeneration will not
restore it — so every item is asserted explicitly in `tasks.md`.

```sql
-- Phase 11: exactly one target, matching the discriminator
ALTER TABLE actor_profiles ADD CONSTRAINT actor_profiles_kind_target CHECK (
  (kind = 'MEMBER'         AND member_id IS NOT NULL AND client_contact_id IS NULL) OR
  (kind = 'CLIENT_CONTACT' AND client_contact_id IS NOT NULL AND member_id IS NULL));

-- Phase 11: one default profile per person
CREATE UNIQUE INDEX actor_profiles_one_default
  ON actor_profiles (tenant_id, person_id) WHERE is_default;

-- Phase 12: soft-deleted work requests should not hold their code forever
DROP INDEX work_requests_tenant_id_code_key;
CREATE UNIQUE INDEX work_requests_tenant_id_code_key
  ON work_requests (tenant_id, code) WHERE deleted_at IS NULL;
```

---

## 4. Backfill

Phase 10 is the only move that touches existing rows. It is one migration, not several,
because a half-applied identity split has no valid intermediate state.

```sql
INSERT INTO people (id, tenant_id, full_name, email, avatar_url)
  SELECT id, tenant_id, full_name, email, avatar_url FROM users;

INSERT INTO user_accounts (person_id, tenant_id, password_hash, is_active, last_login_at)
  SELECT id, tenant_id, password_hash, is_active, last_login_at
  FROM users WHERE password_hash IS NOT NULL;
```

Members and client contacts with no `user_id` have no `users` row to copy, so they mint a new
`people` row from their own `name`/`email` before `person_id` is set `NOT NULL`. Members whose
`email` collides with an existing person in the same tenant collapse onto that person — which
is the correct outcome and also the reason `@@unique([tenantId, personId, divisionId])`
replaces `@@unique([tenantId, email])` on `members`.

**Rollback:** the migration is not reversible by `prisma migrate` once `users` is dropped.
`users` is therefore retained as `users_legacy` for one release and dropped in a follow-up
migration after the owner confirms. `tasks.md` Phase 10 asserts `users_legacy` exists, not that
`users` is gone.

---

## 5. Denormalization kept on purpose

Not every repetition is a defect. These stay, and a reshape that "normalizes" them is wrong:

| What | Why it stays |
|---|---|
| `tenant_id` on 52 tables | The discriminator itself. Phases 6–7 make it enforced rather than removing it. |
| `notifications.triggered_by_label` | Point-in-time snapshot. A notification says who triggered it *then*, not who they are now. |
| `*_events`, `*_audit_logs` | Append-only logs are supposed to carry redundant context; that is what makes them readable after the referenced rows change. |
| `outbox_messages`, `processed_events` | Shape dictated by the delivery protocol (Art. XI), not by normal form. Out of scope entirely. |
| `bid_details.cargo_name` beside `cargo_code_option_id` | The free-text name is the instance; the option is its classification. Different facts. |
| `document_version_folder_locations.folder_path` | Materialized logical-path cache for list/read performance. `document_folders.parent_folder_id` is authoritative; module 08 owns synchronization and rebuild behavior after supported rename/move operations. It is separate from physical object-storage `storage_key`. |
