# Article XI — Messaging & Module Boundaries `[ALL]`

Read before publishing an event, writing a consumer, or importing across feature modules.
Card: [`../RULES.md`](../RULES.md).

Feature modules do not call each other. They announce facts and react to them. This article is
what makes that hold rather than remain an aspiration.

| Concern | Mechanism | Status |
|---|---|---|
| Module isolation | No feature module imports another | Enforced |
| Reliable publish | Transactional outbox | Enforced |
| Routing | Topic exchange, one durable queue per consumer | Enforced |
| Duplicate delivery | Idempotent consumer via `processed_events` | Enforced |
| Contract purity | Events carry no Prisma, Nest, or broker types | Enforced |
| Who decides what happens next | Orchestration — the workflow engine | Review-only |

---

## 1. The boundary law

```
     ┌───────────── shared kernel: src/common/, src/infra/ ─────────────┐
     │                    every module may import                        │
     └───────────────────────────────────────────────────────────────────┘

  feature module A  ──publish──►  outbox ──relay──►  transport  ──►  feature module B
                                                                       (consumer)

  feature module A  ──import──►  feature module B          ✗ FORBIDDEN
```

A feature module is any directory under `src/` that is not `common/`, `infra/`, `config/`,
`contracts/`, or `generated/`. Between two feature modules there is exactly one channel: an
event. Not a service import, not a repository import, not a provider.

Importing a **type** across modules is the same violation. `import type` erases at runtime but
not at design time — it still means one module knows another's shape, which is the coupling the
split is meant to remove. Shared shapes belong in `src/contracts/`.

**Cross-cutting infrastructure is exempt and is not a module**: guards, envelope, pagination,
tenant context, ports. Depending on `src/common/security/` is not coupling to `auth`.

## 2. Publish through the outbox, never directly

A broker publish inside a database transaction is a dual write. If the transaction rolls back
after the publish, the system has announced something that never happened, and nothing will
ever retract it. There is no retry policy that fixes this — the ordering is wrong.

```
UnitOfWorkService.execute(tx => {
    …write the domain fact…            ← e.g. work_request_audit_logs row
    outbox.enqueue(event)              ← same tx, atomic with it
})                                     ← commit
        │
        ▼
   OutboxRelay (BullMQ repeatable)  ──►  EVENT_TRANSPORT  ──►  consumers
```

Rules that follow:

- `OutboxRepository` extends `BaseRepository` and writes through `this.db`, so it joins the
  ambient transaction. A repository that takes `PrismaService` here defeats the entire pattern.
- Producer and consumer repositories use the normal `DATABASE_URL` / `app_user` unit-of-work
  path. Only the relay may drain and stamp rows through the separate
  `DATABASE_URL_PRIVILEGED` / `app_relay` client exposed as `PrismaService.unscoped`.
- **Only `src/infra/messaging/` may talk to the transport.** No feature module imports
  `amqplib`, an exchange name, or a routing key literal.
- Events are delivered **post-commit, always — including in-process.** A handler never runs
  inside the producer's transaction and therefore cannot roll the producer back. This is the
  intended semantics, and it is what makes the later out-of-process swap safe rather than a
  behavioral change.

## 3. Contracts are plain

`src/contracts/events/` holds the event classes. Both publisher and consumer import only from
there.

```typescript
export class WorkRequestStatusChanged {
  static readonly routingKey = 'work-request.status.changed';
  constructor(
    readonly eventId: string,
    readonly tenantId: string,
    readonly workRequestId: string,
    readonly toStatusId: string,
    readonly actorId: string,
    readonly occurredAt: string,     // ISO 8601 — JSON has no Date
  ) {}
}
```

- **IDs and primitives only.** The moment an event carries a Prisma payload the contract is
  bound to the schema, and a migration becomes a breaking wire change.
- No Nest decorators, no `generated/prisma` imports, no broker types.
- Dates cross the wire as ISO strings.
- No secrets: never a password reset token, session token, or mail body.
- **Evolution is additive only.** New optional fields are fine. Renaming or removing a field is
  a new routing key (`…changed.v2`), because a consumer you do not control may be reading it.

## 4. Consumers

Every consumer:

1. **Restores tenant context, then opens the unit of work.** A consumer has no HTTP request, so
   it must read `tenantId` from the message, open `RequestContext`, and enter
   `UnitOfWorkService.execute(...)` before touching persistence. The root unit of work sets
   transaction-local `app.tenant_id` before repository work. Skipping this fails closed; it
   never grants cross-tenant access.
