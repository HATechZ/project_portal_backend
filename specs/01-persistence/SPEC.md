# SPEC: 01 — Persistence

**Status:** Approved (retro-spec) · **Tables:** — (owns the pipeline) · **Contracts:** `DATA_CONTRACT.md`

How this codebase gets a schema and how it writes. Two load-bearing decisions:

1. **The schema is generated, not authored.** The DBML is the source; `schema.prisma` is
   output. A hand edit vanishes on the next regeneration, silently and without conflict.
2. **Writes compose through a unit of work.** The active transaction lives in
   AsyncLocalStorage, so repositories join it without it being threaded through every
   signature.

## User stories

| | As a | I want | So that |
|---|---|---|---|
| US-01 | developer changing the model | one source of truth for the schema | the ERD and the code cannot disagree |
| US-02 | developer writing a multi-table op | repositories to join my transaction | atomicity is not call-site discipline |
| US-03 | operator | migrations applied before traffic | a deploy never serves against an old schema |

## Domain rules

| # | Rule | Enforced by |
|---|---|---|
| DR-01 | `schema.prisma` is generated output, never hand-edited | `dbml-to-prisma.cjs` overwrites it wholesale |
| DR-02 | The client is imported from `src/generated/prisma` | generator `output` + review |
| DR-03 | Connection strings are never in the schema; normal repositories use `app_user`, while only the relay uses the separate `app_relay` client | `prisma.config.ts` + `PrismaService` |
| DR-04 | Ids are application-generated UUIDs at insert time | no `@default(uuid())` in the schema |
| DR-05 | A transaction inside a transaction joins rather than nests | `UnitOfWorkService.execute` |
| DR-06 | Migrations are applied before the process serves traffic | `prestart*` scripts |

## Failure modes

| Condition | HTTP | `AppErrorCode` |
|---|---|---|
| Unique constraint violated | 409 | `CONFLICT` |
| FK constraint violated | 409 | `DATABASE_CONSTRAINT` |
| Record to update/delete missing | 404 | `NOT_FOUND` |
| Database unreachable at init | 503 | `SERVICE_UNAVAILABLE` |
| Transaction exceeds 15s | 500 | `INTERNAL_ERROR` |

Mapping lives in module 00; this module only guarantees the errors arrive there untouched.

## EARS acceptance criteria

- `[AC-U01]` The schema SHALL be reproducible from the DBML by one command.
- `[AC-U02]` Repositories SHALL read their executor from the unit of work, not a captured client.
- `[AC-E01]` WHEN a transaction opens inside an existing one, the system SHALL reuse the outer one.
- `[AC-E02]` WHEN the application starts, the system SHALL connect the normal application and separate privileged relay clients during module init.
- `[AC-S01]` WHILE no unit of work is active, direct repository executor access SHALL fail rather than fall back to a root client.
- `[AC-W01]` IF the database is unreachable at boot, THEN the process SHALL fail loudly rather than serve traffic.
- `[AC-W02]` IF a transaction exceeds its timeout, THEN it SHALL roll back rather than hold connections.

## Out of scope

Any specific table's shape (owning module) · caching (02) · seeding lookup tables (06).
