# Tasks: 01.1 — Schema Integrity & Tenant Isolation

**Status:** Gate 4 — implementation in progress
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
> P-1 and P-2 were resolved by the owner on 2026-09-01. The `database-architect` reconstructs
> the authoritative DBML before schema changes. Unrelated destructive Phase 8–12 redesigns
> retain their own approval and verification gates.

---

- [ ] **Phase 5: Close the gaps that need no migration** (unblocked — start here)
  - [x] Derive the tenant-scoped model set from the schema rather than trusting a hand-kept copy
        > 52 of 52 are in sync today. Nothing keeps them that way: add a model with a
        > `tenant_id`, forget the constants file, and it is silently unscoped with no error.
        VERIFY: test -f scripts/verify-tenant-scope.mjs && node scripts/verify-tenant-scope.mjs
  - [x] Fail the build on drift rather than reporting it
        VERIFY: grep -q "verify-tenant-scope" package.json
  - [x] Stop querying `tenants` on every request to check activation
        VERIFY: grep -q "TenantActivationService" src/common/tenant/tenant-context.guard.ts && grep -q "RedisService" src/common/tenant/tenant-activation.service.ts
  - [x] Keep the tenant guard off concrete persistence (Art. X layering law)
        VERIFY: ! grep -q "PrismaService" src/common/tenant/tenant-context.guard.ts
  - [x] Teach the exception map the constraint names Phases 9–12 introduce
        VERIFY: grep -q "actor_profiles_kind_target" src/common/exceptions/prisma-exception.map.ts && grep -q "actor_profiles_one_default" src/common/exceptions/prisma-exception.map.ts

- [ ] **Phase 6: Row-level security** (one migration, not several)
  > **BLOCKED / DEFERRED (2026-09-01):** Database execution and database-dependent
  > verification are deferred solely because the separate administrative migration
  > credential is unavailable. The approved migration remains pending; prepared Phase 6
  > migration, rollback, RLS, runtime-role, and verification artifacts remain unchanged.
  - [x] Declare the privileged connection across all four config files (Art. VI.6)
        VERIFY: grep -q "DATABASE_URL_PRIVILEGED" src/config/env.schema.ts && grep -q "DATABASE_URL_PRIVILEGED" src/config/configuration.ts && grep -q "DATABASE_URL_PRIVILEGED" src/config/env.ts && grep -q "DATABASE_URL_PRIVILEGED" .env.example
  - [x] Give the cross-tenant relay its own connection and the app client none
        VERIFY: grep -qi "privileged" src/infra/prisma/prisma.service.ts && ! grep -qi "privileged" src/infra/prisma/tenant-prisma.extension.ts
  - [x] Refuse startup when runtime connections use an owner or the wrong RLS role
        VERIFY: grep -q "app_user" src/infra/prisma/prisma.service.ts && grep -q "app_relay" src/infra/prisma/prisma.service.ts && node node_modules/jest/bin/jest.js --runInBand database-role.assertion.spec.ts
  - [x] Set the tenant GUC as the first statement of every unit of work
        VERIFY: grep -q "app.tenant_id" src/infra/prisma/unit-of-work.service.ts
  - [x] Bind the GUC as a parameter rather than interpolating it into SQL
        VERIFY: grep -q "set_config" src/infra/prisma/unit-of-work.service.ts
  - [x] Route every repository operation through the tenant-setting unit of work
        VERIFY: test $(grep -rl "PrismaService" src --include='*.repository.ts' | wc -l) -eq 0 && test $(grep -rl "this\.db\." src --include='*.repository.ts' | wc -l) -eq 0
  - [x] Fail before querying when repository code has no active unit of work or tenant context
        VERIFY: grep -q "Repository access requires an active unit of work" src/infra/prisma/unit-of-work.service.ts && node node_modules/jest/bin/jest.js --runInBand unit-of-work.service.spec.ts
  - [ ] Enable row-level security on every tenant-scoped table and the tenant root
        VERIFY: test $(grep -rho "ENABLE ROW LEVEL SECURITY" prisma/migrations/ | wc -l) -ge 53
  - [ ] Give every scoped table and the tenant root an isolation policy
        VERIFY: test $(grep -rho "CREATE POLICY tenant_isolation_" prisma/migrations/ | wc -l) -ge 53
  - [ ] Leave no policy that treats an unset tenant as permission to read everything
        > The `IS NULL OR` escape hatch turns every forgotten `SET LOCAL` into a silent
        > full-table read. `DATA_CONTRACT.md` §2.1 — the most important line in the module.
        VERIFY: test $(grep -rho "CREATE POLICY tenant_isolation_" prisma/migrations/ | wc -l) -ge 53 && ! grep -rq "app.tenant_id', true" prisma/migrations/
  - [ ] Separate the relay's privilege from the application role in the database
        VERIFY: grep -rq "BYPASSRLS" prisma/migrations/

