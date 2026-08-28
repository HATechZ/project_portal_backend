# Tasks: 02 — Infrastructure

**Status:** Gate 4 complete, Gate 5 pending walkthrough
**Spec Reference:** `specs/02-infrastructure/SPEC.md`
**Plan Reference:** `specs/02-infrastructure/plan.md`

> Governed by [`specs/RULES.md`](../RULES.md) **[Article II](../rules/02-proof.md)**. Run:
>
> ```bash
> yarn verify:sdd --module 02
> ```

---

- [x] **Phase 1: Redis cache**
  - [x] Provide a namespaced, lazily-connecting client so boot does not depend on Redis
        VERIFY: grep -q "lazyConnect: true" src/infra/redis/redis.module.ts && grep -q "keyPrefix" src/infra/redis/redis.module.ts
  - [x] Expose the cache globally so feature modules need no import
        VERIFY: grep -q "@Global()" src/infra/redis/redis.module.ts && grep -q "REDIS_CLIENT" src/infra/redis/redis.constants.ts
  - [x] Offer a read-through helper with a pluggable codec
        VERIFY: grep -q "async remember" src/infra/redis/redis.service.ts && grep -q "RedisCacheCodec" src/infra/redis/redis-cache-codec.ts
  - [x] Close the client on shutdown
        VERIFY: grep -q "OnApplicationShutdown" src/infra/redis/redis.service.ts && grep -q "quit()" src/infra/redis/redis.service.ts

- [x] **Phase 2: Distributed rate limiting**
  - [x] Register the throttler as a global guard rather than per controller
        VERIFY: grep -q "APP_GUARD" src/infra/throttler/throttler.module.ts && grep -q "ThrottlerGuard" src/infra/throttler/throttler.module.ts
  - [x] Back the throttler with Redis so the limit holds across instances
        VERIFY: grep -q "provide: ThrottlerStorage" src/infra/throttler/throttler.module.ts && grep -q "RedisThrottlerStorage" src/infra/throttler/throttler.module.ts
  - [x] Make increment-and-block atomic in one round trip
        VERIFY: grep -q "INCR" src/infra/throttler/redis-throttler.storage.ts && grep -q "PEXPIRE" src/infra/throttler/redis-throttler.storage.ts && grep -q "eval(" src/infra/throttler/redis-throttler.storage.ts
  - [x] Drive the window and limit from configuration
        VERIFY: grep -q "throttler.ttlMs" src/infra/throttler/throttler.module.ts && grep -q "THROTTLE_LIMIT" src/config/env.schema.ts

- [x] **Phase 3: Mail pipeline**
  - [x] Bind consumers to ports, not concrete adapters
        VERIFY: grep -q "Symbol('MAIL_SENDER')" src/infra/mail/mail-sender.port.ts && grep -q "Symbol('TEMPLATE_RENDERER')" src/infra/mail/template-renderer.port.ts && grep -q "useExisting" src/infra/mail/mail.module.ts
  - [x] Retry failed sends with exponential backoff instead of dropping them
        VERIFY: grep -q "attempts: 5" src/infra/mail/mail-queue.service.ts && grep -q "type: 'exponential'" src/infra/mail/mail-queue.service.ts
  - [x] Run the worker only where it is explicitly enabled
        VERIFY: grep -q "if (!mail.workerEnabled) return" src/infra/mail/mail.worker.ts && grep -q "MAIL_WORKER_ENABLED" src/config/env.schema.ts
  - [x] Reject job names the worker does not own
        VERIFY: grep -q "Unsupported mail job" src/infra/mail/mail.worker.ts
  - [x] Render templates in the worker so a template fix needs no queue drain
        VERIFY: grep -q "renderer.render" src/infra/mail/mail.worker.ts
  - [x] Close queue and worker on shutdown
        VERIFY: grep -q "OnApplicationShutdown" src/infra/mail/mail-queue.service.ts && grep -q "worker?.close()" src/infra/mail/mail.worker.ts

- [x] **Phase 4: Local development**
  - [x] Provide a Redis service for local work with persistence and a healthcheck
        VERIFY: grep -q "redis:7" docker-compose.yml && grep -q "healthcheck" docker-compose.yml
