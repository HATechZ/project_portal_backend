# Data Contract: 02.1 — Messaging & Domain Events

Its sibling module 02 owns no Postgres table at all — Redis, the throttler, and the mail queue
keep their state outside the database. Messaging cannot: a transactional outbox is by
definition a table, because its entire purpose is to be written in the same transaction as the
domain fact it describes.

Both tables below are **new**. They do not exist in
`project_portal_workflow_management_erd.dbml` and are not part of the 63-table ERD count.

Governed by [Art. IX](../rules/08-database.md) (propose only) and
[Art. XI](../rules/10-messaging.md) (why these shapes).

---

## 1. Tables owned

| Table | Prisma model | Status | Purpose |
|---|---|---|---|
| `outbox_messages` | `OutboxMessage` | **proposed** | Atomic publish + permanent event trace. |
| `processed_events` | `ProcessedEvent` | **proposed** | Consumer dedupe under at-least-once delivery. |

---

## 2. Proposed schema change

### 2.1 `outbox_messages`

One table serving two jobs — outbox *and* trace. Rows are never deleted on publish, only
stamped; the relay's hot query stays cheap through a partial index (§2.3), so an unbounded
trace costs nothing on the write path.

| Field | Type | Null | Note |
|---|---|---|---|
| `tenantId` | `String @db.Uuid` | no | FK → `tenants.id`, `onDelete: Restrict` |
| `id` | `String @db.Uuid` | no | `@id`, app-generated. **This is `eventId` on the wire.** |
| `eventType` | `VarChar(160)` | no | contract class name, e.g. `WorkRequestStatusChanged` |
| `routingKey` | `VarChar(160)` | no | e.g. `work-request.status.changed` |
| `payload` | `Json @db.JsonB` | no | IDs and primitives only (Art. XI §3) |
| `actorId` | `String @db.Uuid` | **yes** | FK → `actor_profiles.id`; null for system-originated events |
| `correlationId` | `String @db.Uuid` | **yes** | the originating request id from `RequestContext` |
| `occurredAt` | `Timestamp(6)` | no | `@default(now())` |
| `publishedAt` | `Timestamp(6)` | **yes** | null ⇒ not yet relayed. **The queue is this column.** |
| `attempts` | `Int` | no | `@default(0)`, incremented by the relay |
| `lastError` | `Text` | **yes** | last relay failure, for triage |

Indexes: `[tenantId]`, `[occurredAt]`, `[eventType]`, plus the partial index in §2.3.

`actorId` is nullable and deliberately **not** required: the relay must be able to publish
events raised by scheduled jobs, which have no acting profile. Matching `system_audit_logs`,
where `performedByActorId` is nullable for the same reason.

### 2.2 `processed_events`

| Field | Type | Null | Note |
|---|---|---|---|
| `tenantId` | `String @db.Uuid` | no | FK → `tenants.id`, `onDelete: Restrict` |
| `id` | `String @db.Uuid` | no | `@id`, app-generated |
| `eventId` | `String @db.Uuid` | no | the `outbox_messages.id` that was delivered |
| `consumer` | `VarChar(120)` | no | logical consumer name, e.g. `notifications` |
| `processedAt` | `Timestamp(6)` | no | `@default(now())` |

**`@@unique([tenantId, eventId, consumer])` is the load-bearing constraint** — it *is* the
idempotency mechanism, not merely an integrity check. The consumer inserts this row in the
same transaction as its side effect; a redelivery fails the constraint and is skipped.

No FK to `outbox_messages`: a consumer must stay able to dedupe an event whose outbox row has
been pruned, and once the transport is out-of-process the event may not have originated here
at all.

Indexes: `[tenantId]`, `[processedAt]` (for pruning).

### 2.3 Raw SQL the schema cannot express

Prisma has no syntax for a partial index. This must be appended by hand to the generated
migration:

```sql
CREATE INDEX outbox_messages_unpublished_idx
  ON outbox_messages (occurred_at)
  WHERE published_at IS NULL;
```

Without it the relay's `WHERE published_at IS NULL` degrades to a full scan that grows with
total event history rather than with the backlog. With it, the index holds only unpublished
rows and stays small permanently.

**This SQL lives only in the migration file.** `prisma/schema.prisma` is regenerated from the
DBML and will never carry it — so a schema regeneration cannot restore it, and it must not be
assumed present. Assert it explicitly.

### 2.4 What breaks without this change

| Missing | Consequence |
|---|---|
| `outbox_messages` | Publishing happens inside the transaction. A rollback after publish announces a fact that never occurred, and nothing retracts it. Silent, and unfixable by retry — the ordering is wrong, not the reliability. |
| `processed_events` | At-least-once delivery reaches handlers unguarded. A redelivered `WorkRequestStatusChanged` sends a duplicate email and writes a duplicate audit row. |
| the partial index | Works correctly, degrades continuously. Invisible until the trace is large, then the relay slows on every tick. |

### 2.5 Retention

Both tables grow without bound. Volume is human-driven workflow, not telemetry, so this is a
low-urgency concern — but it is a real one, and no pruning job is proposed here. Deferred
deliberately to module 13 (Audit), which owns retention policy across the system.

---

## 3. Status — schema written, nothing applied

**The owner waived Art. IX for this change on 2026-08-28** and directed the models to be written
into `prisma/schema.prisma` directly. Both are now in the schema and in the generated client;
`prisma format` and `prisma validate` pass.

**No migration exists and nothing has been applied to any database.** The tables are not real
yet — only the schema and the TypeScript client know about them.

```bash
yarn prisma:migrate --name add_messaging_outbox
```

Then append the partial index from § 2.3 to the generated migration file before it is applied
anywhere shared.

### 3.1 The DBML pipeline was bypassed, and why

Module 01 makes the DBML the schema authority. It could not be used here:

- `project_portal_workflow_management_erd.dbml` is **deleted from the working tree** (a staged
  deletion), so `scripts/dbml-to-prisma.cjs` cannot run at all.
- The copy in `HEAD` is **stale**. Regenerating from it reintroduces the `prime_consultant`
  actor role and the `MARKETING_SEND_CLIENT_REVISION_TO_PM` action code, both of which migration
  `20260821000000_remove_abandoned_role_and_action` deliberately removed.

**Consequence: running `node scripts/dbml-to-prisma.cjs` today would delete both models above
and revert that migration's intent.** Restore an accurate DBML and add these two tables to it
before the generator is run again.
