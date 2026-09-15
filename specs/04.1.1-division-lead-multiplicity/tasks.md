# Tasks: 04.1.1 - Division Lead Multiplicity

**Status:** Gate 5 - COMPLETE - 17/17 verified 2026-09-15
**Spec Reference:** `SPEC.md` - **Plan Reference:** `plan.md`

All 17 leaves were verified on 2026-09-15 by an independent `verify-sdd --all` pass run by
the owner, separate from the session that implemented them ([Art. II](../rules/02-proof.md) §2),
and ticked on that result. Runtime evidence is `walkthrough.md` + `http-evidence.json`
(28 curl requests, 0 blockers, cleanup PASS).

Runtime evidence is separately recorded in `walkthrough.md`. Implement after `04.1-division`,
and land Phase 3 before Phase 2 is exposed through a route (see `plan.md` §0).

- [x] **Phase 1: schema proposal (no `src/` change)**
  - [x] Record the `division_leads` proposal in the owning Division data contract and the repo deviation table; depend on nothing, state tables/columns/nullability/relations and what breaks without it, and apply no schema, migration, seed, RLS, or grant change. Complete when both surfaces carry the proposal.
        VERIFY: grep -q '## Proposed schema change' specs/04.1-division/DATA_CONTRACT.md && grep -q 'division_leads' specs/04.1-division/DATA_CONTRACT.md && grep -q '04.1.1' specs/INDEX.md
  - [x] Specify both uniqueness predicates as partial indexes; depend on the proposal, require `WHERE revoked_at IS NULL` on the per-Division and per-pair indexes, and explicitly reject a non-partial unique that would bar re-assignment after revocation. Complete when the contract states both indexes and the rejection.
        VERIFY: test $(grep -c 'WHERE "revoked_at" IS NULL' specs/04.1.1-division-lead-multiplicity/DATA_CONTRACT.md) -ge 2 && grep -q 'is rejected' specs/04.1.1-division-lead-multiplicity/DATA_CONTRACT.md

- [x] **Phase 2: persisted leadership**
  - [x] Add the `DivisionLead` model with tenant-carrying composite FKs; depend on owner-applied migration, reference `(id,tenantId,companyId)` on Division and `(id,tenantId)` on Member, and add no column to Division or Member. Complete when the model and both inverse relations exist and the client generates.
        VERIFY: grep -q 'model DivisionLead' prisma/schema.prisma && grep -q 'divisionLeadsByDivisionId' prisma/schema.prisma && grep -q 'divisionLeadsByMemberId' prisma/schema.prisma && ! grep -q 'leadMemberId' <(grep -A24 '^model Division ' prisma/schema.prisma) && corepack yarn prisma:generate
  - [x] Ship both partial unique indexes and the RLS/grant block in the migration; depend on the model, enable row level security with the `app.tenant_id` policy, and grant app_user SELECT/INSERT/UPDATE with no DELETE. Complete when the migration carries all four.
        VERIFY: test $(grep -rl 'division_leads' prisma/migrations/*/migration.sql | wc -l) -ge 1 && grep -rq 'division_leads_one_active_per_division' prisma/migrations/*/migration.sql && grep -rq 'division_leads_active_pair' prisma/migrations/*/migration.sql && grep -rq 'ROW LEVEL SECURITY' $(grep -rl 'division_leads' prisma/migrations/*/migration.sql)
  - [x] Relax the assign precheck to Tenant+Company; depend on the table, stop comparing the Member's `divisionId` to the target Division, keep the active/User-linked prechecks, and keep serializable isolation. Complete when the repository no longer constrains the Member to the target Division and focused tests pass.
        VERIFY: ! grep -q 'Member was not found in this Division' src/division/repositories/division-lead.repository.ts && grep -q 'Serializable' src/division/repositories/division-lead.repository.ts && grep -q 'divisionLead.create' src/division/repositories/division-lead.writer.ts && corepack yarn test --runInBand --testPathPatterns=division-lead
  - [x] Revoke the incumbent inside the assign transaction and make re-assign idempotent; depend on the relaxed precheck, set `revokedAt` on any active row for the Division before insert, return the existing row unchanged when the Member already leads it, and delete no row. Complete when focused tests cover both paths.
        VERIFY: grep -rq 'revokedAt' src/division/repositories/division-lead.repository.ts src/division/repositories/division-lead.writer.ts && ! grep -rqE '\.delete\(|deleteMany' src/division/repositories/division-lead.repository.ts src/division/repositories/division-lead.writer.ts && corepack yarn test --runInBand --testPathPatterns=division-lead
  - [x] Add revocation and lead-read repository paths; depend on assign, set `revokedAt`/`revokedByUserId` on the active row only, return null for a Lead-less Division, and never return revoked rows from a read. Complete when focused tests pass.
        VERIFY: grep -q 'revokedByUserId' src/division/repositories/division-lead.repository.ts && grep -q 'revokedAt: null' src/division/repositories/division-lead.writer.ts && corepack yarn test --runInBand --testPathPatterns=division-lead

