# Project Portal Backend — SDD Dashboard

> The only status surface ([Art. VII](rules/07-status.md)). Rules: [`RULES.md`](RULES.md).
> Notes stay one short line; details live in the module's own `tasks.md` / `walkthrough.md`.

| Module | Tables | Phase | Tasks | Status | Note |
|---|---|---|---|---|---|
| [00](00-platform-core/) Platform Core | — | 4 | 24/26 | `[WIP]` | Retro-spec; carries repo-wide [Art. X](rules/09-solid.md) assertions |
| [01](01-persistence/) Persistence | — | 4 | 15/17 | `[WIP]` | DBML-authority task retired (schema being redesigned); UoW test suite deleted |
| [01.1](01.1-schema-integrity/) Schema Integrity & Tenant Isolation | reshapes 52 | 4 | 44/45 | `[WIP]` | Applied + catalog-verified; UoW fail-closed test suite deleted, needs new proof |
| [02](02-infrastructure/) Infrastructure | — | 4 | 15/15 | `[WIP]` | Retro-spec; only walkthrough remains |
| [02.1](02.1-messaging/) Messaging & Domain Events | 2 applied | 4 | 34/35 | `[WIP]` | [Art. XI](rules/10-messaging.md); partial index skipped by owner; walkthrough remains |
| [03](03-identity-and-access/) Identity & Access | 7 | 4 | 37/50 | `[WIP]` | 6 unticked: test suites deleted; actor_profiles grant blocker cleared 2026-09-15 |
| [04](04-organization/) Organization | 2 of 7 | 4 | 29/36 | `[WIP]` | 5 unticked: signup/update test suites deleted; UPDATE grant still missing |
| [04.1](04.1-division/) Division | 1 (+DivisionType) | 5 | 11/11 | `[DONE]` | Verified 2026-09-15; walkthrough PASS (24 curls, 0 blockers, cleanup PASS) |
| [04.1.1](04.1.1-division-lead-multiplicity/) Division Lead Multiplicity | 1 applied | 5 | 17/17 | `[DONE]` | Verified 2026-09-15; walkthrough PASS (28 curls, 0 blockers, cleanup PASS) |
| [04.2](04.2-member/) Member | 1 | 4 | 7/10 | `[WIP]` | Grants + seed cleared 2026-09-15; Gate 5 walkthrough re-runnable |
| [04.3](04.3-team/) Team | 2 | 4 | 9/11 | `[WIP]` | Gate 5 walkthrough pending |
| [05](05-clients/) Clients | 2 | 3 | 0/22 | `[SPEC APPROVED]` | Ready for implementation |
| 06 Reference Data | 16 | 0 | — | `[NOT STARTED]` | Blocks 07–11 (all FK into it) |
| 07 Projects & Bids | 7 | 0 | — | `[NOT STARTED]` | BID/PROJECT share a table via `workspace_type_id` |
| 08 Documents | 6 | 0 | — | `[NOT STARTED]` | Storage-agnostic |
| 09 Workflow Engine | 4 | 0 | — | `[NOT STARTED]` | Which role fires which action from which status |
| 10 Work Requests | 5 | 0 | — | `[NOT STARTED]` | Status derived from latest audit log (Art. VI.2) |
| 11 Info Requests & Revisions | 7 | 0 | — | `[NOT STARTED]` | |
| 12 Notifications | 2 | 0 | — | `[NOT STARTED]` | Consumes 02's mail queue |
| 13 Audit | 1 | 0 | — | `[NOT STARTED]` | |

All 63 ERD tables are assigned once across 03–13. 02.1's `outbox_messages` /
`processed_events` are infrastructure, not ERD tables.

**Phases:** 0 not started · 1 SPEC + contracts · 2 plan · 3 tasks (`[SPEC APPROVED]`) ·
4 implementing (`[WIP]`) · 5 verified (`[DONE]`)

## Open deviations

Shipped code or schema that contradicts the rules; each has a failing unticked `VERIFY:`.

| Mod | Deviation | Rule | Where |
|---|---|---|---|
| 00 | ETag hashes body incl. fresh `meta.timestamp` → 304 is dead code | VI.3 | `interceptors/etag.interceptor.ts` |
| 00 | `UsersService` injects `PrismaService` (layering) | X | `00/tasks.md` Phase 5 |
| 02.1 | Art. IX waived 2026-08-28: models in `schema.prisma`, no migration yet | IX | `02.1-messaging/DATA_CONTRACT.md` §3 |
| 03 | `division_head` / `team_lead` need enum + migration + seed; runtime bridge stays until then | IX | `03-identity-and-access/DATA_CONTRACT.md` |
| 04 | app_user lacks UPDATE on `companies` (confirmed live 2026-09-15) | IX | `04-organization/DATA_CONTRACT.md` |

## Session Log

Last 10 rows, one short line each ([Art. VII](rules/07-status.md)).

| Date | Agent | Module | Gates | Note |
|---|---|---|---|---|
| 2026-09-09 | Codex | 04.1–04.3 | 1–3 | Added Division, Member, Team specs |
| 2026-09-09 | Codex + verifier | 04.1 | 4 | Division CRUD implemented; HTTP blocked by grants |
| 2026-09-09 | Codex | 04, 04.2, 04.3 | 1–3 | Reconciled Member authority scopes (spec only) |
| 2026-09-09 | Codex | 04.2 | 4–5 | Member leaves 1–7 pass; `POST /member` blocked by grants |
| 2026-09-15 | Claude + db-architect | 04.1.1 | 1–5 | Division Lead multiplicity DONE 17/17: `division_leads` + partial uniques/RLS, set-based scope, walkthrough PASS (28 curls); stale 03/04.1/04.2 grant blockers cleared |
| 2026-09-15 | Claude | 00, 01, 01.1, 03, 04 | 5 | 29/30 failing claims resolved: 15 unticked (proof deleted), rest fixed |
| 2026-09-15 | Claude | 04.1 | 5 | Division DONE 11/11: walkthrough PASS (24 curls); 500-on-unknown-divisionTypeId fixed; recursive `verify:sdd:strict` removed from final VERIFY |
| 2026-09-17 | Codex | 04.2 | 1–4 | Member response is flat IDs only; focused test/build PASS |
| 2026-09-17 | Codex | 03, 04.2, 04.3 | 1–4 | Member onboarding now excludes role access; focused tests/build PASS |
| 2026-09-17 | Codex | 03, 04.2, 04.3 | 4 | Typed test mocks clear lint; focused tests/build PASS |
