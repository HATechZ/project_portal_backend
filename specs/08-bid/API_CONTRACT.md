# API Contract: 08 — Bid

Inherits Module 00 envelopes/errors/request ID and Module 03 authenticated TenantContext, action-grant, and object-scope chain. Multipart controllers use Nest handling and do not query or construct envelopes.

| Method | Path | V1 contract | Authorization |
|---|---|---|---|
| POST | `/api/v1/bids` | Create, 201 | `ADD_BID` grant; tenant_super_admin or CCR policy |
| GET | `/api/v1/bids` | Tenant-scoped list | `VIEW_BID` grant; tenant_super_admin, CCR, division_head, division_lead policy |
| GET | `/api/v1/bids/:id` | Tenant/object-scoped detail | `VIEW_BID` grant; tenant_super_admin, CCR, division_head, division_lead policy |
| PATCH | `/api/v1/bids/:id` | Approved mutable Bid fields only | `UPDATE_BID` grant; tenant_super_admin or CCR policy |

The role labels above are grant policy, not hard-coded checks: current system-admin/`ccr_coordinator` identities and the existing action-grant/object-scope pipeline decide access. Division Head and Division Lead receive no create/update grant. No delete, archive, outcome, conversion, client-decision, source-channel, document reclassification, or download endpoint is approved in V1.

## POST `/api/v1/bids`

`multipart/form-data` requires JSON `payload`:

```json
{"name":"Salina","clientId":"uuid","bidInfo":{"biddingNumber":"21128","polOptionId":"uuid","podOptionId":"uuid","cargoCodeOptionId":"uuid","vesselCodeOptionId":"uuid","shipmentNumber":"01"}}
```

All named fields are required; IDs are UUID; text trims and is nonblank. `shipmentNumber` uses the approved normalization. `documentCodeOptionId` is not a Bid-level input.

Optional actual binary parts use `file.<uploadToken>` and are subject to platform count/size/MIME-extension policy. When files are present, `fileMetadata` is a JSON object keyed by each unique client upload token; each value supplies its stable `documentCodeOptionId`. Tokens, files, and metadata must match one-for-one. Repeated `documentCodeOptionId` values are valid. This maps every binary to its Document Code without trusting display strings or filename text.

Reject `type`, workspace, `sourceChannelId`, `clientEmail`, `projectCode`, status, actor/tenant/company/timestamps, URLs, storage keys, generated filenames, revisions, labels, Work Request fields, a Bid-level document code, and every undeclared input.

Create trims/case-folds the name, validates Client and option IDs in tenant scope, derives/snapshots naming values and `projectCode`, creates the Bid and `BIDDING` event, then claims the tenant-wide name in the same database transaction. A unique-claim race or exact generated-filename collision returns 409. Storage is compensated on database failure; failed cleanup is queued durably and never returns success.

201 returns a safe Bid summary: id, name, projectCode, Client summary, derived BIDDING status, normalized bid/naming values, creation metadata, and file count/safe metadata. Never return a path or storage key. Detail includes identity/name/code, Client, derived status, bidInfo/naming snapshots, creation metadata, and protected file summary. PATCH cannot accept status mutation or the forbidden create-only fields; any future status transition or per-file reclassification needs its own contract.
