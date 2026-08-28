# Project Portal Backend — Specifications Master Index (SDD Dashboard)

> Master rollup of every module. Governed by [`RULES.md`](RULES.md).
>
> **This is the only status surface.** Do not record progress in `CLAUDE.md`, `AGENTS.md`,
> `GEMINI.md`, or `Agent.md` ([Art. VII](rules/07-status.md)).

| # | Module | Tables | Phase | Tasks Done | Status | Notes |
|---|---|---|---|---|---|---|
| **00** | **Platform Core** — bootstrap, envelope, interceptors, exception filter, config, pagination, Swagger + repo-wide SOLID conformance | — | **Phase 4** | 24/26 | `[WIP]` | Retro-spec. Also carries the repo-wide [Art. X](rules/09-solid.md) layering assertions. |
| **01** | **Persistence** — DBML→Prisma pipeline, PrismaService, UnitOfWork, BaseRepository, migrations | — | **Phase 4** | 16/17 | `[WIP]` | Retro-spec. `BaseRepository` has no subclasses yet — first repository lands with module 03. |
| **02** | **Infrastructure** — Redis cache, Redis throttler storage, BullMQ mail queue + worker | — | **Phase 4** | 15/15 | `[WIP]` | Retro-spec. Every assertion passes; Gate 5 blocked only on the walkthrough. |
| **02.1** | **Messaging & Domain Events** — transactional outbox, relay, event contracts, module boundaries | 2 **applied** | **Phase 4** | 27/35 | `[WIP]` | Carries [Art. XI](rules/10-messaging.md). Phases 5 + 8 done; Phase 6 12/13 — outbox, relay, inbox, handler base built and wired. **Never run against a database.** Only the partial index remains. Phase 7 deferred to module 12. |
| **03** | **Identity & Access** — users, roles, user_roles, actor_profiles, auth_sessions, password_reset_tokens | 6 | **Phase 4** | 4/22 | `[WIP]` | Only `users` CRUD exists, unauthenticated. Auth, sessions, RBAC, actor profiles all unbuilt. |
| **04** | **Organization** — company_types, companies, division_types, divisions, members, teams, team_members | 7 | Phase 0 | 0/0 | `[NOT STARTED]` | |
| **05** | **Clients** — clients, client_contacts | 2 | Phase 0 | 0/0 | `[NOT STARTED]` | |
| **06** | **Reference Data** — portal_configs, option_types/values, all lookup + status tables, seeding | 16 | Phase 0 | 0/0 | `[NOT STARTED]` | Blocks 07–11: they all FK into these tables. Needs to land early. |
| **07** | **Projects & Bids** — projects, status events, bid_details, credential deliveries, outcomes, conversions, archived reviews | 7 | Phase 0 | 0/0 | `[NOT STARTED]` | BID and PROJECT are one table discriminated by `workspace_type_id`. |
| **08** | **Documents** — documents, versions, folders, folder locations, version links, registry | 6 | Phase 0 | 0/0 | `[NOT STARTED]` | Storage-agnostic: bucket/key/url columns, no provider chosen yet. |
| **09** | **Workflow Engine** — workflow_statuses, action definitions, transitions, action role permissions | 4 | Phase 0 | 0/0 | `[NOT STARTED]` | The rules: which role may fire which action from which status. |
| **10** | **Work Requests** — work_requests, assignments, audit logs, notes, audit attachments | 5 | Phase 0 | 0/0 | `[NOT STARTED]` | Status is derived from the latest audit log (Art. VI.2). |
| **11** | **Info Requests & Revisions** — info requests/responses, revision requests/documents/submissions, decisions | 7 | Phase 0 | 0/0 | `[NOT STARTED]` | |
| **12** | **Notifications** — notifications, notification_recipients | 2 | Phase 0 | 0/0 | `[NOT STARTED]` | Consumes module 02's mail queue. |
| **13** | **Audit** — system_audit_logs | 1 | Phase 0 | 0/0 | `[NOT STARTED]` | |

All 63 ERD tables are assigned exactly once across modules 03–13. Module 02.1 proposes two
tables that are **not** ERD tables (`outbox_messages`, `processed_events`) — infrastructure,
not domain, so the count above is unaffected.

**Nothing is at Phase 5 yet.** Modules 00–02 have every assertion passing and lint/build
clean — Gate 4 is complete for them. Gate 5 additionally requires the HTTP walkthrough of
Constitution Art. V, which needs a running server against a live database. No module has one,
so no module is `[DONE]`. This is the system working as intended: Phase 5 is a claim about
runtime behavior, and nobody has observed it yet.

---

## SDD Phase Key

- `Phase 0`: Spec not started
- `Phase 1`: `SPEC.md` + `DATA_CONTRACT.md` / `API_CONTRACT.md` in progress or awaiting review
- `Phase 2`: `plan.md` in progress or awaiting review
- `Phase 3`: `tasks.md` in progress or ready for implementation (`[SPEC APPROVED]`)
- `Phase 4`: Implementing tasks (`[WIP]`)
- `Phase 5`: Verified and complete (`[DONE]`)

---

## Open deviations

Shipped code that contradicts the rules. Each is an unticked task with a currently-failing
`VERIFY:` line — listed here to be visible without running the suite, not as a second log.

