# Tasks: 01.1 — Schema Integrity & Tenant Isolation

**Status:** Gate 3 — spec written, nothing implemented
**Spec Reference:** `specs/01.1-schema-integrity/SPEC.md`
**Plan Reference:** `specs/01.1-schema-integrity/plan.md`

> Governed by [`specs/RULES.md`](../RULES.md) **[Article II](../rules/02-proof.md)** — every leaf task
> carries a `VERIFY:` line. A task is ticked **only** when its command exits 0. Run:
>
> ```bash
> yarn verify:sdd --module 01.1
> ```
>
> **Every task below is unticked and every assertion currently fails. That is correct.**
> [Art. IX](../rules/08-database.md) says an agent proposes a schema change and stops; a
> `VERIFY:` line asserting a column exists fails until the owner — or the `database-architect`
> subagent — applies it. Do not tick anything here on the strength of having written the
> migration.
>
> **Phases 6–12 are blocked on `plan.md` §1 P-1** (the DBML is deleted and the `HEAD` copy is
> stale). **Phase 9 is additionally blocked on P-2.** Phase 5 is application code only and is
> unblocked today.

---

- [ ] **Phase 5: Close the gaps that need no migration** (unblocked — start here)
  - [ ] Derive the tenant-scoped model set from the schema rather than trusting a hand-kept copy
        > 52 of 52 are in sync today. Nothing keeps them that way: add a model with a
        > `tenant_id`, forget the constants file, and it is silently unscoped with no error.
        VERIFY: test -f scripts/verify-tenant-scope.mjs && node scripts/verify-tenant-scope.mjs
  - [ ] Fail the build on drift rather than reporting it
        VERIFY: grep -q "verify-tenant-scope" package.json
  - [ ] Stop querying `tenants` on every request to check activation
        VERIFY: grep -qE "RedisService|REDIS_CLIENT" src/common/tenant/tenant-context.guard.ts
  - [ ] Keep the tenant guard off concrete persistence (Art. X layering law)
        VERIFY: ! grep -q "PrismaService" src/common/tenant/tenant-context.guard.ts
  - [ ] Teach the exception map the constraint names Phases 9–12 introduce
        VERIFY: grep -q "actor_profiles_kind_target" src/common/exceptions/prisma-exception.map.ts && grep -q "actor_profiles_one_default" src/common/exceptions/prisma-exception.map.ts

- [ ] **Phase 6: Row-level security** (blocked on P-1 · one migration, not several)
  - [ ] Declare the privileged connection across all four config files (Art. VI.6)
        VERIFY: grep -q "DATABASE_URL_PRIVILEGED" src/config/env.schema.ts && grep -q "DATABASE_URL_PRIVILEGED" src/config/configuration.ts && grep -q "DATABASE_URL_PRIVILEGED" src/config/env.ts && grep -q "DATABASE_URL_PRIVILEGED" .env.example
  - [ ] Give the cross-tenant relay its own connection and the app client none
        VERIFY: grep -qi "privileged" src/infra/prisma/prisma.service.ts && ! grep -qi "privileged" src/infra/prisma/tenant-prisma.extension.ts
  - [ ] Set the tenant GUC as the first statement of every unit of work
        VERIFY: grep -q "app.tenant_id" src/infra/prisma/unit-of-work.service.ts
  - [ ] Bind the GUC as a parameter rather than interpolating it into SQL
        VERIFY: grep -q "set_config" src/infra/prisma/unit-of-work.service.ts
  - [ ] Enable row-level security on every tenant-scoped table
        VERIFY: test $(grep -rho "ENABLE ROW LEVEL SECURITY" prisma/migrations/ | wc -l) -ge 52
  - [ ] Give every scoped table an isolation policy
        VERIFY: test $(grep -rho "CREATE POLICY tenant_isolation_" prisma/migrations/ | wc -l) -ge 52
  - [ ] Leave no policy that treats an unset tenant as permission to read everything
        > The `IS NULL OR` escape hatch turns every forgotten `SET LOCAL` into a silent
        > full-table read. `DATA_CONTRACT.md` §2.1 — the most important line in the module.
        VERIFY: test $(grep -rho "CREATE POLICY tenant_isolation_" prisma/migrations/ | wc -l) -ge 52 && ! grep -rq "app.tenant_id', true" prisma/migrations/
  - [ ] Separate the relay's privilege from the application role in the database
        VERIFY: grep -rq "BYPASSRLS" prisma/migrations/

- [ ] **Phase 7: Carry the tenant inside the foreign key** (blocked on P-1)
  - [ ] Give each guarded parent a tenant scope handle
        VERIFY: test $(tr -d '\n ' < prisma/schema.prisma | grep -o "@@unique(\[id,tenantId\])" | wc -l) -ge 5
  - [ ] Route the guarded chains through the pair rather than the id alone
        VERIFY: test $(tr -d '\n ' < prisma/schema.prisma | grep -o "references:\[id,tenantId\]" | wc -l) -ge 5
  - [ ] Let a document reach its project through its work request
        VERIFY: test $(tr -d '\n ' < prisma/schema.prisma | grep -o "@@unique(\[id,projectId\])" | wc -l) -ge 1

