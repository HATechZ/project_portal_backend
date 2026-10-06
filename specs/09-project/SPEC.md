# SPEC: 09 — Project

**Status:** Gate 3; specification approved. **Runtime target:** `src/project/**`. **API:** `/api/v1/projects`.

> **SUPERSEDED ROLE CONTENT:** [`ROLE_ARCHITECTURE_FREEZE.md`](../ROLE_ARCHITECTURE_FREEZE.md) is authoritative. Fixed-role rules, grant matrices, role-name authorization, and legacy custom-scope statements here are retained only as historical implementation context.

## Boundary
Project is an independent, direct-created tenant business module, not a Bid conversion, workspace variant, or host for Bid details. It owns its future controller → service → repository → UnitOfWork surface, DTOs, status/event lifecycle, files, object authorization, and outbox events. It never imports Bid and shares no Bid/Project business service; only platform infrastructure may be shared.

The current combined `projects` workspace root is prohibited for this future domain. **DATABASE REDESIGN REQUIRED.** This specification changes no runtime, Prisma, migration, seed, or database data. Vault is unavailable, so no vault sync or hand-written vault log occurs.

## Rules

- Direct creation accepts name, clientId, active same-tenant POL/POD/Cargo/Vessel IDs, approved Shipment Number, and zero-or-more optional binary files. No-file creation succeeds.
- Do not accept type/workspace, bidInfo, bidding number, source channel, client email, Bid conversion data, or frontend-supplied projectCode.
- Reuse active same-tenant Client validation and applicable company/object scope. Server derives tenant/company/actor data.
- A direct Project appends independent `ACTIVE` status event; latest event derives state, never a mutable `currentStatus` field.
- Bid and Project names use one tenant-wide namespace: trim and case-fold before comparison. The same name conflicts across Project and Bid in one tenant, but may be reused in another tenant.
- The backend derives uppercase `projectCode` from the first character of trimmed Project Name, POL display name, and POD display name. It is a naming component, never frontend input or database identity.
- Persist creation-time Project naming snapshots: POL/POD naming values, Cargo/Vessel code values, normalized Shipment Number, and derived Project Code. Files use `<ProjectCode>-<CargoCode>-<VesselCode>-<ShipmentNumber>-<DocumentCode>-<RevisionCode> <DocumentName>.<ext>`, where Document Code/Document Name are selected General Document Code snapshots and only the extension comes from the uploaded file. Preserve `originalFileName` separately.
- Multiple files may share a Document Code. Reclassification records history but never renames a historical version, changes bytes/storage, or creates a revision. General Document Code/master edits never automatically rename historical persisted names.

## Authorization and Work Request boundary

Authorization uses Module 03's current permission/action-grant and object-scope architecture, not hard-coded role comparisons. `ADD_PROJECT` protects create; future required read/update action definitions and grants use that catalog. Grant policy is locked: current tenant-super-administrator tenant role (owner label `tenant_super_admin`) and `ccr_coordinator` (CCR) may create/update; those two plus `division_head` and `division_lead` may list/read/detail. Division Head and Division Lead are read-only. No `prime_consultant`, invented admin role, or wildcard bypass.

Future Work Requests are one-to-many through tenant-qualified `project_id`; Bid has a distinct relation. No Work Request workflow/routing/audit logic is included.
