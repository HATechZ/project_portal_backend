# Data Contract: 04.1 — Division

## Tables and structural truth

| Table / Prisma model | Fields and constraints this module binds to |
|---|---|
| `divisions` / `Division` | `tenantId`, UUID `id`, `companyId`, `name varchar(180)`, `abbr varchar(30)`, nullable `divisionTypeId`, retained `isActive`, `createdAt`, `updatedAt`; unique `(id,tenantId)`, `(id,tenantId,companyId)`, `(tenantId,companyId,abbr)`; index `(companyId,name)`. |
| `division_types` / `DivisionType` | Global reference: UUID `id`, globally unique `name`, nullable `description`. This module consumes but does not create/manage values. |

The repository's authoritative DBML file is absent from this working tree. These exact names and
relations are therefore read from the current Prisma schema; an implementer must recheck the
DBML if it is restored, without changing either source under this spec.

## Relations and deletion audit

`Division.tenant` is restrictive. `Division.company` references Company. Its current inverse
relations are `membersByDivisionId`, `teamsByDivisionId`, `projectsByOriginDivisionId`,
`workRequestsByAssignedDivisionId`, and `workRequestsByOriginDivisionId`.

Before `delete`, the repository/service must probe all five inverse relations in the same
Tenant UnitOfWork (existence queries are sufficient): Members, Teams, Projects where the
Division is origin, Work Requests where assigned, and Work Requests where origin. A nonzero
result blocks hard deletion with the repository's ordinary conflict convention. Prisma schema
relations and restrictive/current FKs remain the race backstop; no cascade operation or cleanup
of dependents is permitted.

## Writes, isolation, and mutation shape

Create derives `tenantId` from `RequestContext` and `companyId` by resolving the one scoped
Company. It generates the UUID in the application per repository convention. Create accepts
`name`, `abbr`, and optional `divisionTypeId`; update accepts the same partial allow-list with
at least one supplied. Strings are trimmed, `name` is 1–180 and `abbr` 1–30; `divisionTypeId`
is a nullable existing global reference only when explicitly supported by the DTO. The target
specification preserves the current nullable field; it does not require callers to supply it.

No write accepts or changes `id`, `tenantId`, `companyId`, `isActive`, timestamps, or any
relation. Use app_user through the fail-closed UnitOfWork and existing RLS; do not use app_relay.
Existing constraints map through the shared Prisma exception filter.

## Division Lead orchestration

`PUT /division/:id/lead` is a business orchestration over the existing identity model, not a new
Division relationship:

`User -> division_lead UserRole -> ActorProfile -> Member -> Division`.

The operation validates the requested Division under the authenticated Tenant/Company, validates
an active Member in that exact Division, requires the Member to already have same-Tenant User
access, idempotently ensures the existing `division_lead` UserRole and role-only ActorProfile,
then links that ActorProfile to the Member. It does not write `Division.leadMemberId`, create a
new table, create User/password/session state, revoke other Division Leads, or invent a new role.
The current approved model does not define singular Division Lead cardinality, so assignment is
additive/safe and does not remove another lead.

`division_head` is an ActorRole, not a Division row relationship. It is Company-scoped across
all current and future Divisions in the actor's own Company for configured Division-operation
oversight and later Work Request routing. `division_head` may create/provision or assign
`division_lead` only for a Division inside the same Company, using normal Member onboarding
for new leadership users and validating object scope at assignment time. This contract does
not add a Division-head FK, table, column, seed, or grant, and it does not decide whether
`division_head` may create, update, or delete Division master records.

Runtime prerequisite discovered during Gate 5 attempt on 2026-09-09: app_user currently has
only `SELECT` on `public.divisions` and no reported grant on `public.division_types`. Valid
Division create/update/delete and global DivisionType prevalidation therefore cannot pass
HTTP verification until the owner grants the narrow app_user privileges required by this
contract. No schema/grant/RLS change was applied by this implementation.
