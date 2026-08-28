# API Contract: 02 — Infrastructure

This module exposes **no HTTP routes**. Its contract is the set of injectable surfaces other
modules consume, plus the one response behavior it adds to every route.

---

## 1. Injection tokens

| Token | Interface | Adapter | Exported by |
|---|---|---|---|
| `MAIL_QUEUE` | BullMQ `Queue` | `MailQueueService` | `MailModule` |
| `MAIL_SENDER` | `MailSender` | `NodemailerMailSender` | `MailModule` |
| `TEMPLATE_RENDERER` | `TemplateRenderer` | `HandlebarsTemplateRenderer` | `MailModule` |
| `REDIS_CLIENT` | `ioredis` `Redis` | — | `RedisModule` (`@Global`) |
| — | `RedisService` | — | `RedisModule` (`@Global`) |

Consumers inject the **token**, typed as the interface:

```typescript
constructor(@Inject(MAIL_QUEUE) private readonly mail: Queue) {}
```

Never `constructor(private readonly sender: NodemailerMailSender)`. That compiles and defeats
the entire arrangement.

---

## 2. Cache surface — `RedisService`

| Method | Signature |
|---|---|
| `get` | `<T>(key, codec?) => Promise<T \| null>` |
| `set` | `<T>(key, value, ttlSeconds?, codec?) => Promise<void>` |
| `delete` | `(...keys: string[]) => Promise<number>` |
| `remember` | `<T>(key, factory, ttlSeconds?, codec?) => Promise<T>` |

- Default codec is JSON. Supply a `RedisCacheCodec<T>` for anything else.
- Default TTL is `REDIS_DEFAULT_TTL_SECONDS`; always pass one explicitly for domain data.
- Every key is automatically prefixed with `REDIS_KEY_PREFIX` (default `project-portal:`) by
  the `ioredis` client. **Do not repeat the prefix in your key** — it will be applied twice.
- `remember` treats `null` as a miss, so a legitimately-null value is never cached.

---

## 3. Mail surface

Enqueue with the job name `MAIL_JOB_NAME` (`'send-mail'`). Any other name makes the worker
throw.

```typescript
await this.mailQueue.add(MAIL_JOB_NAME, {
  to: 'someone@example.com',
  subject: 'Work request assigned',
  htmlTemplate: '<p>Hello {{name}}</p>',   // rendered by the worker
  templateContext: { name: 'Jane' },
} satisfies MailJobData);
```

`MailJobData` = `MailMessage` (`to`, `subject`, `text?`, `replyTo?`) plus `htmlTemplate?`,
`templateContext?`, `html?`. If `htmlTemplate` is present the worker renders it and ignores
`html`.

Job defaults: 5 attempts, exponential backoff from 1 000 ms, keep last 1 000 completed and
5 000 failed. Worker concurrency 5.

**Rendering happens in the worker, not the producer.** Enqueue the template and its context,
not a rendered string — otherwise a template fix requires draining the queue.

---

## 4. Rate limiting — the one HTTP behavior

`ThrottlerGuard` is registered as a global `APP_GUARD`, so it applies to every route without
per-controller opt-in.

| Setting | Env | Default |
|---|---|---|
| Window | `THROTTLE_TTL_MS` | 60 000 ms |
| Limit | `THROTTLE_LIMIT` | 100 requests |

On exceeding the limit: **429**, mapped by module 00's filter to `RATE_LIMIT_EXCEEDED`. A
block key is set for `blockDuration` (falling back to the window length) so a client that
blows through the limit stays blocked rather than resuming at the next increment.

Keys are `throttle:{name}:{key}` under the global Redis prefix, with a parallel
`…:blocked` key.

To exempt a route, use `@SkipThrottle()`; to tighten one, `@Throttle({...})`. Both are
`@nestjs/throttler` decorators — do not add a second guard.

---

## 5. Configuration

| Variable | Default | Consumed by |
|---|---|---|
| `REDIS_URL` | `redis://127.0.0.1:6379` | client, queue, worker |
| `REDIS_KEY_PREFIX` | `project-portal:` | client |
| `THROTTLE_TTL_MS` | `60000` | throttler |
| `THROTTLE_LIMIT` | `100` | throttler |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_SECURE` | `localhost` / `1025` / `false` | sender |
| `SMTP_USER` / `SMTP_PASSWORD` | unset | sender (omitted when blank) |
| `MAIL_FROM` | `Project Portal <no-reply@example.com>` | sender |
| `MAIL_QUEUE_NAME` | `mail` | queue + worker |
| `MAIL_WORKER_ENABLED` | `false` | worker only |

The BullMQ connection sets `maxRetriesPerRequest: null`, which BullMQ requires; the cache
client uses `3`. They are deliberately different and share no connection.

Local Redis: `docker compose up -d` (see `docker-compose.yml`).
