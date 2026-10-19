# Plan: 10.1 — Shared Document Upload & Versioning

**Status:** Phase 5 and the non-DB Phase 6 contract/tests are complete. The three pending Document migrations were manually applied; DB-runtime verification remains deferred because this repository has no isolated integration/E2E fixture or cleanup harness. **Related contracts:** `SPEC.md`, `API_CONTRACT.md`, `DATA_CONTRACT.md`.

## Design

Introduce a shared document pipeline behind ports/providers, called by parent-specific controllers/services/repositories. Controllers remain parent routes and run no queries. Parent modules retain authorization and object-scope resolution; the pipeline receives an already scoped parent context plus a command mode (`new-document` or `new-version`) and never imports a parent feature module. It uses the existing storage port, current naming helpers, UnitOfWork, audit/outbox convention, and durable cleanup mechanism.

The pipeline validates request mapping/file policy/code scope, creates storage metadata/keys, stores bytes, coordinates a single persistence UnitOfWork, compensates on failure, and returns safe document/version DTOs. Repositories perform tenant-qualified parent/document lineage lookup and append-only version allocation with conflict handling. A parent-specific policy adapter supplies the current naming context and producer/state check; it cannot infer lineage from filenames.

## Implementation phases

1. **Shared document foundation / reuse audit** — extract common validation, safe names, storage/key, naming adapter, audit and cleanup contracts from the current three create paths; align the Bid helper to official Document Code name snapshots and add the Direct Project naming adapter.
2. **New-document upload** — add the three parent-specific `POST .../documents` routes and repository writes for a new logical document plus initial immutable version.
3. **New-version upload** — add the three parent-specific version routes, tenant/parent lineage proof, inherited code, immutable append, chronological read DTOs, and Work Request producer/state enforcement.
4. **Create-time migration** — add approved Direct Project POL/POD/Cargo/Vessel/shipment/project-code persistence and snapshots, then route Bid, Direct Project, and Work Request create-time `files[]` through the shared new-document pipeline; remove duplicate upload/naming/version logic only after behavior parity tests pass.
5. **Permissions, scope, audit, idempotency** — bind existing actions, object scope, assignment/state rules, request ID/idempotency, outbox audit, and failed-cleanup durability; introduce no role-name bypass.
6. **Tests / contract freeze** — unit/contract tests for mapping, lineage, same-name separation, generated-name reupload, immutable history, tenant isolation, parent mismatch, state lock/return, compensation, and safe read shapes; then freeze API/data contracts.

## Explicit constraints

No schema/migration/seed work occurs in this specification phase. Any later schema reshape is delegated under Article IX and follows the proposed data contract. No generic document API, frontend persistence model, folder-tree schema, or company-specific workflow implementation is added.
