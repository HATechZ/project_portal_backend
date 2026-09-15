# SPEC: 04.1.1 — Division Lead Multiplicity

**Status:** Gate 4 · schema applied 2026-09-15 · Phases 1-3 implemented
**Tables owned:** proposes `division_leads` (new); reshapes no existing table
**Dependencies:** `04.1-division` (Division CRUD + current lead orchestration), `03-identity-and-access` (UserRole/ActorProfile), `04.2-member`, `04.3-team` (scope consumers)

## 1. Overview & Business Intent

Today a Division Lead is not stored. It is inferred from the identity chain
`User -> division_lead UserRole -> ActorProfile -> Member -> Division`, and the Division is
read from `Member.divisionId` — a single, non-nullable column. A Member therefore belongs to
exactly one Division and can lead only that one.

This module makes Division Lead an explicit, persisted, many-to-one assignment so that **one
Member may lead several Divisions**, while keeping **one active Lead per Division**. It
introduces a `division_leads` join table as the single source of truth for who leads what, and
moves every authorization decision off `Member.divisionId` and onto that table.

Actors: `system_admin` (assign/revoke within own Company), `division_head` (assign/revoke
within own Company), `division_lead` (the subject of the assignment; gains scope over each
Division it leads).

## Current backend, approved target, and deferred matters

**Current backend:** `PUT /division/:id/lead` grants the `division_lead` UserRole and links an
ActorProfile to a Member, requiring that Member to already sit in the target Division
(`division-lead.repository.ts:41`). Nothing records the Division↔Lead pair; assignment is
additive and never revokes. Scope is resolved from `Member.divisionId` in
`member-scope.provider.ts` and `team-scope.provider.ts`.

**Approved target:** the `division_leads` table, the relaxed assign rule, the revoke-incumbent
behavior, and the set-based scope resolution defined below.

**Owner decision recorded 2026-09-15:** a Member may lead **many** Divisions; a Division has
**at most one active Lead**. This is now fixed cardinality, not an open question.

**Deferred:** Division-Head multiplicity, Team Lead reshape, `Division.leadMemberId`
(remains unused and is not introduced), workflow routing that consumes lead sets, and any
lead-derived Work Request assignment.

## 2. User Stories

- **US-01:** As a `system_admin`, I want to assign one Member as Lead of several Divisions so
  a single manager can cover multiple Divisions without duplicate Member records.
- **US-02:** As a `division_lead` leading two Divisions, I want my Member and Team operations
  to succeed in **both**, so authorization matches the assignments that were actually granted.
- **US-03:** As a `system_admin`, I want assigning a new Lead to a Division to retire the
  previous one automatically, so "who leads this Division" always has exactly one answer.
- **US-04:** As an auditor, I want revoked leadership retained with its timestamp so history
  is never destroyed.

## 3. Domain Rules

