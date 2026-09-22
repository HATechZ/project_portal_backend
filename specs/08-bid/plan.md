# Plan: 08 — Bid

1. Approve and apply the independent Bid persistence redesign, including tenant-wide neutral name claims, RLS, backfill, and action-grant definitions needed for V1 reads/updates.
2. Build only `src/bid`: multipart DTOs/controller, Bid service/repository/mapper, status events, and focused tests.
3. In one UnitOfWork validate scoped Client/references, normalize/claim name, derive/snapshot naming values, write Bid plus BIDDING event, and publish a Bid-owned outbox event.
4. Validate optional binaries and per-file Document Code IDs; generate protected UUID storage keys and business filenames through a storage port, persist metadata/link, reject exact generated-name collisions, and compensate failed writes.
5. Implement only the approved independent list/detail/PATCH surface. A later explicit file-reclassification use case reuses the stored binary/key, recalculates one filename, and records audit history.