| Mod | Deviation | Rule | Where |
|---|---|---|---|
| 00 | ETag hashes the enveloped body incl. a fresh `meta.timestamp` → changes every request, 304 is dead code | VI.3 | `interceptors/etag.interceptor.ts` |
| 03 | `UserMutationProvider` still catches `P2025`/`P2003`/`P2034` — unique violations are now central, the rest are not | VI.4 | `user/providers/user-mutation.provider.ts` |
| 04 | `CompanyMutationProvider` still catches `P2003` | VI.4 | `company/providers/company-mutation.provider.ts` |
| 03 | `RolePermissionMutationProvider` still catches `P2034` | VI.4 | `role-permission/providers/role-permission-mutation.provider.ts` |
| 03 | `UsersService` injects `PrismaService` rather than a repository | VI.5 | `users.service.ts:14` |
| 03 | `/users` is unauthenticated — no guard, no role check | III | `users.controller.ts` |
| 00 | `UsersService` injecting `PrismaService` breaks the layering law repo-wide | X | asserted in `00/tasks.md` Phase 5 |
| 02.1 | **Owner waived Art. IX 2026-08-28** — both models written into `schema.prisma` directly. **No migration exists; the tables are not real.** `yarn prisma:migrate` is still the owner's to run | IX | `02.1-messaging/DATA_CONTRACT.md` §3 |
| 01 | **The DBML is deleted from the working tree and the `HEAD` copy is stale** — running `dbml-to-prisma.cjs` would drop the two new models *and* revert migration `20260821000000` | I | `scripts/dbml-to-prisma.cjs` |
| 03 | `PLACEHOLDERS.md` names `src/users/users.module.ts`, which no longer exists; `auth`, `company`, `role-permission`, `user` are unregistered — **Gate 0 fails, blocking `verify:sdd` for every module** | I | `specs/PLACEHOLDERS.md` |

---

## Session Log

One line per session. **Keep the last 10 rows**; trim the oldest when adding an eleventh
([Art. VII](rules/07-status.md)).

| Date | Agent | Module | Gates | Notes |
|---|---|---|---|---|
| 2026-08-28 | Claude | — | — | Ported the 5-gate SDD system from `amusement-park-client`: constitution, verifier, hook, `prebuild` floor, entry points for Claude/Codex/Antigravity. |
| 2026-08-28 | Claude | 00, 01, 02, 03 | 1–4 | Retro-specced shipped code. 69 leaf assertions; 49 ticked and passing. Gate 5 not reached: no walkthrough. |
| 2026-08-28 | Claude | — | — | Token pass: constitution split into `RULES.md` card + `rules/` articles; routing table; runner prints next-file hint. Session floor ~7.1K → ~1.6K tok. |
| 2026-08-28 | Claude | 01 | 4 | Art. IX database boundary: stripped `migrate deploy` from all prestart hooks; migrations and DBML are owner-only. **Prod deploys now need explicit `yarn prisma:deploy`.** |
| 2026-08-28 | Claude | 00 | 4 | Art. X SOLID: layering law + 9 repo-wide assertions in `00/tasks.md` Phase 5, 8 passing. Each verified to detect a planted violation. |
| 2026-08-28 | Claude | 02.1 | 1–3 | Art. XI messaging + module boundaries. New spec `02.1-messaging` (SPEC, plan, tasks, DATA_CONTRACT). Transactional outbox chosen; choreography and RPC rejected. 34 unticked assertions. Schema proposed, not applied. |
| 2026-08-28 | Claude | 02.1 | 4 | Phase 5 shipped: `src/contracts/events/` + `src/infra/messaging/` (transport port, in-process adapter, global module). 8/35 ticked, lint + build clean. Added one Phase 6 task — the relay needs an `eventType` → class registry or replayed rows reach no handler. |
| 2026-08-28 | Claude | 00–04 | 0 | **Gate 0 cleared.** Registered `user`, `auth`, `role-permission` → 03 and `company` → new retro-spec `04-organization` (SPEC, plan, API_CONTRACT, tasks; 12/22 ticked). Removed the stale `src/users/users.module.ts` row. `verify:sdd` now reaches Gate 5 for the first time. |
| 2026-08-28 | Claude | 00, 03, 04, 02.1 | 4 | **P2002 centralised.** `mapPrismaException` gained a constraint→message map keyed on the literal index names in `prisma/migrations/`; the local unique-violation catches in `user`, `company`, `role-permission` are gone. Messages preserved exactly. 27/35. |
| 2026-08-28 | Claude | 02.1 | 4 | **Phase 6 built**: `OutboxRepository` (joins the producer's tx), `OutboxService`, `OutboxRelayService` (unscoped cross-tenant drain, timer not BullMQ — see plan §2), `InboxRepository` (P2002 claim), `EventHandlerBase` (tenant restore). Owner's migration applied. 26/35, lint + build clean, nothing executed against a DB. |
| 2026-08-28 | Claude | 02.1 | 4 | Owner waived Art. IX: `OutboxMessage` + `ProcessedEvent` written into `schema.prisma`, client generated. No migration. DBML pipeline found broken **and** stale — logged as an 01 deviation. Added RabbitMQ to `docker-compose.yml` (healthy, verified). |
| 2026-08-28 | Claude | 02.1 | 4 | Phase 6 partial: relay config across all four Art. VI.6 files, `EventRegistry` + `DOMAIN_EVENT_TYPES` so replayed rows keep their class. 17/35. The other 11 Phase 6 tasks need the migration. |
| 2026-08-28 | Claude | 02.1 | 4 | Phase 8 shipped: guards + session types → `src/common/security/`, hashing → `src/infra/crypto/` behind `PASSWORD_HASHER`, `AuthModule` now global exporting only `SESSION_AUTHENTICATOR`. Dropped unused `bcrypt`. **No feature module imports another.** 15/35 ticked; DI graph resolved live. |
