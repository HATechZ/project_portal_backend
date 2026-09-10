# SPEC: 04.1 — Division

**Status:** Gate 3 · approved target · not implemented  
**Tables owned:** `divisions` (organizational CRUD); consumes global `division_types`  
**Dependencies:** `04-organization` Company contract; precedes `04.2-member` and `04.3-team`

## 1. Overview & Business Intent

Division is a Tenant Company organizational record. It is not a User, credential,
email/password, or login identity. This module delivers guarded Division CRUD and a system-admin
business operation to assign an eligible Member as Division Lead through the existing
UserRole/ActorProfile/Member identity bridge. It must not encode division names, abbreviations,
seed IDs, fixed teams, or workflow meaning.

## Current backend, approved target, and deferred matters

**Current backend:** Company/CompanyType is the implemented Organization slice; no Division
feature module, route, or implementation exists. The current database model is structural truth.
**Approved target:** the CRUD, scope, and guarded deletion rules in this contract. **Not
implemented:** every task in `tasks.md`. **Deferred:** DivisionType values/mappings, lifecycle
activation APIs, workflow behavior, and any schema/grant/RLS alteration.

## 2. User Stories

- **US-01:** As a same-Company `system_admin`, I want to create, list, view, edit, and guardedly
  delete Divisions so the Company structure remains accurate.
- **US-02:** As an authorized caller, I want foreign-Tenant Division IDs to be invisible so a
  Tenant cannot discover or alter another Company's organization.

## 3. Domain Rules

| # | Rule | Enforced by |
|---|---|---|
| DR-01 | A Division belongs to the authenticated Tenant and its single Company; neither value is caller input. | JWT Tenant context, scoped Company lookup, RLS, repository input shape |
| DR-02 | Division has no login or person identity and create never creates a User, Member, ActorProfile, lead, or Team. | DTO/service boundary |
| DR-03 | Only a same-Company `system_admin` with configured `ADD_DIVISION` permission may perform Division CRUD. `division_lead` and a contextual Team Lead have no Division-management bypass. | guards, permission and object-scope checks |
| DR-04 | `name`, `abbr`, and nullable `divisionTypeId` are the only mutable business fields; Tenant, Company, ID, `isActive`, timestamps, and system fields are immutable. | DTO/repository allow-list |
| DR-05 | `(tenantId, companyId, abbr)` is unique. `divisionTypeId`, if supplied, must identify a global existing DivisionType. | DTO/service precheck; database backstop |
| DR-06 | Delete is a guarded hard delete only. It must refuse when any current Division relation has a dependent business/history row and must never cascade-delete such rows. | dependency probe, restrictive FKs, centralized error mapping |
| DR-07 | `isActive` is structurally retained but this module exposes no deactivate/reactivate API or behavior. | API/DTO exclusion |
| DR-08 | Assigning Division Lead is an orchestration over `User -> division_lead UserRole -> ActorProfile -> Member -> Division`; it creates no Division field/table/role/User/password/session and does not revoke other leads because singular cardinality is not established. | Division Lead repository orchestration |

## 4. Failure Modes

| Condition | HTTP | `AppErrorCode` |
|---|---:|---|
| Malformed UUID, unknown body field, null immutable field, invalid name/abbr | 400 | `BAD_REQUEST` / `VALIDATION_FAILED` |
| Missing or foreign Division | 404 | `NOT_FOUND` |
| Missing/invalid bearer or inactive auth context | 401 | `UNAUTHORIZED` |
| Authenticated caller lacks `ADD_DIVISION` or is not same-Company `system_admin` | 403 | `FORBIDDEN` |
| Duplicate Tenant/Company abbreviation; referenced type disappears; serialization conflict | 409 | centralized conflict mapping |
| Any dependent relation exists at delete time | 409 | `CONFLICT` |

## 5. EARS Acceptance Criteria

- `[AC-U01]` The module SHALL derive Tenant and Company ownership from verified server context and SHALL never accept caller-controlled ownership.
- `[AC-U02]` The module SHALL use the ordinary app_user Tenant UnitOfWork/RLS path; no app_relay, BYPASSRLS, broad grant, or wildcard authorization is allowed.
- `[AC-E01]` WHEN an eligible system administrator creates a valid Division, the system SHALL persist only the Division and return it in the platform envelope.
- `[AC-E02]` WHEN a Division is updated, the system SHALL modify only supplied approved business fields and `updatedAt`.
- `[AC-E03]` WHEN deletion is requested, the system SHALL inspect every current Prisma relation from Division and hard-delete only if none has a dependent row.
- `[AC-S01]` WHILE an ID belongs to another Tenant, list/detail/update/delete SHALL not expose it and direct access SHALL return the same 404 as absent data.
- `[AC-W01]` IF a caller attempts ownership, activation, identity, or workflow changes through a Division DTO, THEN validation SHALL reject it before a write.
- `[AC-W02]` IF a Division has Members, Teams, Projects by origin Division, or Work Requests by assigned/origin Division, THEN deletion SHALL return 409 and retain all rows.
- `[AC-E04]` WHEN system_admin assigns an eligible same-Division Member as Division Lead, the system SHALL ensure the existing `division_lead` UserRole and ActorProfile are linked to that Member.
- `[AC-W03]` IF the selected Member is missing User access or is outside the requested Division, THEN Division Lead assignment SHALL fail without creating User credentials or changing Division structure.

## 6. Out of Scope

No public activation lifecycle; no DivisionType value management or workflow mapping; no User
credential/session creation, Team, new lead table, new role, permission, or workflow routing
creation. Member is `04.2-member` and Team plus the existing membership relation is `04.3-team`.
TMS/classification questions are deferred. No schema, DBML, Prisma, migration, RLS-policy, grant,
seed, or database change is authorized by this specification.
