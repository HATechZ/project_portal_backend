# API Contract: 09 — Project

Inherits Module 00 envelopes/errors/request ID and Module 03 authenticated TenantContext, action-grant, and object-scope chain. Multipart controllers use Nest handling and do not query/build envelopes.

| Method | Path | V1 contract | Authorization |
|---|---|---|---|
| POST | `/api/v1/projects` | Create direct Project, 201 | `ADD_PROJECT` grant; tenant_super_admin or CCR policy |
| GET | `/api/v1/projects` | Tenant-scoped list | tenant_super_admin, CCR, division_head, division_lead grants |
| GET | `/api/v1/projects/:id` | Tenant/object-scoped detail | tenant_super_admin, CCR, division_head, division_lead grants |
| PATCH | `/api/v1/projects/:id` | Approved mutable Project fields only | tenant_super_admin or CCR grant |
| PATCH | `/api/v1/projects/:id/documents/:documentId/document-code` | Reclassify one persisted Project file, 200 | `UPDATE_PROJECT` grant |

The role labels are grant policy, not direct checks: current system-admin/`ccr_coordinator` identities and the action-grant/object-scope pipeline decide access. Division Head and Division Lead receive no create/update grant. No `/workspaces`, `/bid-projects`, shared creation, delete, archive, source channel, Bid conversion/outcome, client-decision, or download API is approved in V1.

## POST `/api/v1/projects`

`multipart/form-data` requires JSON `payload`:

```json
{"name":"North Sea Project","clientId":"uuid"}
```

Name is trimmed/nonblank; clientId is UUID. Optional actual binary parts use `file.<uploadToken>` and are subject to platform count/size/MIME-extension validation. When files are supplied, `fileMetadata` is a JSON object keyed by unique client upload tokens and each value provides stable `documentCodeOptionId`. Files, tokens, and metadata must match one-for-one; repeated Document Code IDs are valid.

Reject tenant/company/actor/id/timestamps, type/workspace, bidInfo/bidding/master-data/shipment/projectCode/sourceChannel/clientEmail/status/Work Request/URL/storage/generated-name/revision fields and every undeclared input. Document Code is per-file classification, not a Project create field.

Create trims/case-folds the name, validates the scoped active Client, creates Project plus ACTIVE event, and claims the tenant-wide name in the same transaction. A Bid or Project claim race returns 409. Storage failure is compensated and durable cleanup failure never returns success.

201 returns id, name, Client summary, derived ACTIVE status, creation metadata, and safe file count/metadata; never a file path/key. Detail returns identity/name (no invented business code), Client, derived status, creation metadata, and protected file/document summary. Generated Project filename is returned only if sufficient approved Project document-naming inputs exist; until then the original filename and protected metadata remain available. PATCH cannot accept status mutation or forbidden create-only fields.

## PATCH `/api/v1/projects/:id/documents/:documentId/document-code`

Accepts `{ "documentCodeOptionId": "uuid" }`. The target must be an active tenant Marketing Document Code. It changes only the per-file classification, records a classification audit event and transactional Project update outbox event, and never re-uploads or changes `originalFileName`, `storageKey`, bytes, or revision. The Project has no owner-defined naming code, so its generated filename remains absent until a later approved Project document workflow has sufficient naming inputs. Multiple files may use the same Document Code.
