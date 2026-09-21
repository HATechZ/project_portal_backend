# Plan: 14 — Bid

1. Obtain owner decisions on permissions, code collision, filename/revision and V1 reads/updates; approve persistence redesign.
2. Build only `src/bid`: DTOs, multipart controller, Bid service/repository/mapper/status events and focused tests.
3. In one UoW validate scoped Client/references, derive/snapshot names, write Bid + BIDDING event and Bid outbox event.
4. Validate optional binaries, store generated tenant/Bid keys through storage port, persist metadata/link and compensate orphaned keys on failure.
5. Add only approved independent reads/update/download; download reauthorizes object access before streaming.
