# Plan: 09 — Project

1. Approve and apply the independent Project persistence redesign, including shared neutral name claims, RLS, separate backfill, and catalog action grants for V1 reads/updates.
2. Build only `src/project`: multipart DTOs/controller, Project service/repository/mapper, status events, and focused tests.
3. In one UnitOfWork validate scoped Client, normalize/claim name, create Project plus ACTIVE event, and publish a Project-owned outbox event.
4. Validate optional binaries and per-file Document Code IDs; generate protected UUID storage keys through a storage port, persist metadata/link, generate a business filename only when sufficient Project naming inputs are approved, and compensate failed writes.
5. Implement only the independent list/detail/PATCH surface. A later explicit Project-file reclassification use case retains the binary/key, recalculates an available generated filename, and records audit history.
