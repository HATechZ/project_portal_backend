# API Contract: 00 — Platform Core

The conventions every other module's `API_CONTRACT.md` inherits. A module contract states
only its deviations from this document.

---

## 1. Route shape

```
/{apiPrefix}/v{version}/{resource}
```

- `apiPrefix` comes from `API_PREFIX`, default `api`, normalized by `normalizeApiPrefix`
  which strips a trailing `/v1` so the version is never doubled.
- Versioning is `VersioningType.URI` with `defaultVersion: '1'`.
- **Effective base path: `/api/v1`.**

Swagger UI is served at `/api/docs`, the raw document at `/api/docs-json`. Note these carry
the prefix but **not** the version segment.

---

## 2. Success envelope

```jsonc
{
  "success": true,
  "data": { /* whatever the handler returned */ },
  "meta": {
    "requestId": "0f3c…",       // omitted if no request context
    "timestamp": "2026-08-28T09:00:00.000Z"
  }
}
```

Applied by `ResponseInterceptor` to every handler return value. Two values pass through
untouched: a `StreamableFile`, and anything already shaped like an envelope.

**Paginated data** nests one level:

```jsonc
{
  "success": true,
  "data": {
    "items": [ /* … */ ],
    "meta": { "page": 1, "limit": 20, "total": 57, "totalPages": 3,
              "hasNextPage": true, "hasPreviousPage": false }
  },
  "meta": { "requestId": "…", "timestamp": "…" }
}
```

---

## 3. Error envelope

```jsonc
{
  "success": false,
  "error": {
    "code": "CONFLICT",              // AppErrorCode
    "message": "…",                  // string, or string[] from the ValidationPipe
    "details": { }                   // optional; Prisma meta for constraint errors
  },
  "meta": { "requestId": "…", "timestamp": "…" }
}
```

`AppErrorCode` values: `BAD_REQUEST`, `UNAUTHORIZED`, `FORBIDDEN`, `NOT_FOUND`, `CONFLICT`,
`VALIDATION_FAILED`, `RATE_LIMIT_EXCEEDED`, `DATABASE_CONSTRAINT`, `INTERNAL_ERROR`,
`SERVICE_UNAVAILABLE`.

Resolution order in `HttpExceptionFilter`:

1. `mapPrismaException(thrown)` — Prisma errors become `AppException`s first.
2. `AppException` → its own `code`, `message`, `details`.
3. `HttpException` → `code` from the payload if present, else derived from the status.
4. Anything else → 500 `INTERNAL_ERROR`, original message withheld from the client.

---

## 4. Headers

| Header | Direction | Behavior |
|---|---|---|
| `x-request-id` | in, optional | Accepted if 1–128 chars, else replaced with a fresh UUID |
| `x-request-id` | out, always | The id used for this request; also in `meta.requestId` |
| `ETag` | out, GET/HEAD | Weak SHA-256 of the serialized body, when under 1 MB |
| `If-None-Match` | in, optional | Matches the ETag → 304 |

> **Known deviation.** The ETag is computed *after* enveloping, so it hashes a body that
> contains a fresh `meta.timestamp`. It therefore changes on every request and the 304 branch
> is unreachable. Tracked as an unticked task in `tasks.md`.

---

## 5. Request validation

Global `ValidationPipe`: `transform: true`, `whitelist: true`, `forbidNonWhitelisted: true`,
`transformOptions.enableImplicitConversion: false`.

Consequences for every module:

- An undeclared body property is a 400, not a silent strip.
- Query params are strings unless the DTO declares `@Type(() => Number)`.
- `PaginationQueryDto` (`page`, `limit`) is the base for every list endpoint.

---

## 6. CORS & lifecycle

- Origins from `CORS_ORIGINS` (comma-separated). Empty list means `origin: false` — all
  cross-origin requests denied. Credentials are enabled.
- `enableShutdownHooks()` is on; providers implementing `OnApplicationShutdown` are awaited
  on SIGTERM. Modules 01 and 02 rely on this to close the DB pool, Redis, and BullMQ cleanly.
