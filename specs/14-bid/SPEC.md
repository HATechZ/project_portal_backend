# SPEC: 14 — Bid

**Status:** Gate 3; specification approved. **Runtime target:** `src/bid/**`. **API:** `/api/v1/bids`.

## Boundary

Bid is an independent tenant business module, not a Project subtype, workspace, conversion source, or shared Bid/Project service. It owns its future controller → service → repository → UnitOfWork surface, DTOs, status/event use cases, repository, object authorization, outbox events and optional files. It may share only infrastructure: auth/guards, TenantContext/RLS, UnitOfWork, storage port, envelopes/errors and utilities. No `/bid-projects`, `/workspaces`, type field, sourceChannelId, or combined create is permitted.

The current workspace `Project` plus `BidDetail`, shared status events, Project-only Documents/WorkRequests, type, source channel and conversion records are obsolete and coupled. **DATABASE REDESIGN REQUIRED**; this task changes no runtime/Prisma/migration/seed/database. Vault is unavailable, so no vault sync or hand-written vault log occurs.

## Rules

- Create accepts required structured data and zero-or-more optional binary files. No-file creation succeeds.
- Server derives uppercase `projectCode` as first character of Bid name + POL display name + POD display name: Samsung/Korea/Mexico → `SKM`. Shipment number follows the approved two-digit normalization; neither is client input.
- Reuse Client contract: active Client, TenantContext and applicable Company scope. Reuse active same-tenant fixed-type option validation: POL, POD, CARGO_CODE, VESSEL_CODE; General Document Code is active same-tenant MARKETING. IDs only; no labels or clientEmail.
- First status is an independent `BIDDING` event; current status derives from latest event, never a mutable field.
- Naming needs bidding number, generated code, cargo/vessel code, normalized shipment number, General Document Code and later revision. Persist creation-time snapshots because master data is mutable. Filename template/delimiters and revision rules are **OWNER DECISION REQUIRED**.
- Files use generated tenant/Bid-scoped keys under protected `./uploads`; PostgreSQL stores metadata/key only, never bytes. Preserve original/generated name, key, MIME, size, uploader, timestamps and version/revision metadata. No public static folder, direct browser S3/R2 upload, or external URL as truth. Failed store/metadata/transaction operations compensate storage (durable cleanup if deletion fails) and never report success.

## Authorization and Work Request boundary

Module 03 ActorProfile/TenantContext/permission/object-scope/RLS architecture applies. `ADD_BID` is the create action; its role/custom grants and list/read/detail/update matrix are **OWNER DECISION REQUIRED**. No direct role checks, `prime_consultant`, division/team assumption, or admin wildcard.

Future Work Request may relate one-to-many to Bid only through tenant-qualified `bid_id`, or a DB-enforced exclusive Bid/Project parent. It must not use Project as a Bid surrogate. No WR workflow logic is defined here.
