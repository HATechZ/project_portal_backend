# Technical Plan: 02.1 — Messaging & Domain Events

**Status:** Draft (Gate 2)
**Related Spec:** `specs/02.1-messaging/SPEC.md`
**Contracts:** `DATA_CONTRACT.md` · **Law:** [Art. XI](../rules/10-messaging.md)

---

## 1. Module Tree

```
src/contracts/events/                 # shared kernel — NOT infra
├── index.ts
├── domain-event.ts                   # DomainEvent base: eventId, tenantId, occurredAt
└── <module>/*.event.ts               # owned by the publishing module's spec

src/infra/messaging/
├── messaging.module.ts               # @Global — binds ports, registers relay
├── messaging.constants.ts            # EXCHANGE, RELAY_QUEUE, RELAY_JOB_NAME
├── event-transport.port.ts           # EVENT_TRANSPORT symbol + EventTransport iface
├── in-process-event.transport.ts     # adapter #1 — hands to @nestjs/cqrs EventBus
├── rabbitmq-event.transport.ts       # adapter #2 — Phase 7, deferred
├── outbox.repository.ts              # extends BaseRepository — joins ambient tx
├── outbox.service.ts                 # enqueue(event) — the only producer API
├── outbox-relay.service.ts           # the only publisher; privileged app_relay DB path
├── inbox.repository.ts               # extends BaseRepository — processed_events claim
└── event-handler.base.ts             # tenant restore + dedupe wrapper for consumers
```

`src/contracts/events/` sits beside infra deliberately. Contracts are shared kernel: both
publisher and consumer import them, so they must not depend on the broker, on Nest, or on
Prisma. Putting them inside `infra/messaging/` would make every publisher import infrastructure
to name an event.

---

## 2. Publish path

```
service (inside UnitOfWorkService.execute)
   │
   ├─ repository.write(domainFact)     ──┐
   └─ outbox.enqueue(event)            ──┤ same transaction
                                         │
                                    COMMIT ✓
                                         │
   ────────────────────────────────────────────────────────────
                                         │
   OutboxRelayService  (interval timer, every RELAY_INTERVAL_MS — see §2.1)
       │
       ├─ SELECT … WHERE published_at IS NULL ORDER BY occurred_at LIMIT n   ← partial index
       ├─ EVENT_TRANSPORT.publish(routingKey, envelope)
       ├─ ok   → UPDATE published_at = now()
       └─ fail → UPDATE attempts += 1, last_error = …     (row stays unpublished)
                                         │
                                    transport
                                         │
                            InProcess ──► CQRS EventBus ──► @EventsHandler
                            RabbitMQ  ──► topic exchange ──► queue ──► handler
```

Two properties this buys, both load-bearing:

- **Atomicity.** The event cannot outlive a rolled-back transaction, because it lives in the
  same transaction. No compensating logic, no reconciliation job.
- **Identical semantics on both transports.** The in-process path does *not* call handlers
  inline. It goes through the relay like the remote one, so handlers are always post-commit and
  never inside the producer's transaction. Swapping `EVENT_TRANSPORT` changes where handlers run,
  never *when*. This is the difference between a topology change and a rewrite.

### 2.1 A timer, not a BullMQ repeatable (deviation from this plan as drafted)

Gate 2 said the relay would be a BullMQ repeatable job. It shipped as an interval timer.

A repeatable job buys distributed scheduling — exactly one instance runs the tick. But
`MESSAGING_RELAY_ENABLED` already provides that, the same way `MAIL_WORKER_ENABLED` does for the
mail worker, and it is the mechanism the spec's own `[AC-S01]` names. Adding a second BullMQ
queue whose only job is "poll a Postgres table on this one instance" pays a Redis dependency for
a guarantee the config flag already gives.

What this trades away: if two instances are ever both enabled, both drain the same rows and
publish twice. The mitigation is at-least-once delivery and the inbox, which already handle
duplicates. A `SELECT … FOR UPDATE SKIP LOCKED` would close it properly and needs raw SQL —
worth doing when a second relay instance is a real requirement, not before.

### Why not `EventBus.publisher`

`@nestjs/cqrs` exposes a settable `EventBus.publisher`, and swapping it is the obvious hook. It
is the wrong layer here: `publish()` is synchronous with the caller, so an outbox implemented
there would still be writing inside the producer's transaction — or outside it, which is the
dual write. The outbox must be a repository, and the relay must be a separate tick.

The EventBus stays, but downstream of the relay: `InProcessEventTransport` hands to it, so
handlers use ordinary `@EventsHandler` and are transport-agnostic.

---

## 3. Consume path