| # | Rule | Enforced by |
|---|---|---|
| DR-01 | Division Lead is a row in `division_leads`, not an inference from `Member.divisionId`. A Member's home Division confers no leadership. | join table; scope providers |
| DR-02 | One Member MAY hold active Lead rows for many Divisions. No constraint limits the count. | absence of any per-member unique |
| DR-03 | One Division has **at most one** active Lead. Assigning a new Lead revokes the incumbent in the same transaction. | partial unique index `(tenant_id, division_id) WHERE revoked_at IS NULL`; assign orchestration |
| DR-04 | The assigned Member must belong to the same Tenant **and Company** as the Division. It need **not** belong to that Division. | composite FK; assign precheck |
| DR-05 | The assigned Member must already have same-Tenant User access (`Member.userId` non-null). Assignment never creates a User, password, or session. | assign precheck; 409 on missing link |
| DR-06 | Leadership is revoked by setting `revokedAt`, never by deleting the row (non-negotiable #9). | repository write shape; no `delete` path |
| DR-07 | A Member may be re-assigned to a Division it previously led. Uniqueness constrains only **active** rows. | partial unique indexes, both `WHERE revoked_at IS NULL` |
| DR-08 | The `division_lead` UserRole grant remains User-level and Division-agnostic. It conveys the role; `division_leads` conveys the object scope. Holding the role alone grants access to no Division. | scope providers reject empty lead sets |
| DR-09 | Every actor Division scope resolves to a **set** of Division IDs, never a single value. Any comparison of the form `actor.member.divisionId === target` is a defect. | scope providers; static assertion |
| DR-10 | Revoking the last active Lead of a Division is permitted; a Division may be Lead-less. No operation requires a Lead to exist. | no NOT NULL on any Division column |
| DR-11 | Division hard-delete must probe `division_leads` alongside the existing five inverse relations. Lead rows are dependents and block deletion. | delete dependency probe (extends `04.1` DR-06) |
| DR-12 | Assignment and revocation are Company-scoped operations: `system_admin` and `division_head` act only within their own Company. Role alone never bypasses object scope. | guard chain; assign/revoke service validation |

## 4. Failure Modes

| Condition | HTTP | `AppErrorCode` |
|---|---:|---|
| Malformed `memberId`/`divisionId` UUID | 400 | `VALIDATION_FAILED` |
| Division missing, or outside Tenant/Company | 404 | `NOT_FOUND` |
| Member missing, inactive, or outside Tenant/Company | 404 | `NOT_FOUND` |
| Member has no linked User | 409 | `CONFLICT` |
| Member is already the active Lead of that Division (no-op re-assign) | 200 | — (idempotent) |
| Concurrent assign racing the incumbent revoke | 409 | centralized conflict mapping |
| Caller lacks `ASSIGN_LEADER`, or is outside own Company | 403 | `FORBIDDEN` |
| Revoking a Lead row that is already revoked | 404 | `NOT_FOUND` |

## 5. EARS Acceptance Criteria

- `[AC-U01]` The module SHALL derive Tenant and Company from verified server context and SHALL
  never accept caller-controlled ownership.
- `[AC-U02]` The module SHALL use the ordinary app_user Tenant UnitOfWork/RLS path; no
  app_relay, BYPASSRLS, or wildcard authorization.
- `[AC-E01]` WHEN an authorized actor assigns an eligible same-Company Member as Lead of a
  Division the Member does not belong to, the system SHALL create an active `division_leads`
  row and SHALL succeed.
- `[AC-E02]` WHEN a Member is assigned Lead of a second Division, the system SHALL retain the
  first active Lead row and the Member SHALL hold two active Lead rows.
- `[AC-E03]` WHEN a Division that already has an active Lead receives a new Lead, the system
  SHALL set `revokedAt` on the incumbent row and insert the new row in one transaction.
- `[AC-E04]` WHEN leadership is revoked, the system SHALL set `revokedAt` and SHALL NOT delete
  the row.
- `[AC-S01]` WHILE an actor holds active Lead rows for Divisions A and B, Member and Team
  operations scoped to either A or B SHALL be permitted, and operations scoped to Division C
  SHALL be denied.
- `[AC-S02]` WHILE an actor holds the `division_lead` role with **no** active Lead row, every
  Division-scoped operation SHALL be denied.
- `[AC-W01]` IF the target Member has no linked User, THEN assignment SHALL fail with 409 and
  SHALL create no row, UserRole, or ActorProfile.
- `[AC-W02]` IF a Member previously revoked from a Division is re-assigned to it, THEN the
  assignment SHALL succeed and SHALL create a new active row.
- `[AC-W03]` IF a Division has any `division_leads` row, THEN Division hard-delete SHALL
  return 409 and retain all rows.

## 6. Out of Scope

No `Division.leadMemberId` column. No Team Lead or `division_head` multiplicity change. No
DivisionType, lifecycle, or workflow-routing work. No Work Request assignment derived from
lead sets. No new ActorRoleCode value. No seed data. This specification authorizes no schema,
migration, RLS-policy, or grant change by itself — see `DATA_CONTRACT.md`
§ Proposed schema change, which requires explicit owner approval before any task here is
implemented.
