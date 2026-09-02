# SPEC: 02.1 — Messaging & Domain Events

**Status:** Draft (Gate 1) · **Tables:** 2 proposed (not ERD tables)
**Contracts:** `DATA_CONTRACT.md` · **Law:** [Art. XI](../rules/10-messaging.md)

Feature modules must stop calling each other. Today two do, and ten more (04–13) are unwritten
— which is the whole reason to establish this now: setting the pattern before module 04 costs
almost nothing, retrofitting it across ten modules is a rewrite.

This module supplies the one channel that replaces the direct call: a domain event, published
through a transactional outbox and delivered to consumers that never knew who sent it.

It is a sibling of module 02, not part of it. It reuses that module's ports-and-adapters idiom
and its BullMQ instance, but module 02 is a retro-spec of shipped code and this is greenfield.

## Four organizing decisions

1. **Publish through an outbox, never inline.** A broker write inside a database transaction is
   a dual write — roll back after it and the system has announced something that never
   happened, permanently. The outbox row commits atomically with the domain fact; a relay
   publishes afterward.
2. **Delivery is post-commit even in-process.** The in-process transport is not a shortcut that
   calls handlers inline; it goes through the same relay. Handlers therefore never run inside
   the producer's transaction, and swapping in RabbitMQ later changes deployment topology
   rather than semantics.
3. **The transport is a port.** `EVENT_TRANSPORT` is an injection token. `InProcessEventTransport`
   ships first; `RabbitMqEventTransport` is a provider binding away. Nothing outside
   `src/infra/messaging/` may name either.
4. **Orchestration, not choreography.** `workflow_transitions` already encodes the state machine
   as data. Events announce that a transition happened; they never cause the next one.

The two brokers divide cleanly: **BullMQ carries work this app owes itself** (send mail, run the
relay — retries, backoff, scheduling). **The event transport carries facts broadcast to whoever
cares.** Neither substitutes for the other.

## User stories

| | As a | I want | So that |
|---|---|---|---|
| US-01 | developer adding a module | to react to another module's facts without importing it | modules stay addable without editing existing ones |
| US-02 | developer publishing | the event to commit or vanish with its transaction | the system never announces what did not happen |
| US-03 | developer consuming | redelivery to be harmless | at-least-once does not mean two emails |
| US-04 | operator debugging | a queryable trace of every event published | "did this fire?" is answerable without log archaeology |
| US-05 | operator | events to survive a transport outage | a restart drains the backlog rather than losing it |
| US-06 | architect | the in-process and remote paths to behave identically | the RabbitMQ swap is not a rewrite |

## Domain rules

| # | Rule | Enforced by |
|---|---|---|
| DR-01 | An event is written to the outbox in the producer's transaction, never published inline | `OutboxRepository extends BaseRepository`, writes `this.db` |
| DR-02 | Only `src/infra/messaging/` names the transport, an exchange, or a routing key | Art. XI assertions |
| DR-03 | Handlers run post-commit, never inside the producer's transaction | the relay is the sole delivery path, in-process included |
| DR-04 | A consumer restores tenant context and enters UnitOfWork before touching persistence | message tenant → `RequestContext` → transaction-local `app.tenant_id` |
| DR-05 | A consumer is idempotent | `@@unique([tenantId, eventId, consumer])` on `processed_events` |
| DR-06 | Event payloads carry IDs and primitives only — no Prisma types, no secrets | Art. XI §3 assertions |
| DR-07 | A consumer never triggers a workflow transition | Art. XI §5 |
| DR-08 | No feature module imports another feature module | Art. XI §1 assertions |
| DR-09 | Contract evolution is additive; a removed or renamed field is a new routing key | review |
| DR-10 | The relay is the only writer of `publishedAt` | `OutboxRelayService` |
| DR-11 | Only the relay uses the privileged cross-tenant database client | `DATABASE_URL_PRIVILEGED` → `app_relay`; producers and consumers use `app_user` |

DR-04 is the one that will bite hardest. A consumer has no HTTP request, so it must restore
the message tenant into `RequestContext` and enter `UnitOfWorkService.execute(...)`. The root
unit of work sets transaction-local `app.tenant_id` before repository work. Without that
boundary, repository access and `app_user` RLS fail closed; absence never grants cross-tenant
access.

## Failure modes

| Condition | Effect |
|---|---|
| Producer transaction rolls back | Outbox row rolls back with it. Nothing is published. **This is the point.** |
| Transport down when the relay ticks | Rows stay `publishedAt: null`, `attempts` increments, `lastError` recorded. Next tick retries. |
| Transport down for hours | Backlog grows in Postgres, bounded by disk, drains on recovery. No loss. |
| Relay publishes, then crashes before stamping | Event redelivered. Consumer dedupes on `processed_events`. **Why DR-05 is not optional.** |
| Duplicate delivery to a consumer | Unique violation on claim → handler skipped, no side effect repeated |
| Handler throws | Its transaction rolls back, dedupe row included, so the retry is clean |
| Handler keeps throwing | Dead-lettered after the configured attempts; the outbox row stays stamped |
| Events arrive out of causal order | Handler re-reads current state from Postgres (Art. VI.2) rather than trusting sequence |
| Consumer missing tenant context or UnitOfWork | repository access or `app_user` RLS fails closed before tenant data is returned |
| Partial index missing | Correct but degrading: relay scans grow with total history rather than backlog |

## EARS acceptance criteria

- `[AC-U01]` The outbox row SHALL be written in the same transaction as the domain fact it describes.
- `[AC-U02]` Events SHALL be delivered only after the producing transaction commits.
- `[AC-U03]` No feature module SHALL import another feature module's service, provider, or repository.
- `[AC-U04]` Event contracts SHALL carry no Prisma, Nest, or transport types.
- `[AC-E01]` WHEN the relay publishes a message, it SHALL stamp `publishedAt` and never republish it.
- `[AC-E02]` WHEN the transport rejects a publish, the system SHALL leave the row unpublished, increment `attempts`, and record `lastError`.
- `[AC-E03]` WHEN a consumer receives an event it has already processed, it SHALL skip it without repeating the side effect.
- `[AC-E04]` WHEN a consumer receives an event, it SHALL open a tenant context and UnitOfWork from the message before any repository query.
- `[AC-S01]` WHILE the transport is unreachable, producers SHALL continue to accept writes and enqueue events.
- `[AC-S02]` WHILE `MESSAGING_RELAY_ENABLED` is false, the process SHALL enqueue events but publish none.
- `[AC-W01]` IF a handler throws, THEN its dedupe claim SHALL roll back with it so the retry is clean.
- `[AC-W02]` IF an event carries no `tenantId`, THEN the consumer SHALL reject it rather than enter persistence.
- `[AC-S03]` WHILE the relay drains across tenants, it SHALL use only the separate `DATABASE_URL_PRIVILEGED` / `app_relay` client.

## Out of scope

Which events exist (each owning module defines its own contracts) · notification content and
recipients (12) · audit row shape (13) · the RabbitMQ adapter itself (Phase 7, deferred until
module 12 provides a second consumer) · retention and pruning (13) · replacing BullMQ.
