# Technical Plan: 02 — Infrastructure

**Status:** Approved (retro-spec)
**Related Spec:** `specs/02-infrastructure/SPEC.md`
**Contracts:** `API_CONTRACT.md`

---

## 1. Module Tree

```
src/infra/
├── redis/
│   ├── redis.module.ts           # @Global — REDIS_CLIENT factory + RedisService
│   ├── redis.service.ts          # get/set/delete/remember, closes on shutdown
│   ├── redis-cache-codec.ts      # RedisCacheCodec<T> + JsonRedisCacheCodec
│   └── redis.constants.ts        # REDIS_CLIENT, REDIS_DEFAULT_TTL_SECONDS
├── throttler/
│   ├── throttler.module.ts       # NestThrottlerModule.forRootAsync + APP_GUARD
│   ├── redis-throttler.storage.ts# Lua increment/block script
│   └── throttler.constants.ts
└── mail/
    ├── mail.module.ts            # ports bound to adapters via useExisting
    ├── mail-workers.module.ts    # worker only; separated so it can be omitted
    ├── mail-queue.service.ts     # extends BullMQ Queue
    ├── mail.worker.ts            # BullMQ Worker, gated by MAIL_WORKER_ENABLED
    ├── mail-sender.port.ts       # MAIL_SENDER symbol + MailSender/MailMessage
    ├── template-renderer.port.ts # TEMPLATE_RENDERER symbol + TemplateRenderer
    ├── nodemailer-mail-sender.ts
    ├── handlebars-template-renderer.ts
    └── mail.constants.ts         # MAIL_QUEUE, MAIL_JOB_NAME
```

`MailModule` and `MailWorkersModule` are separate so a deployment can register the producer
without the consumer. Today both are in `AppModule` and the worker self-disables on the env
flag — which is the same outcome by a different lever, and the simpler one to operate.

---

## 2. Throttler storage

One Lua script does increment, TTL read, and block check in a single round trip:

```
INCR key
  └─ if 1 → PEXPIRE key ttl
PTTL key
EXISTS blockKey ?
  ├─ yes → blocked, PTTL blockKey
  └─ no  → current > limit ? SET blockKey PX blockDuration, blocked
returns { totalHits, timeToExpire, isBlocked, timeToBlockExpire }
```

Atomicity matters: read-then-write from Node would let concurrent requests interleave past
the limit. The script is passed to `eval` on every call rather than `evalsha` — one extra
round trip's worth of payload, no script-cache management. Revisit only if it shows up in a
profile.

---

## 3. Mail flow

```
producer ──add(MAIL_JOB_NAME, MailJobData)──► Redis (BullMQ)
                                                  │
                              MAIL_WORKER_ENABLED=true
                                                  ▼
                                            MailWorker.process
                                                  │
                          htmlTemplate ? renderer.render(tpl, ctx) : html
                                                  ▼
                                          sender.send(message)
                                                  ▼
                                          { messageId }
```

The worker asserts `job.name === MAIL_JOB_NAME` and throws otherwise, so an unrelated
producer on the same queue name fails loudly instead of being processed as mail.

`HandlebarsTemplateRenderer` caches compiled templates in a `Map` keyed by the template
**source string**. Fine for a bounded set of templates; if templates ever become user-supplied
this becomes an unbounded cache and needs a key change.

---

## 4. Shutdown

| Provider | Hook | Action |
|---|---|---|
| `RedisService` | `onApplicationShutdown` | `quit()` unless already ended |
| `MailQueueService` | `onApplicationShutdown` | `close()` |
| `MailWorker` | `onApplicationShutdown` | `worker?.close()` |

All three depend on module 00's `enableShutdownHooks()`. Without it they are never called and
the process hangs on SIGTERM holding Redis connections.

---

## 5. Errors

| Case | Thrown | Result |
|---|---|---|
| Limit exceeded | `ThrottlerException` | 429 `RATE_LIMIT_EXCEEDED` |
| SMTP failure | adapter error | job retried, then failed + logged |
| Unknown job name | `Error` | job fails, not retried into success |
| Missing template variable | Handlebars strict error | job fails, surfaced in the failed set |

None of these reach a request thread except the throttler.
