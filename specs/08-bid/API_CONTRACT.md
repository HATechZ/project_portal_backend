# API Contract: 08 — Bid

Inherits Module 00 envelopes/errors/request ID and Module 03 authenticated TenantContext, action-grant, and object-scope chain. Multipart controllers use Nest handling and do not query or construct envelopes.

| Method | Path | V1 contract | Authorization |
|---|---|---|---|
| POST | `/api/v1/bids` | Create, 201 | `ADD_BID` grant; tenant_super_admin or CCR policy |
| GET | `/api/v1/bids` | Tenant-scoped list | `VIEW_BID` grant; tenant_super_admin, CCR, division_head, division_lead policy |
| GET | `/api/v1/bids/:id` | Tenant/object-scoped detail | `VIEW_BID` grant; tenant_super_admin, CCR, division_head, division_lead policy |
| PATCH | `/api/v1/bids/:id` | Approved mutable Bid fields only | `UPDATE_BID` grant; tenant_super_admin or CCR policy |

The role labels above are grant policy, not hard-coded checks: current tenant-super-admin/`ccr_coordinator` identities and the existing action-grant/object-scope pipeline decide access. Division Head and Division Lead receive no create/update grant. No delete, archive, outcome, conversion, client-decision, source-channel, document reclassification, or download endpoint is approved in V1.

## POST `/api/v1/bids`

`multipart/form-data` uses flat fields:

```json
{"name":"Salina","clientId":"uuid","biddingNumber":"21128","polId":"uuid","podId":"uuid","cargoId":"uuid","vesselId":"uuid","shipmentNumber":"01","documentCodeIds":["uuid"]}
```

All named business fields are required; IDs are UUID; text trims and is nonblank. `shipmentNumber` uses the approved normalization. `files[]` and `documentCodeIds[]` are optional together; when files are supplied their indexes map one-to-one, and repeated Document Code IDs are valid.

Optional binary parts use `files[]` and are subject to platform count/size/MIME-extension policy. `files[i]` maps to `documentCodeIds[i]`; counts must match whenever files are present.

Each supplied Document Code must be active, tenant-owned, and in `GENERAL` or `MARKETING`.

Reject `type`, workspace, `sourceChannelId`, `clientEmail`, `projectCode`, status, actor/tenant/company/timestamps, URLs, storage keys, generated filenames, revisions, labels, Work Request fields, a Bid-level document code, and every undeclared input.

Create trims/case-folds the name, validates Client and option IDs in tenant scope, derives/snapshots naming values and `projectCode`, creates the Bid and `BIDDING` event, then claims the tenant-wide name in the same database transaction. A unique-claim race returns 409; generated filename is not identity. Storage is compensated on database failure; failed cleanup is queued durably and never returns success.

201 returns a safe Bid summary: id, name, projectCode, Client summary, derived BIDDING status, normalized bid/naming values, creation metadata, and file count/safe metadata. Never return a path or storage key. Detail includes identity/name/code, Client, derived status, bidInfo/naming snapshots, creation metadata, and protected file summary. PATCH cannot accept status mutation or the forbidden create-only fields; any future status transition or per-file reclassification needs its own contract.

## C3 business-outcome API freeze

The earlier V1 sentence prohibiting outcome/conversion/archive endpoints is superseded only by this C3 surface. All routes use the standard envelope, request ID, TenantContext, object scope, and repository-standard idempotency key/correlation behavior. Authorization is permission plus compatible scope, same tenant/resource relationship, and lifecycle state; no route authorizes by role label.

| Method | Path | Authorization and required state | Contract |
|---|---|---|---|
| GET | `/api/v1/bids/:id/business-readiness` | `VIEW_BID`; scoped Bid | Returns current cycle, relevant request count, readiness and safe reason codes. |
| POST | `/api/v1/bids/:id/business-outcome` | `DECIDE_BID_OUTCOME`; open active Bid/current cycle; readiness true. `REJECTED` also requires `ARCHIVE_BID`. | Atomically records `WON` or `REJECTED`; `WON` creates DirectProject plus conversion, `REJECTED` archives Bid. |
| GET | `/api/v1/bids/:id/conversion` | `VIEW_BID`; scoped Bid | Returns safe immutable conversion/outcome history, or no conversion. |
| POST | `/api/v1/bids/:id/archived-review-requests` | `REQUEST_ARCHIVED_BID_REVIEW`; Bid archived from a rejected outcome | Appends an immutable review request; does not reopen. |
| POST | `/api/v1/bids/:id/restore` | `RESTORE_BID`; archived rejected Bid with applicable persisted review request | Reopens the same Bid into the next immutable cycle. |

`POST /business-outcome` body is `{ "outcome": "WON" | "REJECTED", "note"?: string }`. It accepts no Project name/code/ID, source-Bid ID, child Work Request IDs/states, document IDs, tenant/company/actor fields, status, or client decision. For `WON`, the server calls the existing canonical DirectProject-code generator and derives `<Bid Name> - <Generated Project Code>`; if a length limit applies it truncates only the Bid-name portion and preserves the separator and full generated code. It normalizes/reserves the result through the existing tenant-wide name claim. The source Bid name/claim is never changed or transferred. A successful response returns the Bid/cycle/outcome summaries and, for `WON`, safe new DirectProject and conversion summaries; no storage keys or internal audit data.

Readiness reads exactly the current cycle's persisted Bid-owned Work Requests and their latest authoritative client decision/state. The mutation locks/reloads the Bid/current cycle, rechecks readiness and absence of a terminal outcome/conversion, generates/reserves code and derived name, creates the DirectProject, outcome, conversion, cycle closure, audit/status and outbox records in one serializable transaction. It maps stale state, incomplete/not-ready requests, missing review request, duplicate/idempotency conflict, canonical-name claim collision, concurrent decision, or already-converted/rejected Bid to the standard 409 contract. It does not alter C1 client-decision API, C2 information API, Work Request workflow, documents, or historical children.

`POST /archived-review-requests` body is `{ "note"?: string }`; `POST /restore` body is `{ "note"?: string }`. Restore does not create a new Bid or DirectProject, erase the rejection, or modify old Work Requests/documents. It appends the next cycle, the normal Bid status transition/audit, and required outbox event. Every mutation emits audit/outbox in its same database transaction; no RabbitMQ transport is introduced.
