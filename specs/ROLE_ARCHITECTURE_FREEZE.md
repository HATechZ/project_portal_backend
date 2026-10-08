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

## 2026-10-07 protected starter-role decision

This decision supersedes the preceding statement that role assignment is separate from normal
Member creation only to the extent stated here. `tenant_super_admin` remains the sole SystemRole
and is a Tenant/Company-local administrator, never a platform or cross-tenant administrator.

Every Company/Tenant provisioning transaction MUST create or idempotently ensure exactly three
active, protected, tenant-owned normal `Role` records: `Staff` (`customCode: staff`,
`customScope: member`), `Supervisor` (`supervisor`, `team`), and `Manager` (`manager`,
`division`). They are not `SystemRole` rows and their names/codes never authorize an operation.
They are reusable access bundles, optional in business use, independent of workflow routing, and
safe with no assigned users. Tenant-created roles may use other valid names; creation/update must
reserve these three codes so an ordinary role cannot impersonate them. A pre-existing conflicting
reserved code is an integrity collision: do not overwrite or duplicate it; fail/reconcile it
explicitly in the later forward implementation.

The protected identity, not a hidden permission set, prevents normal deletion, retirement, or
identity/scope change. Existing/future normal role lifecycle operations must reject such changes.
Compatible `RolePermission` grants remain normally editable by a tenant_super_admin; removing all
Staff grants does not revoke its identity or make onboarding fail.

Normal `POST /member` remains request-clean and atomically performs: User creation/linking,
Member creation, same-Tenant Staff resolution, idempotent Staff `UserRole`, and reusable
Member-backed `ActorProfile` creation. It sends and accepts no role/profile/grant identifier,
does not infer a role from organization data, and creates no Supervisor/Manager grant, Team
membership/leadership, Division leadership, or workflow responsibility. Later role assignment
does not remove Staff. The existing profile/default rule is retained: preserve an eligible default;
otherwise the ensured Staff profile becomes default.

Existing Tenants require a later forward, idempotent reconciliation that ensures one valid starter
role and its initial grants without deleting custom roles, resetting grants, or changing historical
migrations. Existing-Member Staff backfill is deliberately separate and is not required for this
decision.

### Authorization-hardening prerequisite

The stated Staff, Supervisor, and Manager bundles are approved **target** bundles, not permission
grants enabled by the current runtime. A starter permission MUST NOT be automatically provisioned
until its protected path proves tenant isolation, compatible role scope, applicable resource or
business relationship, actor assignment/responsibility where required, and workflow state where
required. Scope compatibility alone never supplies object visibility. A generic `VIEW` permission
must not expose every Tenant resource to a member/team/division scoped actor.

Implementation is ordered: **Phase A** hardens feature-owned read visibility and Work Request
assignment/review/info checks with focused security tests, and provisions no starter roles or
grants. **Phase B**, only after Phase A passes, reserves/protects starter identities, provisions
verified-safe target grants and Roles, enables Staff onboarding, reconciles existing Tenants, and
corrects the RoleOption Swagger scope enum. Do not use role names/customCodes as authorization
checks or weaken resource rules to enable a grant. Catalogue entries without a protected runtime
path are not operational starter grants. Existing Members are not automatically backfilled.

## 2026-10-07 internal resource visibility and responsibility freeze

Scope is a compatibility tier plus a feature-owned operational boundary: company scope may access
permitted Company resources; division scope only resources related to the actor's valid Division
responsibility; team scope only resources related to the actor's valid Team responsibility; and
member scope only resources directly related or assigned to that Member. Scope compatibility never
creates object access, and no role name/customCode is authorization evidence.

`VIEW_MEMBERS`, `VIEW_DESIGNATIONS`, `VIEW_DOCUMENT_CODES`, and `VIEW_DIVISIONS` are explicit
Company-wide internal directory/reference reads when the actor holds the permission. Responses must
remain safe directory/reference projections and exclude credentials, security/access internals, and
private HR data. `VIEW_CLIENTS` similarly permits only active Company Client business records;
deactivated/administrative Client views and all external ClientContact behavior remain separately
restricted.

Work Request visibility uses one predicate for list, detail, history, and related reads: company
scope sees Company requests; division scope sees requests with a current active Division assignment
for a Division the actor actively leads; team scope sees requests with a current active Team
assignment whose Team has the actor as `leadMemberId`; member scope sees requests with that exact
active Member assignment. There is no same-Tenant fallback. Bid/Project visibility is Company-wide
for Company scope; lower scopes require visibility to at least one related Work Request. Documents
inherit the same predicate from their Bid, Project, or Work Request parent, including versions.

Team visibility is Company-wide for Company scope, active-lead-Division Teams for Division scope,
active-led Teams for Team scope, and active TeamMember Teams for Member scope. These relationships,
not a role label, are the evidence.

Work Request routing is neutral business responsibility: assigning a Division requires Company
scope authority and a valid state; assigning a Team requires an active Division assignment and an
actor who is its active `DivisionLead`; assigning a Member requires an active Team assignment and
an actor equal to that Team's `leadMemberId`. Submission requires the exact active assigned Member.
Team review/revision requires the active Team assignment and its `leadMemberId`; Division
review/revision requires the active Division assignment and its `DivisionLead`; all require the
applicable permission and state. `REQUEST_INFO` requires a valid request visibility/responsibility
relationship, an active non-terminal state, and the existing valid target rule. Response retains
the valid-target/open-request/resource rule.
