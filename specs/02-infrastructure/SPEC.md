# SPEC: 02 — Infrastructure

**Status:** Approved (retro-spec) · **Tables:** — · **Contracts:** `API_CONTRACT.md`

Three services every domain module leans on and none should reimplement: a Redis cache, a
Redis-backed rate limiter, and an outbound mail pipeline on BullMQ. Two organizing decisions:

1. **Ports and adapters via symbol tokens.** `MAIL_SENDER`, `TEMPLATE_RENDERER`, `MAIL_QUEUE`
   are injection tokens. Consumers depend on the interface; adapters are swappable. Module 12
   will be the first real consumer and must not import `NodemailerMailSender` directly.
2. **Rate limiting is shared state.** An in-memory throttler multiplies the effective limit by
   the instance count; the Lua-script storage makes the configured limit the actual limit.

## User stories

| | As a | I want | So that |
|---|---|---|---|
| US-01 | operator | the rate limit to hold across instances | scaling out does not silently weaken it |
| US-02 | developer sending mail | to enqueue rather than block on SMTP | a slow mail server is not a slow API |
| US-03 | operator | API and worker from one image | deployment differs only by env variable |

## Domain rules

| # | Rule | Enforced by |
|---|---|---|
| DR-01 | Rate-limit counters live in Redis, never process memory | `RedisThrottlerStorage` as `ThrottlerStorage` |
| DR-02 | Increment-and-check is atomic | one Lua script, one round trip |
| DR-03 | Mail is enqueued, never sent inline from a request | `MAIL_QUEUE` is the only entry point |
| DR-04 | A worker runs only where explicitly enabled | `MAIL_WORKER_ENABLED` in `onModuleInit` |
| DR-05 | Consumers depend on ports, not adapters | symbol tokens + `useExisting` |
| DR-06 | Every long-lived connection closes on shutdown | `OnApplicationShutdown` ×3 |
| DR-07 | Redis keys are namespaced so environments can share a server | `keyPrefix` from config |

## Failure modes

| Condition | Effect |
|---|---|
| Rate limit exceeded | 429 `RATE_LIMIT_EXCEEDED`, block key set with PX |
| Redis unreachable | `ioredis` retries 3× per request; the guard then errors |
| SMTP rejects a message | Job retried 5×, exponential backoff from 1s |
| Still failing after 5 attempts | Retained in the failed set (cap 5 000) and logged |
| Unknown job name | Worker throws — the job fails rather than being silently dropped |
| Template variable missing | Handlebars `strict: true` throws rather than rendering blank |

## EARS acceptance criteria

- `[AC-U01]` Rate-limit state SHALL be shared across all instances.
- `[AC-U02]` Mail SHALL be delivered through the queue, never synchronously within a request.
- `[AC-E01]` WHEN a client exceeds the limit, the system SHALL return 429 and set a block key.
- `[AC-E02]` WHEN a mail job fails, the system SHALL retry with exponential backoff up to 5 attempts.
- `[AC-E03]` WHEN the process receives a shutdown signal, it SHALL close the Redis client, queue, and worker.
- `[AC-S01]` WHILE `MAIL_WORKER_ENABLED` is false, the process SHALL enqueue jobs but consume none.
- `[AC-W01]` IF a template references a missing variable, THEN rendering SHALL throw rather than emit an empty span.
- `[AC-W02]` IF Redis is unavailable at boot, THEN the client SHALL NOT block startup (`lazyConnect`).

## Out of scope

What to send and to whom (12) · per-query cache policy (owning module) · object storage (08).
