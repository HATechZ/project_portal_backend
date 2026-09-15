# Technical Plan: 04.1.1 — Division Lead Multiplicity

**Status:** Gate 2 · draft · **blocked on owner schema approval**
**Contracts:** `SPEC.md` · `DATA_CONTRACT.md` · `API_CONTRACT.md`

## 0. Sequencing

Phase 1 is a schema proposal only and produces no `src/` change. **Nothing in Phases 2–5 may
begin until the owner approves and applies the migration** ([Art. IX](../rules/08-database.md)).
The schema work itself is delegated to the `database-architect` subagent; no other agent edits
`prisma/schema.prisma`, `prisma/migrations/**`, or `prisma/seed/**`.

The ordering across the rest is forced by the layering law: table → repository → scope
providers → routes. Scope providers (Phase 3) must land before the relaxed assign rule
(Phase 2) is exposed through a route, or a Member could hold a second Division that
authorization still refuses — SPEC AC-S01 would fail at runtime while every static assertion
passed.

## 1. Module tree

No new NestJS feature module. This work lands in the existing `src/division/` tree plus two
scope providers owned by their own modules:

| Path | Change |
|---|---|
| `src/division/repositories/division-lead.repository.ts` | rewritten: writes `division_leads`, revokes incumbent |
| `src/division/repositories/division-lead.records.ts` | adds the lead-row record/select shapes |
| `src/division/division.controller.ts` | `PUT :id/lead` amended; `DELETE :id/lead`, `GET :id/lead` added |
| `src/division/division.service.ts` | assign/revoke/read orchestration |
| `src/division/dtos/` | revoke + lead-read response DTOs |
| `src/division/repositories/division.repository.ts` | delete probe gains the sixth relation |
| `src/common/security/session.types.ts` | session projection gains the active lead set |
| `src/common/security/object-scope.provider.ts` | `ActorScopeContext.member` gains `ledDivisionIds`; CP-6 set test |
| `src/member/providers/member-scope.provider.ts` | CP-1/2/3 → set membership |
| `src/team/providers/team-scope.provider.ts` | CP-4/5 → set membership |
| `src/member/member.controller.ts` | `GET /member/:id/divisions` |

`src/division/` continues to import no feature module. The scope providers already depend on
`common/security` types only, which is the shared kernel, not a feature module — that boundary
is preserved (non-negotiable #11).

## 2. Repository and service surface

| Operation | Responsibility | Transaction |
|---|---|---|
| assign Lead | resolve Division by `(id,tenantId,companyId)`; resolve Member by `(id,tenantId,companyId)` **without** comparing `divisionId`; require `member.userId`; short-circuit if already active Lead; revoke incumbent; insert row; ensure UserRole + ActorProfile and link | one **serializable** Tenant UnitOfWork |
| revoke Lead | find the active row for `(tenantId,divisionId)`; set `revokedAt`/`revokedByUserId`; never delete | one Tenant UnitOfWork |
| read Division Lead | active row for the Division, or null | ambient read UnitOfWork |
| read Member's led Divisions | active rows for the Member joined to Division, ordered `name,id` | ambient read UnitOfWork |
| delete Division | existing five-relation probe **plus** `divisionLeadsByDivisionId` | one Tenant UnitOfWork; restrictive FK backstop |

Serializable isolation on assign is retained from the current implementation and is what makes
the revoke-then-insert pair safe against a concurrent assign; the
`division_leads_one_active_per_division` partial unique index is the database backstop, mapped
centrally (non-negotiable #5).

## 3. Scope resolution

`ActorScopeContext.member` gains `ledDivisionIds: string[]`, populated in
`ObjectScopeProvider.resolve()` from the session projection added in `session.types.ts`. No
scope provider issues its own query for leadership — the set arrives with the session actor.

`resolveActorDivisionId(): string` becomes `resolveActorDivisionIds(): string[]` in both
`MemberScopeProvider` and `TeamScopeProvider`. Every `===` comparison against a Division ID
becomes `.includes()`. An actor with the `division_lead` role and an **empty** set is denied;
it must not fall back to `member.divisionId` (SPEC AC-S02).

The Team-Lead fallback at `member-scope.provider.ts:59-66` (`findLedTeamDivisionId`) is
unrelated to Division leadership and is preserved as a separate branch.

## 4. Events, security, and verification

No cross-module import or transport write. A `division.lead.assigned` / `.revoked` outbox
event is a plausible future consumer for notifications (module 12), but module 12 is Phase 0
and nothing subscribes — do not publish an event with no consumer.

Tests cover: assign to a non-home Division; one Member leading two Divisions simultaneously;
incumbent revoked on re-assign; re-assignment after revocation; idempotent no-op; missing User
link 409; empty-lead-set denial; cross-Company denial; Division delete blocked by a lead row;
and both scope providers admitting the second Division.

Runtime walkthrough uses real app_user/RLS, records envelopes and request IDs, exercises both
Tenant directions, creates only isolated fixtures, and cleans them after every outcome —
including the `division_leads` rows, which cannot be deleted through the API by design and
must be cleaned directly by the owner's fixture teardown.
