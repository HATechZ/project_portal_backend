# Data Contract: 04.3 - Team

## Tables and structural truth

| Table / Prisma model | Bound fields and constraints |
|---|---|
| `teams` / `Team` | Tenant ID, UUID ID, Company ID, Division ID, `name varchar(180)`, nullable `leadMemberId`, retained `isActive`, timestamps; unique `(tenantId,divisionId,name)` and composite Division relation `(divisionId,tenantId,companyId) -> divisions(id,tenantId,companyId)`. |
| `team_members` / `TeamMember` | Tenant ID, UUID ID, `teamId`, `memberId`, nullable `teamRole varchar(100)`, `joinedAt`, nullable `leftAt`; indexed `(teamId,memberId,leftAt)`. This is the Team-owned membership relation, not a separate module. |

`Team.leadMemberId` is a raw current Member relation; it does not structurally carry Tenant,
Company, or Division. Every lead write must explicitly load and validate an active same-Tenant,
Company, and Division Member before update. The `team_members` raw Team/Member relations likewise
require service validation of both records and `team_members.tenantId` before insert. Existing
Team/Member composite Division relationships and RLS remain database backstops.

`team_lead` is a real ActorRole, but the role is not enough for object access. The exact Team
scope is proven by active ActorProfile -> Member and `Team.leadMemberId` equality. A
`division_head` ActorRole is Company-scoped across all current and future Divisions in that
Company for configured Team operations, including deletion of any otherwise-deletable Team in
own-Company Divisions. `division_lead` may create/provision or assign `team_lead` only for a
Team inside that Division, and assignment must validate own-Division/target-Team scope at the
time of assignment.

## Writes and lifecycle

Create accepts `divisionId`, `name`, and optional `leadMemberId`; it derives Tenant/Company and
verifies scoped Division and optional lead eligibility. Generic update accepts `name` only. Lead
assignment is separate and accepts an eligible existing Member ID. Membership add accepts
`memberId` and optional trimmed `teamRole` (1-100 when present); the Member may have existed
before the request or may have been created by a prior separate Member operation. This Team route
never creates a Member and Member creation never inserts `team_members`. `joinedAt` is server time
and `leftAt` is never caller input. End membership updates the single active association's
`leftAt` in a transaction; it does not delete it. An active row means `leftAt IS NULL`; inserting
another active row for the same pair is rejected by application validation and concurrency-safe
recheck because current schema has an index, not a unique active-pair constraint.

Before Team delete, query all `team_members` rows regardless of `leftAt`; a row blocks deletion.
No membership history is cascaded. No write changes ownership, Division, activation, or
timestamps. Use app_user through normal fail-closed UnitOfWork/RLS; never app_relay. No schema,
grant, RLS, or migration change is proposed.
