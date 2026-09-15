# Tasks: 02.1 — Messaging & Domain Events

**Status:** Gate 4 — Phases 5, 6 (all but partial index), 7, 8, 9 (lint/build) complete
**Spec Reference:** `specs/02.1-messaging/SPEC.md`
**Plan Reference:** `specs/02.1-messaging/plan.md`

> Governed by [`specs/RULES.md`](../RULES.md) **[Article II](../rules/02-proof.md)** — every leaf task
> carries a `VERIFY:` line. A task is ticked **only** when its command exits 0. Run:
>
> ```bash
> yarn verify:sdd --module 02.1
> ```
>
> **Phases 5 and 8 are done. Phase 6 is done bar two tasks**, both blocked on work outside this
> module: the partial index needs a migration, and the idempotent-claim assertion also forbids
> `P2002` outside `src/infra/` — three feature providers still catch it (Art. VI.4 debt in
> modules 03 and 04). Phase 7 stays deferred until module 12 provides a second consumer.
>
> **Nothing has been run against a database.** Every assertion below is static; the outbox is
> proven to compile and to be wired, not to work. That is Gate 5's job.

---

- [x] **Phase 5: Contracts and the seam** (no schema, no broker — buildable today)
  - [x] Define the shared event base carrying identity, tenant, and causality
        VERIFY: test -f src/contracts/events/domain-event.ts && grep -q "eventId" src/contracts/events/domain-event.ts && grep -q "correlationId" src/contracts/events/domain-event.ts
  - [x] Keep contracts free of framework, ORM, and transport types
        VERIFY: ! grep -rqE "generated/prisma|@nestjs/|amqplib|bullmq" src/contracts/
  - [x] Carry timestamps as ISO strings so the wire format needs no serializer
        VERIFY: ! grep -rqE ":\s*Date\b" src/contracts/
  - [x] Declare the transport as a port rather than a class
        VERIFY: grep -q "Symbol('EVENT_TRANSPORT')" src/infra/messaging/event-transport.port.ts
  - [x] Keep the transport port narrow (Art. X §4)
        VERIFY: test $(grep -cE "^  [a-zA-Z]+.*\(.*\).*:" src/infra/messaging/event-transport.port.ts) -le 5
  - [x] Register the in-process transport behind the token
        VERIFY: grep -q "EVENT_TRANSPORT" src/infra/messaging/messaging.module.ts && grep -qE "useExisting|useClass" src/infra/messaging/messaging.module.ts
  - [x] Deliver in-process through the CQRS bus so handlers are transport-agnostic
        VERIFY: grep -q "CqrsModule" src/infra/messaging/messaging.module.ts && grep -q "EventBus" src/infra/messaging/in-process-event.transport.ts

- [ ] **Phase 6: Transactional outbox** (11/13 — see the two notes above)
  - [x] Land both models in the generated schema
        VERIFY: grep -q "model OutboxMessage" prisma/schema.prisma && grep -q "model ProcessedEvent" prisma/schema.prisma
  - [ ] Keep the relay's backlog query independent of total history
        VERIFY: grep -rq "outbox_messages_unpublished_idx" prisma/migrations/
  - [x] Write the outbox through the unit of work so it joins the producer's transaction
        VERIFY: grep -q "extends BaseRepository" src/infra/messaging/outbox.repository.ts && ! grep -q "PrismaService" src/infra/messaging/outbox.repository.ts
  - [x] Give producers one enqueue entry point and no transport access
        VERIFY: test -f src/infra/messaging/outbox.service.ts && ! grep -q "EVENT_TRANSPORT" src/infra/messaging/outbox.service.ts
  - [x] Rebuild the contract class from an outbox row so in-process handlers still match
        > `EventBus` routes on the published instance's constructor, so a row replayed as an
        > object literal reaches no handler. The relay needs `eventType` → class.
        VERIFY: test -f src/infra/messaging/event-registry.ts && grep -q "eventType" src/infra/messaging/event-registry.ts && grep -q "EVENT_REGISTRY" src/infra/messaging/messaging.module.ts
  - [x] Make the relay the only writer of `publishedAt`
        VERIFY: test $(grep -rl "publishedAt" src --include=*.ts | grep -vE "^src/(infra/messaging|generated)/" | wc -l) -eq 0 && grep -q "prisma.unscoped" src/infra/messaging/outbox-relay.service.ts && grep -q "DATABASE_URL_PRIVILEGED" src/config/env.schema.ts
  - [x] Retain failed publishes with their error rather than dropping them
        VERIFY: grep -q "attempts" src/infra/messaging/outbox-relay.service.ts && grep -q "lastError" src/infra/messaging/outbox-relay.service.ts
  - [x] Run the relay only where explicitly enabled
        VERIFY: grep -q "MESSAGING_RELAY_ENABLED" src/config/env.schema.ts && grep -q "MESSAGING_RELAY_ENABLED" .env.example
  - [x] Claim events idempotently, confining the P2002 catch to messaging infra
        VERIFY: grep -q "extends BaseRepository" src/infra/messaging/inbox.repository.ts && grep -q "P2002" src/infra/messaging/inbox.repository.ts && test $(grep -rl "P2002" src --include=*.ts | grep -vE "^src/(infra|common/exceptions)/" | wc -l) -eq 0
  - [x] Restore tenant context before a handler touches persistence
        VERIFY: grep -q "RequestContext.run" src/infra/messaging/event-handler.base.ts && grep -q "tenantId" src/infra/messaging/event-handler.base.ts && grep -q "unitOfWork.execute" src/infra/messaging/event-handler.base.ts
  - [x] Claim and side effect share one transaction so a failed handler retries cleanly
        VERIFY: grep -qE "unitOfWork\.execute|this\.transaction" src/infra/messaging/event-handler.base.ts
  - [x] Close the relay on shutdown
        VERIFY: grep -q "OnApplicationShutdown" src/infra/messaging/outbox-relay.service.ts

