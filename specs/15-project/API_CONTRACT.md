# API Contract: 15 — Project

Inherits Module 00 envelopes/errors/request ID and Module 03 authenticated TenantContext/ActorProfile/permission chain. Multipart controllers use Nest handling and do not query/build envelopes.

| Method | Path | V1 contract | Authorization |
|---|---|---|---|
| POST | `/api/v1/projects` | Create direct Project, 201 | configured `ADD_PROJECT` grant |
| GET | `/api/v1/projects` | current UI/reference requires list; fields, filters and pagination are **OWNER DECISION REQUIRED** | **OWNER DECISION REQUIRED** |
| GET | `/api/v1/projects/:id` | detail | **OWNER DECISION REQUIRED** |
| PATCH | `/api/v1/projects/:id` | mutable fields/status behavior | **OWNER DECISION REQUIRED** |

No `/workspaces`, `/bid-projects`, shared creation, delete/archive, source channel, Bid conversion/outcome or client-decision API.

## POST `/api/v1/projects`

`multipart/form-data` requires JSON `payload`: `{ "name": "North Sea Project", "clientId": "uuid" }`. Name is trimmed/nonblank within eventual storage limits and clientId is UUID. `files[]` is optional zero-or-more actual binaries under platform count/size/MIME-extension validation.

Reject tenant/company/actor/id/timestamps, type/workspace, bidInfo/bidding/master-data/shipment/document-code/projectCode/sourceChannel/clientEmail/status/WR/URL/storage/generated-name/revision fields and every undeclared input.

201 returns id, name, Client summary, derived ACTIVE status, created metadata and safe file count/metadata; no file path/key. Existing 400/401/403/404/409/413/sanitized-500 conventions apply.

Detail returns identity/name (no unapproved code), Client, derived status, created metadata, protected file/document summary and future `relatedWorkRequests` only when separately contracted.
