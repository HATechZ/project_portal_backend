# API Contract: 10.1 — Shared Document Upload & Versioning

All routes inherit Module 00 envelope, request ID, multipart limits, error mapping, and idempotency conventions, and Module 03's authenticated TenantContext → object scope → permission chain. Parent controllers own these routes and return plain data.

| Method | Path | Operation | Required action plus checks |
|---|---|---|---|
| POST | `/api/v1/bids/:id/documents` | New Bid document(s), 201 | `UPDATE_BID`; tenant, Bid scope |
| POST | `/api/v1/bids/:id/documents/:documentId/versions` | Append Bid version, 201 | `UPDATE_BID`; tenant, Bid scope, applicable current Bid producer/state rule |
| GET | `/api/v1/bids/:id/documents` | List documents | `VIEW_BID`; tenant, Bid scope |
| GET | `/api/v1/bids/:id/documents/:documentId/versions` | Version history | `VIEW_BID`; tenant, Bid scope |
| POST | `/api/v1/projects/:id/documents` | New Direct Project document(s), 201 | `UPDATE_PROJECT`; tenant, Project scope |
| POST | `/api/v1/projects/:id/documents/:documentId/versions` | Append Project version, 201 | `UPDATE_PROJECT`; tenant, Project scope, applicable current Project producer/state rule |
| GET | `/api/v1/projects/:id/documents` | List documents | `VIEW_PROJECT`; tenant, Project scope |
| GET | `/api/v1/projects/:id/documents/:documentId/versions` | Version history | `VIEW_PROJECT`; tenant, Project scope |
| POST | `/api/v1/work-requests/:id/documents` | New Work Request document(s), 201 | `ADD_WORK_REQUEST_DOCUMENT`; tenant, parent/request scope |
| POST | `/api/v1/work-requests/:id/documents/:documentId/versions` | Append working version, 201 | `ADD_WORK_REQUEST_DOCUMENT`; tenant, request scope, active assignment, state |
| GET | `/api/v1/work-requests/:id/documents` | Existing valid read retained | `VIEW_WORK_REQUEST`; tenant, request scope |
| GET | `/api/v1/work-requests/:id/documents/:documentId/versions` | Existing valid read retained | `VIEW_WORK_REQUEST`; tenant, request scope |

The listed actions are the current catalogue; no role-name checks or super-admin bypasses are authorized. Future TMS maps M1 to producer/version uploader and M2/M3 to checking/approval without changing this route lineage rule.

## Multipart requests

New-document requests accept `files[]` and `documentCodeIds[]` only as paired positional arrays. Both may be absent only where the parent command permits no files; otherwise their counts must match, each ID is UUID/active/same-tenant/allowed for that parent, and repeated code IDs are valid. File validation, safe basename, count/size/MIME-extension policy, storage key creation, and naming run in the shared pipeline. The generated extension is the uploaded file extension; the generated display name comes from the selected Document Code's official name, not the uploaded filename.

Version requests accept exactly one `file` multipart part (the implementation may use the existing `files[]` interceptor internally only if the external contract still enforces cardinality one). The route `documentId` establishes lineage. It inherits document code; it rejects `documentCodeId(s)`, `originalFileName`, generated filename, storage key, version/revision number, parent/source, actor, tenant, and unknown operational fields.

## Read shapes

`GET .../documents` returns `DocumentSummary[]`:

```json
{"documentId":"uuid","owner":{"kind":"BID|PROJECT|WORK_REQUEST","id":"uuid"},"documentCode":{"id":"uuid","code":"100","name":"Stowage Plan"},"originalFileName":"final_plan_v7.pdf","latestVersion":{"versionId":"uuid","versionNumber":2,"uploadedFileName":"SKM-CRA-CA2-01-100-A Stowage Plan.pdf","generatedFileName":"SKM-CRA-CA2-01-100-A Stowage Plan.pdf","mimeType":"application/pdf","size":123,"checksum":null,"revisionCode":"A","uploadedBy":{"id":"uuid","label":"User"},"uploadedAt":"ISO-8601"}}
```

`GET .../documents/:documentId/versions` returns the same version shape in deterministic oldest-to-newest order (`uploadedAt`, then `versionId`). Multiple versions may share a generated filename and revision code; storage identity remains version ID/storage key. Binary paths, storage keys, tenant IDs, and authorization internals are never exposed. Parent-mismatched and foreign documents are not found.

201 responses return the affected `DocumentSummary`/created version in the standard envelope. Invalid file/mapping/name input is 400; absent or foreign parent/document/code is 404; missing permission/scope/producer relationship is 403; invalid state, idempotency collision, version-number race, or persistence conflict is 409. Storage/persistence failure never returns 201.
