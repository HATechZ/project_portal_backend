# SPEC: 00 — Platform Core

**Status:** Approved (retro-spec) · **Tables:** — · **Contracts:** `API_CONTRACT.md`

The HTTP contract every other module inherits: request identity, response shape, error→status
mapping, configuration, self-documentation. Owns no tables and no domain logic. A module that
builds its own envelope, catches its own Prisma errors, or reads `process.env` has broken the
platform, not just itself.

## User stories

| | As a | I want | So that |
|---|---|---|---|
| US-01 | API consumer | one predictable envelope | clients parse success and failure without per-endpoint cases |
| US-02 | operator | every request and log line correlatable by one id | a user's failure report reaches a stack trace |
| US-03 | module developer | typed, boot-validated configuration | a missing variable fails the process, not a request at 3am |

## Domain rules

| # | Rule | Enforced by |
|---|---|---|
| DR-01 | Success is `{ success, data, meta }`; controllers never build it | `ResponseInterceptor` |
| DR-02 | Errors are `{ success: false, error, meta }`, whatever was thrown | `HttpExceptionFilter` (`@Catch()`) |
| DR-03 | Every request carries `x-request-id`, generated if absent, echoed back | `RequestIdInterceptor` |
| DR-04 | Unknown body properties are rejected, not stripped | global `ValidationPipe` |
| DR-05 | `process.env` is read in exactly one file | `configuration.ts` |
| DR-06 | The process refuses to boot on invalid configuration | Joi schema in `ConfigModule` |
| DR-07 | Page size is clamped to 100 whatever the client asks | `paginate.ts` |

## Failure modes

| Condition | HTTP | `AppErrorCode` |
|---|---|---|
| DTO validation fails / unknown property | 400 | `BAD_REQUEST` |
| Unique constraint (P2002) | 409 | `CONFLICT` |
| FK constraint (P2003) | 409 | `DATABASE_CONSTRAINT` |
| Record not found (P2025) | 404 | `NOT_FOUND` |
| Rate limit exceeded | 429 | `RATE_LIMIT_EXCEEDED` |
| Database unreachable | 503 | `SERVICE_UNAVAILABLE` |
| Anything else | 500 | `INTERNAL_ERROR` |

## EARS acceptance criteria

- `[AC-U01]` The API SHALL expose every route under `/api/v1`.
- `[AC-U02]` The API SHALL return the success envelope on every 2xx.
- `[AC-U03]` The API SHALL return the error envelope on every 4xx and 5xx.
- `[AC-U04]` The API SHALL echo an `x-request-id` header on every response.
- `[AC-E01]` WHEN a request arrives without `x-request-id`, the system SHALL generate a UUID.
- `[AC-E02]` WHEN a body carries an undeclared property, the system SHALL reject it with 400.
- `[AC-S01]` WHILE returning a 5xx, the system SHALL log method, URL, and stack.
- `[AC-W01]` IF a required env variable is missing or malformed, THEN the process SHALL fail to start.
- `[AC-W02]` IF a client requests a page size above 100, THEN the system SHALL clamp rather than error.

## Out of scope

Auth (03) · rate-limit storage and cache (02) · database connection and transactions (01).
