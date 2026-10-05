# API Contract: 09 — Project

Inherits Module 00 envelopes/errors/request ID and Module 03 authenticated TenantContext, action-grant, and object-scope chain. Multipart controllers use Nest handling and do not query/build envelopes.

| Method | Path | V1 contract | Authorization |
|---|---|---|---|
| POST | `/api/v1/projects` | Create direct Project, 201 | `ADD_PROJECT` grant; tenant_super_admin or CCR policy |
| GET | `/api/v1/projects` | Tenant-scoped list | tenant_super_admin, CCR, division_head, division_lead grants |
| GET | `/api/v1/projects/:id` | Tenant/object-scoped detail | tenant_super_admin, CCR, division_head, division_lead grants |
| PATCH | `/api/v1/projects/:id` | Approved mutable Project fields only | tenant_super_admin or CCR grant |
| PATCH | `/api/v1/projects/:id/documents/:documentId/document-code` | Reclassify one persisted Project file, 200 | `UPDATE_PROJECT` grant |

The role labels are grant policy, not direct checks: current tenant-super-admin/`ccr_coordinator` identities and the action-grant/object-scope pipeline decide access. Division Head and Division Lead receive no create/update grant. No `/workspaces`, `/bid-projects`, shared creation, delete, archive, source channel, Bid conversion/outcome, client-decision, or download API is approved in V1.

## POST `/api/v1/projects`

`multipart/form-data` uses flat fields:

```json
{"name":"North Sea Project","clientId":"uuid","polId":"uuid","podId":"uuid","cargoId":"uuid","vesselId":"uuid","shipmentNumber":"01","documentCodeIds":["uuid"]}
```

Name is trimmed/nonblank; clientId, polId, podId, cargoId, and vesselId are UUIDs; Shipment Number uses approved two-digit normalization. POL/POD/Cargo/Vessel must be active, same-tenant approved master records. The backend derives `projectCode` from Project Name + POL + POD and rejects any client `projectCode`. Optional binary parts use `files[]`; `files[i]` maps to `documentCodeIds[i]`. Both are optional when no files are sent; supplied files and IDs must have matching counts, and repeated Document Code IDs are valid.

Reject tenant/company/actor/id/timestamps, type/workspace, bidInfo/bidding, frontend `projectCode`, sourceChannel/clientEmail/status/Work Request/URL/storage/generated-name/revision fields and every undeclared input. Document Code is per-file classification, not a Project create field.

Create trims/case-folds the name, validates scoped active Client/POL/POD/Cargo/Vessel records, derives/snapshots `projectCode` and naming inputs, creates Project plus ACTIVE event, and claims the tenant-wide name in the same transaction. A Bid or Project claim race returns 409. Storage failure is compensated and durable cleanup failure never returns success.

201 returns id, name, derived projectCode, Client summary, normalized naming values, derived ACTIVE status, creation metadata, and safe file count/metadata; never a file path/key. Detail returns identity/name, projectCode, Client, naming snapshots, derived status, creation metadata, and protected file/document summary. PATCH cannot accept status mutation or forbidden create-only fields.

## PATCH `/api/v1/projects/:id/documents/:documentId/document-code`

Accepts `{ "documentCodeId": "uuid" }`. The target must be an active tenant Marketing Document Code. It changes only current classification metadata, records a classification audit event and transactional Project update outbox event, and never re-uploads, changes `originalFileName`, `storageKey`, bytes, revision, or an already-created version's generated filename. Multiple files may use the same Document Code.