- [x] **Phase 3: set-based authorization**
  - [x] Project the actor's active lead set onto the session; depend on the table, filter by `revokedAt: null` and `tenantId` in the member projection, and issue no per-request scope query. Complete when the projection exists and the type compiles.
        VERIFY: grep -q 'divisionLeadsByMemberId' src/common/security/session.types.ts && grep -q 'revokedAt: null' src/common/security/session.types.ts && corepack yarn build
  - [x] Expose `ledDivisionIds` on the resolved actor scope; depend on the projection, populate it in `ObjectScopeProvider.resolve`, and convert the dead `memberDivision` branch to a set-membership test. Complete when the context carries the set and focused tests pass.
        VERIFY: grep -q 'ledDivisionIds' src/common/security/object-scope.provider.ts && ! grep -q 'member.divisionId === requirement.divisionId' src/common/security/object-scope.provider.ts && corepack yarn test --runInBand --testPathPatterns=object-scope
  - [x] Convert the Member scope chokepoints to sets; depend on `ledDivisionIds`, return a Division ID array rather than a single value, replace both `!==` comparisons with set membership, and preserve the separate Team-Lead fallback. Complete when no single-value Division comparison remains and focused tests pass.
        VERIFY: grep -q 'resolveActorDivisionIds' src/member/providers/member-scope.provider.ts && ! grep -qE '(actorDivisionId|divisionId) !== (divisionId|requestedDivisionId)' src/member/providers/member-scope.provider.ts && grep -q 'findLedTeamDivisionId' src/member/providers/member-scope.provider.ts && corepack yarn test --runInBand --testPathPatterns=member
  - [x] Convert the Team scope chokepoints to sets; depend on `ledDivisionIds`, replace the single-Division requirement and the membership equality check with set membership. Complete when no `member?.divisionId ===` comparison remains and focused tests pass.
        VERIFY: ! grep -q 'actor.member?.divisionId === team.divisionId' src/team/providers/team-scope.provider.ts && grep -q 'ledDivisionIds' src/team/providers/team-scope.provider.ts && corepack yarn test --runInBand --testPathPatterns=team
  - [x] Deny an empty lead set instead of falling back to the home Division; depend on both providers, require that a `division_lead` actor with no active row is refused every Division-scoped operation, and never substitute `member.divisionId`. Complete when negative tests prove the denial.
        VERIFY: test $(grep -rc 'member.divisionId' src/member/providers/member-scope.provider.ts src/team/providers/team-scope.provider.ts | grep -v ':0$' | wc -l) -eq 0 && corepack yarn test --runInBand --testPathPatterns='member-scope|team-scope'

- [x] **Phase 4: routes and deletion audit**
  - [x] Add the revoke and lead-read routes behind the Company-scoped guard chain; depend on the repository paths, require `ASSIGN_LEADER` rather than `ADD_DIVISION`, admit `system_admin` and `division_head` only, and return `data: null` rather than 404 for a Lead-less Division. Complete when routes and authorization tests pass.
        VERIFY: grep -q "@Delete(':id/lead')" src/division/division-lead.controller.ts && grep -q "@Get(':id/lead')" src/division/division-lead.controller.ts && grep -q 'ASSIGN_LEADER' src/division/division-lead.controller.ts && corepack yarn test --runInBand --testPathPatterns=division
  - [x] Add the Member led-Divisions read; depend on the repository read path, order `name asc, id asc`, return an empty array when the Member leads none, and expose no revoked row. Complete when the route and focused tests pass.
        VERIFY: grep -q "divisions" src/member/member.controller.ts && corepack yarn test --runInBand --testPathPatterns=member
  - [x] Extend the Division delete probe to the sixth relation; depend on the table, block hard delete when any lead row exists whether active or revoked, and cascade nothing. Complete when the probe names all six relations and the blocker test passes.
        VERIFY: grep -q 'divisionLeadsByDivisionId' src/division/repositories/division.repository.ts && corepack yarn test --runInBand --testPathPatterns=division

- [x] **Phase 5: independent verification and sign-off**
  - [x] Execute and record the production HTTP/RLS walkthrough; depend on completed implementation, use app_user with isolated cleanup, and cover assign-to-non-home-Division, one Member leading two Divisions, incumbent revocation, re-assignment after revocation, idempotent no-op, 400/401/403/404/409, and two-Tenant isolation. Complete only with PASS evidence and cleanup.
        VERIFY: test -f specs/04.1.1-division-lead-multiplicity/walkthrough.md && node scripts/verify-division-lead-evidence.cjs
  - [x] Run final boundary, lint, build, and spec checks; depend on the walkthrough, confirm no cross-feature import from `src/division`, and update INDEX only after independent verification. Complete when all commands pass.
        VERIFY: test $(grep -rlE "from '\.\.?/(\.\./)?(auth|user|company|member|team)/" src/division --include=*.ts | wc -l) -eq 0 && corepack yarn lint && corepack yarn build && corepack yarn verify:spec && node scripts/verify-division-lead-evidence.cjs
