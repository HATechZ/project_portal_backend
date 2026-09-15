# Data Contract: 04.1.1 — Division Lead Multiplicity

## Tables and structural truth

| Table / Prisma model | Fields and constraints this module binds to |
|---|---|
| `division_leads` / `DivisionLead` | **Proposed, does not exist.** See § Proposed schema change. |
| `divisions` / `Division` | Consumed unchanged. Binds to `@@unique([id, tenantId, companyId])` (schema.prisma:548) as the composite FK target. Gains one inverse relation; no column change. |
| `members` / `Member` | Consumed unchanged. Binds to `@@unique([id, tenantId])` (schema.prisma:579) as the composite FK target, and reads `userId` for the User-access precheck. Gains one inverse relation; no column change. |
| `user_roles` / `UserRole` | Consumed unchanged. The `division_lead` grant stays User-level and Division-agnostic (SPEC DR-08). |
| `actor_profiles` / `ActorProfile` | Consumed unchanged via the existing `ensureUserRoleAndRoleOnlyProfile` / `linkMemberUserActorProfile` orchestration. |

Enums consumed: `actor_role_code` (`ActorRoleCode.division_lead`) — no new value.

The repository's authoritative DBML file is absent from this working tree, so these names and
relations are read from `prisma/schema.prisma` per [Art. IX](../rules/08-database.md). Art. IX
also establishes the Prisma schema as the maintained authority; no DBML round-trip is required
or permitted for this change.

## Proposed schema change

**Not applied. Requires explicit owner approval before any task in `tasks.md` is implemented.**

### New table `division_leads`

| Column | Type | Null | Notes |
|---|---|---|---|
| `tenant_id` | `uuid` | no | Tenant carrier; RLS subject |
| `id` | `uuid` | no | PK, generated in application code per repository convention |
| `company_id` | `uuid` | no | Carried so the FK to `divisions` can be composite and Company-checked |
| `division_id` | `uuid` | no | The led Division |
| `member_id` | `uuid` | no | The leading Member |
| `assigned_at` | `timestamp(6)` | no | `DEFAULT now()` |
| `assigned_by_user_id` | `uuid` | no | Audit: who granted |
| `revoked_at` | `timestamp(6)` | **yes** | `NULL` = active. Revocation sets this; rows are never deleted |
| `revoked_by_user_id` | `uuid` | yes | Audit: who revoked |

Proposed Prisma model:

```prisma
model DivisionLead {
  tenantId         String    @db.Uuid @map("tenant_id")
  id               String    @id @db.Uuid @map("id")
  companyId        String    @db.Uuid @map("company_id")
  divisionId       String    @db.Uuid @map("division_id")
  memberId         String    @db.Uuid @map("member_id")
  assignedAt       DateTime  @default(now()) @db.Timestamp(6) @map("assigned_at")
  assignedByUserId String    @db.Uuid @map("assigned_by_user_id")
  revokedAt        DateTime? @db.Timestamp(6) @map("revoked_at")
  revokedByUserId  String?   @db.Uuid @map("revoked_by_user_id")

  tenant   Tenant   @relation(fields: [tenantId], references: [id], onDelete: Restrict)
  division Division @relation("DivisionLeadsDivisionIdDivisions",
                              fields: [divisionId, tenantId, companyId],
                              references: [id, tenantId, companyId])
  member   Member   @relation("DivisionLeadsMemberIdMembers",
                              fields: [memberId, tenantId],
                              references: [id, tenantId])

  @@unique([id, tenantId])
  @@index([tenantId])
  @@index([tenantId, memberId, revokedAt])
  @@index([tenantId, divisionId, revokedAt])
  @@map("division_leads")
}
```

Inverse relations to add — **three**, no columns change on any side:

- `Division.divisionLeadsByDivisionId DivisionLead[] @relation("DivisionLeadsDivisionIdDivisions")`
- `Member.divisionLeadsByMemberId     DivisionLead[] @relation("DivisionLeadsMemberIdMembers")`
- `Tenant.divisionLeads               DivisionLead[]`

