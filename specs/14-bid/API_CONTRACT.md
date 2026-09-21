# API Contract: 14 — Bid

Inherits Module 00 envelopes/errors/request ID and Module 03 authenticated TenantContext/ActorProfile/permission chain. Multipart controllers use Nest handling and do not query or construct envelopes.

| Method | Path | V1 contract | Authorization |
|---|---|---|---|
| POST | `/api/v1/bids` | Create, 201 | configured `ADD_BID` grant |
| GET | `/api/v1/bids` | current UI/reference requires list; fields, filters and pagination are **OWNER DECISION REQUIRED** | **OWNER DECISION REQUIRED** |
| GET | `/api/v1/bids/:id` | detail | **OWNER DECISION REQUIRED** |
| PATCH | `/api/v1/bids/:id` | mutable fields/status behavior | **OWNER DECISION REQUIRED** |

No delete/archive/outcome/conversion/client-decision/source-channel route is approved.

## POST `/api/v1/bids`

`multipart/form-data` requires JSON `payload`:

```json
{"name":"Samsung bid","clientId":"uuid","bidInfo":{"biddingNumber":"BID-01","polOptionId":"uuid","podOptionId":"uuid","cargoCodeOptionId":"uuid","vesselCodeOptionId":"uuid","shipmentNumber":"01","documentCodeOptionId":"uuid"}}
```

All named fields are required; IDs are UUID; text trims/nonblank and shipment uses approved normalization. `files[]` is optional and contains actual binaries subject to platform count/size/MIME-extension policy. Reject type/workspace/sourceChannel/clientEmail/projectCode/status/actor/tenant/company/timestamps/URLs/storage keys/generated filenames/revisions/labels/Work Request fields and every undeclared input.

201 returns safe Bid summary: id, name, projectCode, Client summary, derived BIDDING status, normalized bid/naming values, creation metadata and file count/safe metadata. Never return path/key. Existing 400/401/403/404/409/413/sanitized-500 conventions apply.

Detail includes identity/name/code, Client, derived status, bidInfo/naming snapshots, creation metadata, protected file summary and future `relatedWorkRequests` only once separately contracted.