- [ ] **Phase 7: Carry the tenant inside the foreign key**
  - [ ] Give each guarded parent a tenant scope handle
        VERIFY: test $(tr -d '\n ' < prisma/schema.prisma | grep -o "@@unique(\[id,tenantId\])" | wc -l) -ge 5
  - [ ] Route the guarded chains through the pair rather than the id alone
        VERIFY: test $(tr -d '\n ' < prisma/schema.prisma | grep -o "references:\[id,tenantId\]" | wc -l) -ge 5
  - [ ] Let a document reach its project through its work request
        VERIFY: test $(tr -d '\n ' < prisma/schema.prisma | grep -o "@@unique(\[id,projectId\])" | wc -l) -ge 1

- [ ] **Phase 8: Drop what another table already knows** (destructive changes require their own approval)
  - [ ] A member's company comes from their division
        VERIFY: test $(awk '/^model Member \{/,/^\}/' prisma/schema.prisma | grep -c "companyId") -eq 0
  - [ ] A team's company comes from its division
        VERIFY: test $(awk '/^model Team \{/,/^\}/' prisma/schema.prisma | grep -c "companyId") -eq 0
  - [ ] Bid details stop copying the project's name and code
        VERIFY: test $(awk '/^model BidDetail \{/,/^\}/' prisma/schema.prisma | grep -cE "projectName|projectCode") -eq 0
  - [ ] Keep logical folder paths as a declared cache, separate from storage location
        > `document_folders.parent_folder_id` remains authoritative. Module 08 owns
        > synchronization/rebuild behavior after supported hierarchy changes.
        VERIFY: grep -q "folderPath" prisma/schema.prisma && grep -q "document_version_folder_locations.folder_path" specs/01.1-schema-integrity/DATA_CONTRACT.md && grep -q "storage_key" specs/01.1-schema-integrity/DATA_CONTRACT.md

- [ ] **Phase 9: Constrain `workflow_transitions`** (transition-level routing retained)
  - [ ] Make a transition unique per action and source status
        > The table has no unique constraint at all today. Two rows may claim the same action
        > from the same status leads to different statuses.
        VERIFY: test $(awk '/^model WorkflowTransition \{/,/^\}/' prisma/schema.prisma | tr -d '\n ' | grep -c "@@unique(\[tenantId,actionId,fromStatusId\])") -eq 1
  - [ ] Keep role eligibility in the permission table and nowhere else
        VERIFY: test $(awk '/^model WorkflowTransition \{/,/^\}/' prisma/schema.prisma | grep -c "fromRoleId") -eq 0

- [ ] **Phase 10: One home for a person** (destructive; separate approval required)
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

- [ ] **Phase 11: Type the actor union** (destructive; separate approval required · after Phase 10)
  - [ ] Say which kind of actor the row is instead of implying it from nulls
        VERIFY: grep -q "enum ActorKind" prisma/schema.prisma && test $(awk '/^model ActorProfile \{/,/^\}/' prisma/schema.prisma | grep -cE "^  kind[[:space:]]") -eq 1
  - [ ] Make exactly one target enforceable
        VERIFY: grep -rq "actor_profiles_kind_target" prisma/migrations/
  - [ ] Allow a person only one default profile
        VERIFY: grep -rq "actor_profiles_one_default" prisma/migrations/
  - [ ] Derive the display label rather than freezing a stale copy
        VERIFY: test $(awk '/^model ActorProfile \{/,/^\}/' prisma/schema.prisma | grep -cE "^  label[[:space:]]") -eq 0

- [ ] **Phase 12: Lookup collapse and hygiene** (destructive changes require their own approval)
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
        VERIFY: node scripts/verify-tenant-scope.mjs && test $(grep -rho "CREATE POLICY tenant_isolation_" prisma/migrations/ | wc -l) -ge 53
