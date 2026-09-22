# SPEC: 09 — Project

**Status:** Gate 3; specification approved. **Runtime target:** `src/project/**`. **API:** `/api/v1/projects`.

## Boundary

Project is an independent, direct-created tenant business module, not a Bid conversion, workspace variant, or host for Bid details. It owns its future controller → service → repository → UnitOfWork surface, DTOs, status/event lifecycle, files, object authorization, and outbox events. It never imports Bid and shares no Bid/Project business service; only platform infrastructure may be shared.

The current combined `projects` workspace root is prohibited for this future domain. **DATABASE REDESIGN REQUIRED.** This specification changes no runtime, Prisma, migration, seed, or database data. Vault is unavailable, so no vault sync or hand-written vault log occurs.

## Rules

- Direct creation accepts only name, clientId, and zero-or-more optional binary files. No-file creation succeeds.
- Do not accept type/workspace, bidInfo, bidding number, POL/POD, Cargo/Vessel, shipment, source channel, client email, Bid conversion data, or a Bid project-code rule.
- Reuse active same-tenant Client validation and applicable company/object scope. Server derives tenant/company/actor data.
- A direct Project appends independent `ACTIVE` status event; latest event derives state, never a mutable `currentStatus` field.
- Bid and Project names use one tenant-wide namespace: trim and case-fold before comparison. The same name conflicts across Project and Bid in one tenant, but may be reused in another tenant.
- Files store actual binaries only in protected `./uploads`; PostgreSQL holds metadata and storage key. Preserve `originalFileName`, `generatedFileName` when enough approved naming information exists, `storageKey`, MIME, size, uploader, timestamps, Document Code classification, and revision/version metadata. No binary DB storage, public upload folder, external URL truth, or frontend direct cloud upload.
- Multiple files may share a Document Code. Preserve `originalFileName` and never manufacture `(2)`/`(3)`. Later reclassification changes only that file's Document Code relation and `generatedFileName`; `originalFileName` and `storageKey` remain unchanged, no re-upload or automatic revision occurs, and the action is audit/history relevant. General Document Code master edits never automatically rename historical persisted names.
- Project has no owner-defined independent business code. UUID/internal ID is the technical identity. Historical Project filename examples omit Bidding Number, but current Project create lacks the independent naming fields needed to generate that legacy format; no Bid field or invented Project code is introduced to fill the gap.

## Authorization and Work Request boundary

Authorization uses Module 03's current permission/action-grant and object-scope architecture, not hard-coded role comparisons. `ADD_PROJECT` protects create; future required read/update action definitions and grants use that catalog. Grant policy is locked: current system-administrator tenant role (owner label `tenant_super_admin`) and `ccr_coordinator` (CCR) may create/update; those two plus `division_head` and `division_lead` may list/read/detail. Division Head and Division Lead are read-only. No `prime_consultant`, invented admin role, or wildcard bypass.

Future Work Requests are one-to-many through tenant-qualified `project_id`; Bid has a distinct relation. No Work Request workflow/routing/audit logic is included.