- [x] **Phase 7: RabbitMQ transport**
  - [x] Provide a broker for local work with persistence, credentials, and a healthcheck
        VERIFY: grep -q "rabbitmq:4" docker-compose.yml && grep -q "rabbitmq-diagnostics" docker-compose.yml && grep -q "rabbitmq-data" docker-compose.yml
  - [x] Confine every broker import to messaging infrastructure
        VERIFY: test $(grep -rlE "amqplib|amqp-connection-manager|amqp\.connect" src --include=*.ts | grep -v "^src/infra/messaging/" | wc -l) -eq 0
  - [x] Declare a durable topic exchange so bindings can overlap
        VERIFY: grep -q "'topic'" src/infra/messaging/rabbitmq-event.transport.ts && grep -q "durable: true" src/infra/messaging/rabbitmq-event.transport.ts
  - [x] Dead-letter rather than discard a poisoned message
        VERIFY: grep -q "x-dead-letter-exchange" src/infra/messaging/rabbitmq-event.transport.ts
  - [x] Carry tenant and causality in headers, never in the routing key
        VERIFY: grep -q "x-tenant-id" src/infra/messaging/rabbitmq-event.transport.ts && grep -q "x-correlation-id" src/infra/messaging/rabbitmq-event.transport.ts
  - [x] Keep exchange and routing-key literals out of feature modules
        VERIFY: test $(grep -rlE "portal\.events" src --include=*.ts | grep -vE "^src/(contracts|infra/messaging)/" | wc -l) -eq 0
  - [x] Select the transport by configuration rather than by code edit
        VERIFY: grep -q "MESSAGING_TRANSPORT" src/config/env.schema.ts && grep -q "MESSAGING_TRANSPORT" .env.example

- [x] **Phase 8: Close the existing cross-module couplings** (no schema, no broker — buildable today)
  - [x] Put password hashing behind a port both modules can depend on
        VERIFY: test -f src/infra/crypto/password-hasher.port.ts && grep -q "Symbol('PASSWORD_HASHER')" src/infra/crypto/password-hasher.port.ts
  - [x] Settle on one hashing implementation instead of shipping two
        VERIFY: test $(node -e "const d=require('./package.json').dependencies;console.log(['bcrypt','bcryptjs'].filter(p=>d[p]).length)") -eq 1
  - [x] Stop `user` from importing `auth`
        VERIFY: ! grep -rq "auth/providers" src/user/
  - [x] Move the shared session shape into contracts so no module imports another's repository
        VERIFY: ! grep -rq "auth/repositories" src/role-permission/
  - [x] Relocate guards to the shared kernel so modules stop importing `AuthModule`
        VERIFY: test -d src/common/security && test $(grep -rlE "from '[^']*auth/auth\.module'" src --include=*.module.ts | grep -v "^src/app\.module\.ts" | wc -l) -eq 0
  - [x] No feature module imports another module's service, provider, or repository
        VERIFY: test $(grep -rlE "from '\.\.?/(\.\./)?(auth|user|company|role-permission)/[^']*(service|provider|repositor)" src --include=*.ts | grep -vE "^src/(common|infra|contracts)/|^src/app\.module\.ts" | wc -l) -eq 0
  - [x] No feature module imports another feature module at all
        VERIFY: test $(grep -rlE "from '\.\.?/(\.\./)?(auth|user|company|role-permission)/" src --include=*.ts | grep -vE "^src/(common|infra|contracts)/|^src/app\.module\.ts" | wc -l) -eq 0

- [ ] **Phase 9: Sign-off**
  - [x] Register every new module in `PLACEHOLDERS.md`
        VERIFY: grep -q "src/infra/messaging/messaging.module.ts" specs/PLACEHOLDERS.md
  - [x] Lint and build clean
        VERIFY: yarn lint && yarn build
  - [ ] Record the HTTP walkthrough ([Art. V](../rules/05-walkthrough.md))
        VERIFY: test -f specs/02.1-messaging/walkthrough.md && grep -qi "PASS\|FAIL" specs/02.1-messaging/walkthrough.md