```
transport delivers { routingKey, envelope }
   │
   ▼
EventHandlerBase.dispatch(envelope)
   │
   ├─ tenantId absent?  → reject, do not query            (AC-W02)
   │
   └─ RequestContext.run({ tenantId, correlationId }, () =>
          unitOfWork.execute(async tx => {
              await inbox.claim(eventId, consumerName)    ← unique violation ⇒ skip
              await handler.handle(event)                 ← side effect, same tx
          }))
```

The claim and the side effect share one transaction, so a throwing handler rolls back its own
dedupe row and the retry is clean. Claiming in a separate transaction would mark the event
processed for work that never happened — the same dual-write bug as the outbox, mirrored.

The restored `RequestContext` supplies the tenant to the root `UnitOfWorkService.execute(...)`.
That transaction uses `DATABASE_URL` / `app_user` and sets transaction-local `app.tenant_id`
before `inbox.claim` or handler repository work. Missing either boundary fails closed.

`inbox.claim` catches `P2002` locally and returns "already processed". This is the **one**
sanctioned exception to Art. VI.4: it is control flow, not a failure, and it is confined to
`src/infra/messaging/`. Art. XI §4 records the exemption so it does not read as a violation.

---

## 4. Topology (Phase 7, deferred)

```
exchange:     portal.events           type: topic, durable
routing key:  <module>.<aggregate>.<event>
              work-request.status.changed
              project.status.changed
              document.version.uploaded

bindings:     audit.queue          → #
              notifications.queue  → *.status.changed
                                   → *.assignment.*

dead letter:  portal.events.dlx    → <queue>.dlq   per queue
headers:      x-tenant-id, x-event-id, x-correlation-id, x-occurred-at
```

Topic rather than fanout because consumers want overlapping-but-different subsets — audit wants
everything, notifications wants a slice. Adding a queue later touches no publisher.

`tenantId` travels in a header, never in the routing key. Routing per tenant would multiply
queues by tenant count and make bindings unmanageable.

---

## 5. Configuration

| Variable | Purpose |
|---|---|
| `MESSAGING_RELAY_ENABLED` | Gate the relay so only designated processes publish (mirrors `MAIL_WORKER_ENABLED`) |
| `MESSAGING_RELAY_INTERVAL_MS` | Relay tick period |
| `MESSAGING_RELAY_BATCH_SIZE` | Rows per tick |
| `MESSAGING_TRANSPORT` | `in-process` \| `rabbitmq` — selects the adapter binding |
| `RABBITMQ_URL` | Phase 7 only |

Per Art. VI.6 each of these touches four files together: `env.ts`, `env.schema.ts`,
`configuration.ts`, `.env.example`.

The relay's cross-tenant drain and stamp operations alone use
`DATABASE_URL_PRIVILEGED` / `app_relay` through `PrismaService.unscoped`. Producers and
consumers never receive that executor; they persist through the normal app-user UnitOfWork.

---

## 6. Ordering

The relay reads `ORDER BY occurred_at` and publishes in batches, but ordering is **not**
guaranteed end to end: a failed row is retried on a later tick while newer rows proceed, and
concurrent consumers finish out of order.

This is accepted rather than solved. Art. VI.2 already makes current status the latest event
*row in Postgres*, so a handler that needs current state re-reads it and is unaffected by
arrival order. Per-aggregate ordering would require a partition key and a single consumer per
partition — real cost, no benefit for handlers that re-read anyway.

**The rule that keeps this safe:** never accumulate state from message sequence. Re-read, or
compare `occurredAt`.

---

## 7. Errors

| Case | Thrown | Result |
|---|---|---|
| Transport publish fails | adapter error | Row unpublished, `attempts++`, `lastError` set, retried next tick |
| Duplicate delivery | `P2002` on claim | Caught in `inbox.repository.ts`, handler skipped |
| Handler throws | handler error | Transaction rolls back incl. claim; redelivered |
| Handler exhausts attempts | — | Dead-lettered; outbox row stays stamped |
| Missing `tenantId` | `AppException` | Rejected before any query |
| Event with no registered handler | — | Ignored, not an error — publishers do not know their consumers |

Only the last is a design choice worth stating: an unconsumed event is normal. A publisher that
errors when nobody is listening has re-coupled itself to its consumers.

---

## 8. Sequencing

| Phase | Content | Blocked by |
|---|---|---|
| 5 | Contracts folder, `DomainEvent`, boundary assertions | — |
| 6 | Outbox tables, repository, service, relay, in-process transport | owner runs the migration |
| 7 | RabbitMQ adapter, topology, DLQ | module 12 needing a second consumer |
| 8 | Close the two existing cross-module couplings | — |

Phase 5 and Phase 8 need no schema change and no broker; they are buildable today. Phase 6 is
blocked on the owner applying `DATA_CONTRACT.md` §2 (Art. IX — no agent runs a migration).
Phase 7 is deliberately deferred: the transport port makes it a provider binding, so building it
before a second consumer exists buys nothing.
