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

## Proposed schema change

**Not applied. Requires explicit owner approval.** Full specification:
[`../04.1.1-division-lead-multiplicity/DATA_CONTRACT.md`](../04.1.1-division-lead-multiplicity/DATA_CONTRACT.md).

`Member.divisionId` is a single non-nullable column, so the orchestration described above can
only ever make a Member the Lead of its own one Division. Module `04.1.1` proposes a new
`division_leads` join table — `tenantId`, `id`, `companyId`, `divisionId`, `memberId`,
`assignedAt`, `assignedByUserId`, nullable `revokedAt`, nullable `revokedByUserId` — with
tenant-carrying composite FKs to `divisions (id, tenantId, companyId)` and
`members (id, tenantId)`, plus two **partial** unique indexes predicated on
`revoked_at IS NULL`, tenant RLS, and narrow app_user `SELECT, INSERT, UPDATE` grants (no
`DELETE`). No column is added to `divisions` or `members`, and `Division.leadMemberId` is not
introduced.

**Owner decision recorded 2026-09-15:** a Member may lead many Divisions; a Division has at
most one active Lead. This settles the cardinality question left open in § Division Lead
orchestration above — that section describes currently shipped behavior and is superseded by
`04.1.1` once the migration is applied. Assignment becomes incumbent-revoking rather than
purely additive.

Without this table, multi-Division leadership is unrepresentable. Two further impacts land on
this module: the delete dependency probe gains a sixth inverse relation
(`divisionLeadsByDivisionId`), and DR-08's "does not revoke other leads" no longer holds.

```text
Needs: division_leads table, two partial unique indexes, RLS policy, app_user grants.
Proposed in specs/04.1.1-division-lead-multiplicity/DATA_CONTRACT.md — Proposed schema change.
To apply — delegate to the database-architect subagent, then:
  yarn prisma:migrate --name division_lead_multiplicity
```

Runtime prerequisite discovered during Gate 5 attempt on 2026-09-09: app_user currently has
only `SELECT` on `public.divisions` and no reported grant on `public.division_types`. Valid
Division create/update/delete and global DivisionType prevalidation therefore cannot pass
HTTP verification until the owner grants the narrow app_user privileges required by this
contract. No schema/grant/RLS change was applied by this implementation.