- [ ] **Phase 8: Drop what another table already knows** (blocked on P-1)
  - [ ] A member's company comes from their division
        VERIFY: test $(awk '/^model Member \{/,/^\}/' prisma/schema.prisma | grep -c "companyId") -eq 0
  - [ ] A team's company comes from its division
        VERIFY: test $(awk '/^model Team \{/,/^\}/' prisma/schema.prisma | grep -c "companyId") -eq 0
  - [ ] Bid details stop copying the project's name and code
        VERIFY: test $(awk '/^model BidDetail \{/,/^\}/' prisma/schema.prisma | grep -cE "projectName|projectCode") -eq 0
  - [ ] Folder locations stop caching an ancestry they do not own
        > Drop by default. If the owner keeps it as a materialized path, move it to
        > `DATA_CONTRACT.md` §5 and delete this task rather than ticking it.
        VERIFY: test $(awk '/^model DocumentVersionFolderLocation \{/,/^\}/' prisma/schema.prisma | grep -c "folderPath") -eq 0

- [ ] **Phase 9: Decompose `workflow_transitions`** (blocked on P-1 **and** P-2)
  - [ ] Make a transition unique per action and source status
        > The table has no unique constraint at all today. Two rows may claim the same action
        > from the same status leads to different statuses.
        VERIFY: test $(awk '/^model WorkflowTransition \{/,/^\}/' prisma/schema.prisma | tr -d '\n ' | grep -c "@@unique(\[tenantId,actionId,fromStatusId\])") -eq 1
  - [ ] Keep role eligibility in the permission table and nowhere else
        VERIFY: test $(awk '/^model WorkflowTransition \{/,/^\}/' prisma/schema.prisma | grep -c "fromRoleId") -eq 0

- [ ] **Phase 10: One home for a person** (blocked on P-1 · one migration, with backfill)
  - [ ] Separate the human from the login
        VERIFY: grep -q "^model Person {" prisma/schema.prisma && grep -q "^model UserAccount {" prisma/schema.prisma
  - [ ] Keep credentials off the identity record
        VERIFY: grep -q "^model Person {" prisma/schema.prisma && test $(awk '/^model Person \{/,/^\}/' prisma/schema.prisma | grep -c "passwordHash") -eq 0
  - [ ] Members stop carrying an identity they do not own
        VERIFY: test $(awk '/^model Member \{/,/^\}/' prisma/schema.prisma | grep -cE "^  (name|email|fullName)[[:space:]]") -eq 0
  - [ ] Client contacts stop carrying one either
        VERIFY: test $(awk '/^model ClientContact \{/,/^\}/' prisma/schema.prisma | grep -cE "^  (name|email|fullName)[[:space:]]") -eq 0
  - [ ] Model a member's tenure the way team membership already does
        VERIFY: test $(awk '/^model Member \{/,/^\}/' prisma/schema.prisma | grep -c "leftAt") -eq 1
  - [ ] Backfill people and accounts from the existing users
        VERIFY: grep -rlq "INSERT INTO people" prisma/migrations/
  - [ ] Retain the old table for one release rather than dropping it irreversibly
        VERIFY: grep -rq "users_legacy" prisma/migrations/

- [ ] **Phase 11: Type the actor union** (blocked on P-1 · after Phase 10)
  - [ ] Say which kind of actor the row is instead of implying it from nulls
        VERIFY: grep -q "enum ActorKind" prisma/schema.prisma && test $(awk '/^model ActorProfile \{/,/^\}/' prisma/schema.prisma | grep -cE "^  kind[[:space:]]") -eq 1
  - [ ] Make exactly one target enforceable
        VERIFY: grep -rq "actor_profiles_kind_target" prisma/migrations/
  - [ ] Allow a person only one default profile
        VERIFY: grep -rq "actor_profiles_one_default" prisma/migrations/
  - [ ] Derive the display label rather than freezing a stale copy
        VERIFY: test $(awk '/^model ActorProfile \{/,/^\}/' prisma/schema.prisma | grep -cE "^  label[[:space:]]") -eq 0

- [ ] **Phase 12: Lookup collapse and hygiene** (blocked on P-1)
  - [ ] Collapse the lookup tables that hold nothing but an enum and a name
        VERIFY: test $(grep -cE "^model (WorkspaceType|AttachmentSourceType|AttachmentFileGroup|DecisionResult|InfoRequestStatus) \{" prisma/schema.prisma) -eq 0
  - [ ] Correct the misspelled priority model
        VERIFY: ! grep -q "^model WorkPrioritie {" prisma/schema.prisma && grep -q "^model WorkPriority {" prisma/schema.prisma
  - [ ] Make every `updated_at` column actually update
        VERIFY: test $(grep -cE "^[[:space:]]+updatedAt[[:space:]]+DateTime" prisma/schema.prisma) -eq $(grep -c "@updatedAt" prisma/schema.prisma)
  - [ ] Move extracted document text off the row every list query reads
        VERIFY: test $(awk '/^model DocumentVersion \{/,/^\}/' prisma/schema.prisma | grep -c "textContent") -eq 0
  - [ ] Let a soft-deleted work request release its code
        VERIFY: grep -rq "deleted_at IS NULL" prisma/migrations/

- [ ] **Phase 13: Gate 4 close-out**
  - [ ] Lint and build clean
        VERIFY: yarn lint && yarn build
  - [ ] Every schema change proposed before it was applied (Art. IX)
        VERIFY: grep -q "^## 2. Proposed schema change" specs/01.1-schema-integrity/DATA_CONTRACT.md
  - [ ] The module is visible on the only status surface (Art. VII)
        VERIFY: grep -q "01.1-schema-integrity" specs/INDEX.md
  - [ ] The tenant boundary is asserted, not assumed
        VERIFY: node scripts/verify-tenant-scope.mjs && test $(grep -rho "CREATE POLICY tenant_isolation_" prisma/migrations/ | wc -l) -ge 52
