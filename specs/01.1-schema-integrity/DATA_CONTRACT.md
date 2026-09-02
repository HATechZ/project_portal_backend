# Data Contract: 01.1 — Schema Integrity & Tenant Isolation

This module owns no table. DBML remains authoritative and Prisma remains generated output.
NestJS runtime configuration contains only the `app_user` and `app_relay` connections. Database
execution temporarily supplies the provider/table-owner connection as `DATABASE_URL` to the
migration command/session; that administrative connection is never persisted in runtime `.env`.

## 1. Scope

- Phase 6: 53 RLS-protected relations and separated runtime roles.
- Phase 7: approved tenant-carrying keys plus Document/Work Request/project coherence.
- Phases 8–12: retain the actual Project Portal architecture and add only proven constraints.

No task requiring a catalog object is complete until the named post-migration assertion passes.

## 2. Proposed schema change

### 2.1 Phase 6 — RLS

The application role is `LOGIN NOSUPERUSER NOCREATEROLE NOBYPASSRLS`; the relay role is
`LOGIN NOSUPERUSER NOCREATEROLE BYPASSRLS`. Runtime secrets stay outside migrations. Every
tenant policy compares `tenant_id` with `current_setting('app.tenant_id')::uuid` and deliberately
omits `missing_ok`, so missing context raises rather than widening access.

NestJS does not enforce literal database-role identities at startup. RLS, grants, direct runtime
role separation, ownership, and relay isolation remain mandatory and are verified during the
controlled migration/deployment procedure rather than by `assertDatabaseRole` application code.

### 2.2 Phase 7 — approved guarded relationships

Eight handles: `projects`, `divisions`, `work_requests`, `documents`, `members`,
`client_contacts`, `notifications`, and `actor_profiles`, each named
`<table>_id_tenant_id_key` on `(id, tenant_id)`.

The eleven individually verified tenant-carrying FKs are:

| Constraint | Child → parent | Nullability | Existing/result action |
|---|---|---|---|
| `documents_project_id_tenant_id_fkey` | documents(project_id,tenant_id) → projects(id,tenant_id) | required | NO ACTION → NO ACTION |
| `work_requests_project_id_tenant_id_fkey` | work_requests(project_id,tenant_id) → projects(id,tenant_id) | required | NO ACTION → NO ACTION |
| `work_requests_assigned_division_id_tenant_id_fkey` | work_requests(assigned_division_id,tenant_id) → divisions(id,tenant_id) | required | NO ACTION → NO ACTION |
| `work_requests_origin_division_id_tenant_id_fkey` | work_requests(origin_division_id,tenant_id) → divisions(id,tenant_id) | optional | NO ACTION → NO ACTION |
| `registry_documents_project_id_tenant_id_fkey` | registry_documents(project_id,tenant_id) → projects(id,tenant_id) | required | NO ACTION → NO ACTION |
| `registry_documents_work_request_id_tenant_id_fkey` | registry_documents(work_request_id,tenant_id) → work_requests(id,tenant_id) | required | NO ACTION → NO ACTION |
| `registry_documents_document_id_tenant_id_fkey` | registry_documents(document_id,tenant_id) → documents(id,tenant_id) | optional | SET NULL(document_id) → same |
| `actor_profiles_member_id_tenant_id_fkey` | actor_profiles(member_id,tenant_id) → members(id,tenant_id) | optional | SET NULL(member_id) → same |
| `actor_profiles_client_contact_id_tenant_id_fkey` | actor_profiles(client_contact_id,tenant_id) → client_contacts(id,tenant_id) | optional | SET NULL(client_contact_id) → same |
| `notification_recipients_notification_id_tenant_id_fkey` | notification_recipients(notification_id,tenant_id) → notifications(id,tenant_id) | required | CASCADE → CASCADE |
| `notification_recipients_actor_id_tenant_id_fkey` | notification_recipients(actor_id,tenant_id) → actor_profiles(id,tenant_id) | required | NO ACTION → NO ACTION |

Additionally, `work_requests_id_project_id_key` supports the optional
`documents_work_request_id_project_id_fkey`. A document may remain project-level with a null
`work_request_id`. RegistryDocument gains tenant consistency only.

### 2.3 Phase 8 — retained affiliations and intentional redundancy

- Add `UNIQUE divisions(id,tenant_id,company_id)`.
- Replace only the Member/Team single-column division FKs with:
  - `members_division_id_tenant_id_company_id_fkey`
  - `teams_division_id_tenant_id_company_id_fkey`
- Preserve `NO ACTION` on delete/update and retain the direct company relationships.
- Retain `BidDetail.project_name` and `project_code` as historical Bid-era snapshots.
- Retain `document_version_folder_locations.folder_path` as materialized logical-path cache;
  `document_folders.parent_folder_id` is authoritative; `storage_key` remains separate.

### 2.4 Phase 9 — workflow exact-duplicate prevention

Retain nullable `from_role_id` and `target_role_id`. Keep
`workflow_action_role_permissions` for coarse eligibility and keep contextual/assignment
authorization in the workflow engine.

Create partial unique index `workflow_transitions_active_exact_rule_key` over tenant, action,
from/to statuses, from/target roles, assignment flag, backward flag, and sort order, using
`NULLS NOT DISTINCT`, only `WHERE is_active = true`. Thus NULL values compare equal for
duplicate detection and inactive historical duplicates remain valid.

### 2.5 Phase 10 — retained identity

No schema change. Retain User + Member/ClientContact + UserRole + ActorProfile. Member and
ClientContact keep name/email and optional User links. Do not add Person, UserAccount,
`users_legacy`, credential copies, or tenure columns.

### 2.6 Phase 11 — ActorProfile invariants

- Add CHECK `actor_profiles_at_most_one_business_target`: Member and ClientContact cannot both
  be populated. Both null is valid for role-only/System Administrator profiles.
- Add partial unique index `actor_profiles_one_default_per_user` on `(tenant_id,user_id)` where
  `user_id IS NOT NULL AND is_default = true`.
- Retain `label`; do not add ActorKind or Person dependencies.

### 2.7 Phase 12 — safe naming correction only

The generator singularizes `work_priorities` to Prisma `WorkPriority`, retaining
`@@map("work_priorities")`; this is not a database change. Keep WorkspaceType,
AttachmentSourceType, AttachmentFileGroup, DecisionResult, and InfoRequestStatus table-backed.
Keep `DocumentVersion.textContent`, existing timestamp semantics, and tenant-wide Work Request
code uniqueness across soft deletion.

## 3. Preflight and post-verification

`phase8-12-preflight.sql` is read-only and every query must return zero rows. It detects Member
and Team affiliation mismatches, duplicate active transition configurations with NULL-safe
grouping, ActorProfiles with both targets, and duplicate defaults.

`phase8-12-verification.sql` asserts every constraint/index by exact catalog name.
No data is repaired, deleted, reassigned, or backfilled automatically.

## 4. Rollback

`phase8-12-rollback.sql` drops only the new indexes/check/FKs, restores the original Member and
Team division FKs with their original NO ACTION behavior, and removes the new Division handle.
The WorkPriority correction needs no database rollback; reverting the generator restores only
the client-facing model spelling.

## 5. Denormalization retained on purpose

Bid name/code are immutable historical context; folder_path is a logical hierarchy cache;
storage_key is physical object identity; audit/event actor labels are point-in-time evidence;
Member/Team company_id is explicit organizational affiliation constrained to agree with division.
