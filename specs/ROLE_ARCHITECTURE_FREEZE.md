# Role & Permission Architecture Freeze — 2026-10-06

**Status:** AUTHORITATIVE — owner decision. This document supersedes every conflicting role, permission, scope, provisioning, workflow, API, data-contract, plan, task, and walkthrough statement elsewhere in `specs/`. Superseded material remains as historical implementation/migration context; it is not an approved target for new work.

## Ownership boundary

| System-defined | Tenant-defined |
|---|---|
| `tenant_super_admin` (the sole predefined/system role) | custom roles |
| permission catalogue | custom role names and descriptions |
| scope catalogue: `company`, `division`, `team`, `member`, `client`, `client_contact` | permission combinations on a custom role |
| workflow states | UserRole assignments |
| workflow and business-assignment rules | |

The permission catalogue and scope catalogue are system-owned. A tenant cannot create a permission code, scope type, workflow state, or workflow/business-assignment rule.

## Canonical model

Each Company signup remains one atomic provisioning flow:

`Company signup → unique Tenant → Company → initial User → tenant_super_admin UserRole → default ActorProfile → permission bootstrap → workspace ready`.

Each Company owns exactly one Tenant and each Tenant owns exactly one Company. Tenant UUID and identity/slug are globally unique. All tenant data, authorization reads, RLS policies, and object-resolution queries remain Tenant-isolated; caller-supplied tenant identifiers never grant authority. `User`, `Member`, and `ActorProfile` remain separate concepts. Role assignment is separate from Member creation. Company, Division, Team, TeamMembership, and Member remain in the organization model; do not add `Member.teamId`.

After provisioning, the tenant's `tenant_super_admin` creates tenant-owned custom roles with a name, description, one selected system scope, and any applicable permissions from the system catalogue. A custom role name has no authorization meaning. It must never be used as a proxy for a workflow stage or business responsibility.

## Permission and authorization rules

The exhaustive authoritative old-to-new capability matrix, compatibility-proof rule, and
permission naming policy are in
[`PERMISSION_CATALOGUE_GLOBALIZATION.md`](PERMISSION_CATALOGUE_GLOBALIZATION.md). It
supersedes any conflicting fixed-role permission matrix or legacy permission name in this
document or any module contract.

`tenant_super_admin` automatically receives explicit grants for every permission that exists in the system catalogue **except** `DECIDE_BID_OUTCOME`. It does not receive or maintain grants through a manual self-service role-permission mutation, and it has no wildcard/superuser authorization bypass. `DECIDE_BID_OUTCOME` remains in the catalogue and may be granted by a tenant super admin to a tenant-created custom role.

Every protected operation evaluates all applicable terms:

`explicit permission + same tenant + permission/scope compatibility + actual resource/business rule + applicable assignment/ownership + applicable workflow state = allowed`.

Scope is a system-defined compatibility tier, not a resource boundary. A `division`, `team`,
`member`, `client`, or `client_contact` scope does not by itself restrict access to a matching
object. Such a boundary exists only when the owning resource/business rule explicitly requires it.
The final per-permission
compatibility matrix, atomic catalogue, category rules, lifecycle semantics, and selector contract
are authoritative in [`PERMISSION_CATALOGUE_GLOBALIZATION.md`](PERMISSION_CATALOGUE_GLOBALIZATION.md).

Permission alone is insufficient. A role name alone is insufficient. This applies equally to Tenant Super Admin: explicit grant is necessary but never replaces same-tenant, object/scope, assignment, or state checks.

Division lead, Team lead, Work Request Division/Team/Member routing, and future TMS M1/M2/M3, CCR, and similar responsibilities are **business/workflow assignments**, not roles. Their assignment records and current workflow state are the authorization evidence for operations that require them. They must not be authorized by comparisons such as `role === "team_lead"`, `role === "division_head"`, or `role === "tms_drawing"`.

### Division Lead final rule

Division Lead is an Organization relationship between an eligible same-tenant Member and a
Division. It is never a predefined security role: assigning or revoking a Division Lead must not
create, assign, revoke, select, or provision a `division_lead` Role, UserRole, or ActorProfile.
The relationship is usable only as an explicit business condition where the owning feature says it
is needed. Access is separately granted through tenant-created custom roles and explicit final
permissions. The corresponding capabilities are `ASSIGN_DIVISION_LEAD`,
`REVOKE_DIVISION_LEAD`, and `VIEW_DIVISIONS`.

## Retired fixed-role architecture

The following previously predefined system/workflow roles are **RETIRED** for all future specification and implementation work: `division_head`, `division_lead`, `team_lead`, `division_member`, `ccr_coordinator`, `tms_manager`, `tms_drawing`, `tms_checking`, `tms_approval`, `client_owner`, and every other fixed tenant business/workflow role.

Historical migrations, generated enum values, runtime bridges, test fixtures, and old specs can retain
those names as history. Historical migration files are immutable evidence and must never be
rewritten or deleted. Current database rows, seeds, users, UserRoles, ActorProfiles, workflow
assignments, and related access records are **demo/test data**, not production legacy identities;
future implementation may clean, reset/reseed, replace, or recreate them under the final model.

## Contract normalization required before implementation

The present schema/API shape may still expose fixed roles, legacy custom scopes, role-based route guards, and fixed grant matrices. They are recorded as implementation debt, not a contrary product decision. The implementation design must:

- represent `tenant_super_admin` as the only system role and tenant-owned custom roles without giving arbitrary names authorization meaning;
- limit selectable scopes to `company`, `division`, `team`, `member`, `client`, and `client_contact`;
- keep permissions system-defined and make custom-role eligibility/applicability an explicit system policy, rather than allowing tenants to invent permissions;
- make role administration/role assignment itself an explicitly authorized, tenant-scoped operation; and
- replace fixed-role route guards, role-enum authorization branches, and fixed role-permission matrices with permission, selected scope, business/workflow assignment, and state checks.

No schema, migration, seed, source, or database change is authorized by this spec freeze.

## Module application

- **03 Identity & Access:** owns custom-role lifecycle, UserRole assignment/revocation, explicit catalogue grants, and ActorProfile compatibility. All prior fixed-role and legacy-scope text is superseded.
- **04 / 04.1 / 04.1.1 / 04.2 / 04.3:** preserve Company/Division/Team/Member modules. Division and Team leadership are business assignments and cannot create or imply security roles.
- **05 Clients and future CCR/TMS:** former client/CCR/TMS labels are business assignments or future workflow concepts, never predefined roles.
- **08 Bid / 09 Project / 10 Work Requests:** replace every fixed-role grant matrix and role-label authorization with the canonical authorization equation. Work Request state names may remain system workflow states; their old role-labelled names do not imply a role actor.
- **All API/data contracts:** an authorization column that lists old role names is historical and must be rewritten before implementation to name the required permission, tenant/object scope, business assignment, and state precondition.

## Implementation decision boundary

This freeze resolves the role architecture. It does not choose physical forward-change mechanics,
endpoint versioning, or the exact assignment tables/API for each future workflow. It explicitly
does **not** require per-user legacy privilege conversion, UserRole/ActorProfile migration,
equivalent-access calculation, or a demo-user compatibility layer. Future implementation may
recreate demo data with `tenant_super_admin`, tenant-created custom roles, explicit atomic
permissions, and approved scopes while preserving historical migration files/history.
