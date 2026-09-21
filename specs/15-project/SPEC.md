# SPEC: 15 — Project

**Status:** Gate 3; specification approved. **Runtime target:** `src/project/**`. **API:** `/api/v1/projects`.

## Boundary

Project is an independent direct-created tenant business module, not a Bid conversion, workspace variant, or host for Bid details. It owns its controller → service → repository → UnitOfWork, DTOs, Project status/event use cases, files, authorization and outbox events. It never imports Bid and shares no Bid/Project business service; shared items are only platform infrastructure.

Current `projects` is the prohibited combined workspace root. **DATABASE REDESIGN REQUIRED**; no runtime/Prisma/migration/seed/database edit occurs. Vault is unavailable, so no vault sync or hand-written log occurs.

## Rules

- Direct creation accepts only name, clientId and optional binary files. No-file creation succeeds.
- Do not accept/add type/workspace, bidInfo, bidding number, POL/POD, Cargo/Vessel, shipment, General Document Code, Bid projectCode rule, source channel, client email or Bid conversion data.
- Reuse existing Client contract: Client is active, same TenantContext and applicable Company/object scope; server derives tenant/company/actor data.
- Initial Project state is independent `ACTIVE` status event; latest event derives status, never `currentStatus`.
- Independently validate Project binaries, store generated tenant/Project-scoped keys under protected `./uploads`, and persist only metadata/key. Preserve original/generated name where applicable, key, MIME, size, uploader, timestamps and version/revision metadata. No binary DB storage, public upload folder, external URL truth or frontend direct cloud upload. On storage/persistence failure perform Project-scoped compensation; durable cleanup failure never produces a false success.
- List/detail/update only as approved below; do not inherit archive/delete/client decision/conversion behavior from historical frontend/ERD.

## Authorization and Work Request boundary

Use Module 03 ActorProfile/TenantContext/RLS/permission/object-scope architecture. `ADD_PROJECT` is create action; its role/custom grants and V1 list/read/detail/update matrix are **OWNER DECISION REQUIRED**. No direct role checks, `prime_consultant`, division/team assumption or wildcard admin bypass.

Future Work Requests are one-to-many through tenant-qualified `project_id`; Bid needs its own distinct relation. No Work Request workflow/routing/audit logic is included.
