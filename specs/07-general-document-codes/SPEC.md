# SPEC: 07 — General Document Codes

**Status:** Gate 4; implementation in progress.  
**Persistence:** existing tenant-owned `DocumentCodeOption`, fixed internally to `DocumentGroupCode.MARKETING`.

## Purpose and boundary

General Document Codes is the tenant catalogue for selecting a document code. It owns list, get, create, update, deactivate, reactivate, and approved catalogue provisioning. Public terminology is **General Document Code(s)** and the API is `/api/v1/general-document-codes`; `MARKETING` and `documentGroup` are never public DTO fields.

It does not introduce a generic document-code API, Document/Bid/Naming behavior, Project Code, Shipment Number, Revision, filename, workflow, reorder API, hard delete, or any Module 06.x behavior. Runtime implementation will require the approved permission/grant migration and tenant-provisioning integration, but this spec task changes none of them.

## Catalogue, CRUD, and lifecycle

New tenants automatically receive these eight initial rows: `000` Info; `001` Project Information; `002` Cargo Information; `011` Action Log; `012` Contact List; `013` Comment Sheet; `802` Contract; `803` Invoice. They are ordinary tenant records after creation, not protected/system/default records: all identity fields are editable and lifecycle transitions are allowed.

Existing tenants receive missing-only backfill. An existing same-code row remains exactly as it is; no existing or custom row is overwritten, reactivated, reset, or deleted. Provisioning is tenant-scoped, idempotent, concurrency-safe, and uses the database unique key to prevent duplicates.

Code trims then uppercases, preserving string semantics and leading zeroes (`" abc "` → `"ABC"`, `"001"` → `"001"`). Name trims and is non-empty; description is optional. Create starts active. `GET /general-document-codes?status=active|inactive|all` defaults to active; `GET /general-document-codes/deactivated` returns inactive rows only; order is `sortOrder, code, id` ascending. `sortOrder` is not client-mutable and V1 has no reorder API. No normal delete exists.

## Authorization, tenancy, and uniqueness

Every query/write/lifecycle predicate is tenant + fixed `MARKETING` (+ ID). Foreign, absent, and wrong-group IDs are undisclosed. The whole controller requires `MANAGE_GENERAL_DOCUMENT_CODES` using the standard authenticated TenantContext/actor, object-scope, and permissions guard chain. Grant it only to current `system_admin`, `division_head`, and `division_lead`; there are no direct role checks or custom-role grants. Do not impose Module 06's `tenantWide` service restriction: current TenantContext plus configured permission authorizes these approved roles.

Current uniqueness is `(tenantId, documentGroup, code)` after code normalization; name is not unique. RLS exists. Runtime requires a narrowly scoped `app_user` grant of `SELECT`, `INSERT`, and `UPDATE` on `document_code_options`, retaining RLS and withholding `DELETE`, `ALL`, and `BYPASSRLS`.

## Historical safety

Deactivation preserves rows and references. A referenced `DocumentCodeOption` remains editable; code/name/description updates apply through the shared relation and do not retroactively rename persisted DocumentVersion filenames. Future Document writes must validate same tenant plus General group because the current FK is not composite tenant/group enforcement.

## Definition of Done

Dedicated API/service/repository behavior proves status filtering, code normalization and leading zeroes, fixed group, tenant isolation, configured permission grants without role checks/custom-role grants/tenantWide restriction, duplicates, lifecycle, idempotent missing-only provisioning, reference-safe editing, and Swagger. The required dedicated action, role grants, table privileges, and provisioning integration are implemented and verified in their respective runtime/migration work. No Module 06.x behavior changes.
