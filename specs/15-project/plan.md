# Plan: 15 — Project

1. Obtain owner decisions on permission grants and V1 list/detail/update; approve the independent persistence redesign.
2. Build only `src/project`: multipart DTO/controller, Project service/repository/mapper/status events and focused tests.
3. In one UoW validate scoped Client, create Project + ACTIVE event and publish Project-owned outbox event.
4. Independently validate optional binaries, use generated tenant/Project keys through storage port, persist metadata/link and compensate failed writes.
5. Implement only approved Project read/update/download, reauthorizing Project object access before streaming.