2. **Is idempotent.** Delivery is at-least-once. Claim the event in `processed_events` inside
   the same transaction as the side effect; the `@@unique([tenantId, eventId, consumer])`
   violation *is* the dedupe. This is the one sanctioned place to catch a Prisma error locally
   rather than let `mapPrismaException` shape it — it is control flow, not a failure, and it is
   confined to `src/infra/messaging/`.
3. **Never advances the workflow.** See §5.
4. **Tolerates out-of-order arrival.** Retries and concurrency mean arrival order is not
   causal order. Re-read current state from Postgres or compare `occurredAt`. Never accumulate
   state from message sequence — Art. VI.2 already says current status is the latest event row,
   and that read is authoritative over anything a message implies.

## 5. Orchestration, not choreography

`workflow_transitions` is a state machine encoded as data:
`(action, fromStatus, fromRole) → (toStatus, targetRole)`. It is the orchestrator.

> **The workflow engine decides; events only announce.** A consumer may send mail, write audit
> rows, or index a document. **A consumer must never trigger a workflow transition.**

If consumers advance the workflow, the system grows a second, implicit state machine in handler
code competing with the explicit one in the table. Two answers to "what happens next", and the
question *"why was this bid rejected?"* stops having a single place to look.

## 6. What never goes on the bus

Anything the HTTP response depends on · authorization decisions · read queries · anything
needing a transaction with the caller. Those stay synchronous through the shared kernel.

If a module needs an **answer**, that is not an event. Either the data belongs in the shared
kernel, or the boundary is drawn in the wrong place.

---

## 7. Assertion catalogue

Copy into any module's `tasks.md`. These are the enforcement, verbatim.

```bash
# No feature module imports another module's service, provider, or repository
test $(grep -rlE "from '\.\.?/(\.\./)?(auth|user|company|role-permission)/[^']*(service|provider|repositor)" src --include=*.ts | grep -vE "^src/(common|infra|contracts)/|^src/app\.module\.ts" | wc -l) -eq 0

# End state: no cross-module import of any kind (clears once guards move to src/common/security/)
test $(grep -rlE "from '\.\.?/(\.\./)?(auth|user|company|role-permission)/" src --include=*.ts | grep -vE "^src/(common|infra|contracts)/|^src/app\.module\.ts" | wc -l) -eq 0

# Only src/infra/messaging talks to the broker
test $(grep -rlE "amqplib|amqp-connection-manager|amqp\.connect" src --include=*.ts | grep -v "^src/infra/messaging/" | wc -l) -eq 0

# No routing key or exchange literal outside contracts and messaging infra
test $(grep -rlE "portal\.events" src --include=*.ts | grep -vE "^src/(contracts|infra/messaging)/" | wc -l) -eq 0

# Event contracts carry no Prisma, Nest, or broker types
! grep -rqE "generated/prisma|@nestjs/|amqplib|bullmq" src/contracts/

# Event contracts carry no Date fields (ISO strings cross the wire)
! grep -rqE ":\s*Date\b" src/contracts/

# The outbox write joins the unit of work
grep -q "extends BaseRepository" src/infra/messaging/outbox.repository.ts

# The outbox repository does not take PrismaService
! grep -q "PrismaService" src/infra/messaging/outbox.repository.ts

# Consumers restore tenant context and enter the unit of work before persisting
test $(for f in $(find src -name "*.handler.ts" 2>/dev/null); do grep -q "RequestContext" $f && grep -qE "unitOfWork\.execute|this\.transaction" $f || echo $f; done | wc -l) -eq 0

# No consumer advances the workflow
test $(grep -rlE "WorkflowTransition|advanceWorkflow|applyTransition" src --include=*.handler.ts 2>/dev/null | wc -l) -eq 0
```

`src/app.module.ts` is exempt: a composition root wiring feature modules together is its job,
not a boundary violation. Nothing else is exempt.

**Known failures today**, both unticked tasks in module 02 Phase 8, not exceptions:

| File | Imports | Fix |
|---|---|---|
| `user/providers/user-mutation.provider.ts` | `AuthHashingProvider` | `PASSWORD_HASHER` port in `src/infra/crypto/` |
| `role-permission/role-permission.controller.ts` | `type SessionUser` | move the shape to `src/contracts/` |

The end-state assertion additionally flags five files that import auth **guards**. Those clear
when guards move to `src/common/security/` — the same Phase 8.