The `Tenant` back-relation was omitted from the first draft of this contract. Prisma requires
a back-relation for the `tenant` FK and `prisma validate` fails without it; corrected
2026-09-15 during the schema edit.

### Tenant-scoping registration — not optional

`DivisionLead` must be added to `TENANT_SCOPED_MODELS` in
`src/common/tenant/tenant.constants.ts`. This is not merely a build gate
(`scripts/verify-tenant-scope.mjs`): `tenant-prisma.extension.ts:70` returns
`query(args)` **unfiltered** for any model absent from that set, so an unregistered
`division_leads` would bypass application-layer tenant scoping entirely and rely on Postgres
RLS alone. Registered 2026-09-15.

### Partial unique indexes — raw SQL, not expressible in Prisma

Prisma's `@@unique` has no predicate, so both constraints must be added as raw SQL in the
migration body. **This is the correctness core of the change** and must not be downgraded to a
plain `@@unique`:

```sql
-- DR-03: at most one active Lead per Division
CREATE UNIQUE INDEX "division_leads_one_active_per_division"
  ON "division_leads" ("tenant_id", "division_id")
  WHERE "revoked_at" IS NULL;

-- DR-07: the same Member is not active twice on one Division,
-- while still permitting re-assignment after revocation
CREATE UNIQUE INDEX "division_leads_active_pair"
  ON "division_leads" ("tenant_id", "division_id", "member_id")
  WHERE "revoked_at" IS NULL;
```

A **non-partial** `UNIQUE (tenant_id, division_id, member_id)` — the shape first sketched
informally — is rejected: it would permanently bar re-assigning a Member to a Division it had
previously led, because revoked history rows would collide with the new active row. Both
indexes must carry `WHERE revoked_at IS NULL`.

### RLS and grants

`division_leads` must join the existing tenant RLS regime established by
`20260901000000_enable_tenant_rls` — enable row level security, add the `app.tenant_id` GUC
policy in the same form as its sibling tables, and grant `app_user` `SELECT, INSERT, UPDATE`
(no `DELETE`; DR-06 forbids deletion). Follow the grant pattern in
`20260910142000_app_user_organization_module_grants`.

### What breaks without it

Without this table there is no place to record a second Division for one Member.
`Member.divisionId` is a single non-nullable column, so multi-Division leadership is
unrepresentable and SPEC US-01/US-02 cannot be met at all.

### To apply

```text
Needs: division_leads table, two partial unique indexes, RLS policy, app_user grants.
Proposed in specs/04.1.1-division-lead-multiplicity/DATA_CONTRACT.md — Proposed schema change.
To apply — delegate to the database-architect subagent, which updates
prisma/schema.prisma and prepares the migration, then:
  yarn prisma:migrate --name division_lead_multiplicity
```

No task in this module may be ticked until the owner confirms the migration is applied. The
`VERIFY:` lines asserting these columns will fail until then; that is correct
([Art. II](../rules/02-proof.md)).

## Reads, writes, and isolation

All access goes through the ordinary app_user fail-closed Tenant UnitOfWork. No `app_relay`,
no `BYPASSRLS`, no raw client. `tenantId` derives from `RequestContext.requireTenantId()`;
`companyId` from the scoped Company resolution already used by `04.1`.

**Assign** runs in one `Serializable` transaction — matching the isolation the existing
`DivisionLeadRepository.assign` already uses:

1. Resolve the Division by `(id, tenantId, companyId)`; 404 if absent.
2. Resolve the Member by `(id, tenantId, companyId)` and `isActive`; 404 if absent.
   **The Member's `divisionId` is not compared to the target Division** (SPEC DR-04).
3. 409 if `member.userId` is null.
4. If an active row already exists for `(tenantId, divisionId, memberId)`, return it
   unchanged — idempotent no-op.
5. Otherwise set `revokedAt = now()`, `revokedByUserId` on any active row for
   `(tenantId, divisionId)` — the incumbent (SPEC DR-03).
6. Insert the new active row with an application-generated UUID.
7. Idempotently ensure the `division_lead` UserRole and role-only ActorProfile, then link the
   profile to the Member — the existing `ensureUserRoleAndRoleOnlyProfile` /
   `linkMemberUserActorProfile` calls, unchanged.

