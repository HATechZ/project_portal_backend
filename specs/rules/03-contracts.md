# Article III — Contract Extraction `[ALL]`

Read at Gate 1, when drafting a contract. Card: [`../RULES.md`](../RULES.md).

Before drafting any `SPEC.md`, `plan.md`, or task, record the contracts the module binds to.
At least one of the two files is required; most modules need both.

## `DATA_CONTRACT.md` — what the module persists

| Section | Contents |
|---|---|
| Tables owned | As named in the ERD and in `schema.prisma` |
| Enums consumed | By their `@@map` name |
| Relations | FK direction, and which module owns the other side |
| Derived state | If any — see [`06-standards.md`](06-standards.md) §2 |
| Migration impact | New tables, altered columns, backfills |

## `API_CONTRACT.md` — what the module exposes

| Section | Contents |
|---|---|
| Routes | Fully qualified `/api/v1/<path>`, method, path and query params |
| DTOs | `class-validator` rules, request and response |
| Envelope | Success shape and every `AppErrorCode` the endpoint can emit |
| Authorization | Permitted `ActorRoleCode` values, and the `WorkflowActionCode` where one applies |

Modules 00–02 own no tables and carry only an `API_CONTRACT.md`, which documents the
conventions every other module inherits. A module contract states only its **deviations**
from `specs/00-platform-core/API_CONTRACT.md`.

## Source of record, in order

1. **`project_portal_workflow_management_erd.dbml`** — the authority on the data model,
   upstream of `prisma/schema.prisma`.
2. **`prisma/schema.prisma`** — for the exact Prisma model and field names the code will use.
   `grep` it; never `Read` it whole (~22K tokens).
3. **Existing code under `src/`** — for the platform conventions the module must inherit.

Never describe a contract from recall. Read the DBML and the schema.