**Revoke** sets `revokedAt` and `revokedByUserId` on the matching active row; 404 if none.
It does **not** revoke the `division_lead` UserRole, because the Member may still lead other
Divisions. Whether to revoke the User-level role once a Member's last active Lead row is
revoked is deferred and deliberately left out of scope.

No write accepts or changes `id`, `tenantId`, `companyId`, `assignedAt`, or any relation.
Constraint violations map through the shared Prisma exception filter; no service catches a
Prisma error (non-negotiable #5).

## Derived state

"Who leads Division D" and "which Divisions does Member M lead" are **derived by query**
over `division_leads WHERE revoked_at IS NULL`. Neither is stored on `Division` or `Member`.
This follows the same principle as non-negotiable #7 and the revoke-by-timestamp rule
(non-negotiable #9).

## Relations and deletion audit

`Division` gains a sixth dependent relation. The `04.1` delete probe
(`DATA_CONTRACT.md` § Relations and deletion audit) currently inspects five inverse relations;
it must inspect `divisionLeadsByDivisionId` as well, and block hard deletion when any row
exists — active or revoked, since revoked rows are retained history (SPEC DR-11).

`Member` gains a dependent relation likewise. Any Member-deletion guard in `04.2-member` must
probe `divisionLeadsByMemberId` before removal. Both FKs are `Restrict` by default and act as
the race backstop; no cascade is permitted.

## Session projection impact

`sessionActorSelect` (`src/common/security/session.types.ts:47`) currently projects
`member.divisionId` and nothing about leadership. It must additionally project the actor's
active Lead rows:

```ts
member: {
  select: {
    // …existing fields…
    divisionLeadsByMemberId: {
      where: { revokedAt: null, tenantId },
      select: { divisionId: true },
    },
  },
}
```

This keeps scope resolution a pure read of the already-loaded session actor and avoids a
per-request query in the scope providers. The `where` clause must carry both `revokedAt: null`
and `tenantId`, matching the existing `userRolesByUserId` projection convention.

## Authorization chokepoints — corrected inventory

An informal reading named `object-scope.provider.ts:178` as *the* chokepoint. That is
inaccurate and implementing it alone would change no observable behavior:

> `ObjectScopeRequirement`'s `{ kind: 'memberDivision' }` variant is **declared but never
> constructed**. `grep -rn "kind: 'memberDivision'" src` returns only the type definition and
> the `matches` branch. The only callers of `canAccess` in the repository are in
> `object-scope.client.spec.ts`. The Division branch of `ObjectScopeProvider` is currently
> dead code.

The chokepoints that actually decide Division scope today are all single-valued, and **all**
must move to set membership:

| # | Location | Current single-value logic |
|---|---|---|
| CP-1 | `member-scope.provider.ts:49` `resolveActorDivisionId()` | returns one `string` |
| CP-2 | `member-scope.provider.ts:24` | `requestedDivisionId !== divisionId` |
| CP-3 | `member-scope.provider.ts:38` | `actorDivisionId !== divisionId` |
| CP-4 | `team-scope.provider.ts:28` `requireActorDivision()` | returns `actor.member.divisionId` |
| CP-5 | `team-scope.provider.ts:56` `assertCanManageMembership()` | `actor.member?.divisionId === team.divisionId` |
| CP-6 | `object-scope.provider.ts:178` | `member.divisionId === requirement.divisionId` — dead, but fixed for consistency |

CP-1 and CP-4 become `resolveActorDivisionIds(): string[]`, returning the active lead set.
CP-2, CP-3, CP-5 and CP-6 become `.includes(...)` set-membership tests. An actor holding the
`division_lead` role with an empty lead set must be denied, not defaulted to its home Division
(SPEC AC-S02) — the current code would silently fall back to `member.divisionId`, which is the
precise over-grant this module removes.

`member-scope.provider.ts:59-66` additionally resolves a Team-Lead fallback through
`findLedTeamDivisionId`. That path is unrelated to Division leadership and is left unchanged;
it must keep working alongside the new lead set.
